import { assertCronAuthorized } from "../_shared/cron-auth.ts";
import { edgeLog } from "../_shared/edgeLog.ts";
import { serviceClient } from "../_shared/supabase.ts";

const FN = "enqueue_release_sync_candidates";

type MediaRow = { content_id: number; media_type: "movie" | "tv" };

function keyOf(r: MediaRow) {
  return `${r.media_type}:${r.content_id}`;
}

Deno.serve(async (req) => {
  edgeLog(FN, "request", { method: req.method });
  const authErr = assertCronAuthorized(req);
  if (authErr) {
    edgeLog(FN, "auth_failed", { hasCronSecret: !!Deno.env.get("CRON_SECRET") });
    return authErr;
  }
  edgeLog(FN, "auth_ok");

  try {
    const ttlSec = Number(Deno.env.get("SYNC_TTL_SECONDS") || "604800");
    const cutoff = new Date(Date.now() - ttlSec * 1000).toISOString();
    edgeLog(FN, "config", { ttlSec, cutoff });

    const supabase = serviceClient();

    const { data: wishlistRows, error: wErr } = await supabase
      .from("wishlist")
      .select("content_id, media_type");
    if (wErr) throw wErr;

    const { data: watchedTv, error: tvErr } = await supabase
      .from("watched_content")
      .select("user_id, content_id, media_type")
      .eq("media_type", "tv");
    if (tvErr) throw tvErr;

    const { data: inProgress, error: pErr } = await supabase
      .from("series_progress")
      .select("user_id, series_id")
      .eq("completed", false);
    if (pErr) throw pErr;

    const progressSet = new Set(
      (inProgress ?? []).map((p) => `${p.user_id}:${p.series_id}`),
    );

    const candidates = new Map<string, MediaRow>();

    for (const w of wishlistRows ?? []) {
      const k = keyOf(w as MediaRow);
      candidates.set(k, { content_id: w.content_id, media_type: w.media_type });
    }

    for (const row of watchedTv ?? []) {
      if (!progressSet.has(`${row.user_id}:${row.content_id}`)) continue;
      const r: MediaRow = { content_id: row.content_id, media_type: "tv" };
      candidates.set(keyOf(r), r);
    }

    edgeLog(FN, "sources", {
      wishlistRows: (wishlistRows ?? []).length,
      watchedTv: (watchedTv ?? []).length,
      inProgress: (inProgress ?? []).length,
      distinctCandidates: candidates.size,
    });

    let enqueued = 0;
    let skippedFresh = 0;
    let skippedPending = 0;

    for (const { content_id, media_type } of candidates.values()) {
      const { data: cache } = await supabase
        .from("release_cache")
        .select("refreshed_at")
        .eq("content_id", content_id)
        .eq("media_type", media_type)
        .maybeSingle();

      if (cache?.refreshed_at && new Date(cache.refreshed_at) >= new Date(cutoff)) {
        skippedFresh++;
        continue;
      }

      const { data: pending } = await supabase
        .from("series_sync_queue")
        .select("id")
        .eq("content_id", content_id)
        .eq("media_type", media_type)
        .eq("status", "pending")
        .maybeSingle();

      if (pending) {
        skippedPending++;
        continue;
      }

      const { error: insErr } = await supabase.from("series_sync_queue").insert({
        content_id,
        media_type,
        status: "pending",
      });
      if (insErr) {
        if (insErr.code === "23505") skippedPending++;
        else throw insErr;
      } else {
        enqueued++;
      }
    }

    const body = {
      ok: true,
      distinctTitles: candidates.size,
      enqueued,
      skippedFresh,
      skippedPending,
    };
    edgeLog(FN, "done", body);
    return new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    edgeLog(FN, "error", { err: String(e) });
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
