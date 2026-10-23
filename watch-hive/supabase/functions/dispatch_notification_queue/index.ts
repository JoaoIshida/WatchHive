import { assertCronAuthorized } from "../_shared/cron-auth.ts";
import { edgeLog } from "../_shared/edgeLog.ts";
import {
  type PendingNotificationRow,
  pushPendingNotifications,
} from "../_shared/pushDispatch.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { parseReleaseDedupeKey } from "../_shared/releaseNotifyCopy.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const FN = "dispatch_notification_queue";
const BATCH = 500;

type QueueRow = {
  id: string;
  user_id: string;
  dedupe_key: string;
  payload: {
    title?: string;
    message?: string;
    link?: string;
  };
};

Deno.serve(async (req) => {
  edgeLog(FN, "request", { method: req.method });
  const authErr = assertCronAuthorized(req);
  if (authErr) return authErr;

  try {
    const supabase = serviceClient();
    const now = new Date().toISOString();

    const { data: pending, error: qErr } = await supabase
      .from("notification_queue")
      .select("id, user_id, dedupe_key, payload")
      .eq("status", "pending")
      .lte("send_at_utc", now)
      .order("send_at_utc", { ascending: true })
      .limit(BATCH);
    if (qErr) throw qErr;

    let materialized = 0;
    let failed = 0;
    let deduped = 0;
    let stale = 0;
    const materializedRows: PendingNotificationRow[] = [];
    const stillTracked = await loadStillTracked(supabase, (pending ?? []) as QueueRow[]);

    for (const row of (pending ?? []) as QueueRow[]) {
      // Removed from wishlist / watched since precompute queued it: don't send.
      if (!stillTracked(row.dedupe_key)) {
        const { error: delErr } = await supabase.from("notification_queue").delete().eq("id", row.id);
        if (delErr) throw delErr;
        stale++;
        continue;
      }

      const title = row.payload?.title ?? "WatchHive";
      const message = row.payload?.message ?? "";
      const link = row.payload?.link ?? null;

      const { data: notif, error: insErr } = await supabase
        .from("notifications")
        .insert({
          user_id: row.user_id,
          type: "release_reminder",
          title,
          message,
          link,
          dedupe_key: row.dedupe_key,
          read: false,
        })
        .select("id, user_id, type, title, message, link")
        .maybeSingle();

      if (insErr?.code === "23505") {
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", row.user_id)
          .eq("dedupe_key", row.dedupe_key)
          .maybeSingle();
        await supabase
          .from("notification_queue")
          .update({
            status: "materialized",
            materialized_notification_id: existing?.id ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        deduped++;
        continue;
      }
      if (insErr) {
        await supabase
          .from("notification_queue")
          .update({
            status: "failed",
            last_error: String(insErr.message).slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        failed++;
        continue;
      }

      await supabase
        .from("notification_queue")
        .update({
          status: "materialized",
          materialized_notification_id: notif?.id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      materialized++;

      if (notif?.id) {
        materializedRows.push(notif as PendingNotificationRow);
      }
    }

    let pushSummary = null;
    if (materializedRows.length > 0) {
      pushSummary = await pushPendingNotifications(
        FN,
        supabase,
        materializedRows,
      );
      edgeLog(FN, "push_after_materialize", pushSummary);
    }

    const body = {
      ok: true,
      picked: (pending ?? []).length,
      materialized,
      deduped,
      stale,
      failed,
      push: pushSummary,
    };
    edgeLog(FN, "done", body);
    return new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    edgeLog(FN, "fatal", { err: String(e) });
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

/** Returns a predicate: is the wishlist / watched row behind this release reminder still there? */
async function loadStillTracked(supabase: SupabaseClient, rows: QueueRow[]) {
  const parsed = rows.map((r) => parseReleaseDedupeKey(r.dedupe_key)).filter((k) => k !== null);
  const userIds = [...new Set(parsed.map((k) => k!.userId))];
  const contentIds = [...new Set(parsed.map((k) => k!.contentId))];
  const wish = new Set<string>();
  const watching = new Set<string>();
  if (userIds.length) {
    const [w, wc] = await Promise.all([
      supabase.from("wishlist").select("user_id, content_id, media_type")
        .in("user_id", userIds).in("content_id", contentIds),
      supabase.from("watched_content").select("user_id, content_id, media_type")
        .in("user_id", userIds).in("content_id", contentIds).eq("media_type", "tv"),
    ]);
    if (w.error) throw w.error;
    if (wc.error) throw wc.error;
    for (const r of w.data ?? []) wish.add(`${r.user_id}:${r.content_id}:${r.media_type}`);
    for (const r of wc.data ?? []) watching.add(`${r.user_id}:${r.content_id}:${r.media_type}`);
  }
  return (dedupeKey: string) => {
    const k = parseReleaseDedupeKey(dedupeKey);
    if (!k) return true; // not a release reminder key: nothing to re-check
    const id = `${k.userId}:${k.contentId}:${k.mediaType}`;
    return k.watching ? watching.has(id) : wish.has(id);
  };
}
