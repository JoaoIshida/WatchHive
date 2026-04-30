import { DateTime } from "https://esm.sh/luxon@3.5.0";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { assertCronAuthorized } from "../_shared/cron-auth.ts";
import { edgeLog } from "../_shared/edgeLog.ts";
import { offsetDaysForKind, type ReminderKind } from "../_shared/reminders.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { tmdbMovieCa, tmdbTvNextAir } from "../_shared/tmdb.ts";

const FN = "process_series_sync_queue";
const BATCH = 12;

type Prefs = {
  timezone: string;
  default_reminder_kind: ReminderKind;
  custom_days_before: number | null;
};

const defaultPrefs: Prefs = {
  timezone: "America/Toronto",
  default_reminder_kind: "release_day",
  custom_days_before: null,
};

async function loadPrefs(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Record<string, Prefs>> {
  const out: Record<string, Prefs> = {};
  if (userIds.length === 0) return out;
  const { data } = await supabase
    .from("notification_preferences")
    .select("user_id, timezone, default_reminder_kind, custom_days_before")
    .in("user_id", userIds);
  for (const row of data ?? []) {
    out[row.user_id] = {
      timezone: row.timezone || defaultPrefs.timezone,
      default_reminder_kind: (row.default_reminder_kind ||
        defaultPrefs.default_reminder_kind) as ReminderKind,
      custom_days_before: row.custom_days_before,
    };
  }
  return out;
}

async function tryInsertNotification(
  supabase: SupabaseClient,
  row: {
    user_id: string;
    title: string;
    message: string;
    link: string;
    dedupe_key: string;
  },
) {
  const { error } = await supabase.from("notifications").insert({
    user_id: row.user_id,
    type: "release_reminder",
    title: row.title,
    message: row.message,
    link: row.link,
    dedupe_key: row.dedupe_key,
    read: false,
  });
  if (error?.code === "23505") return;
  if (error) throw error;
  edgeLog(FN, "release_reminder_inserted", {
    user_id: row.user_id,
    dedupe_key: row.dedupe_key,
  });
}

async function materializeForContent(
  supabase: SupabaseClient,
  content_id: number,
  media_type: "movie" | "tv",
  title: string,
  release_date: string | null,
) {
  if (!release_date) return;

  const userIds = new Set<string>();

  const { data: wishRows } = await supabase
    .from("wishlist")
    .select("id, user_id")
    .eq("content_id", content_id)
    .eq("media_type", media_type);

  const wishlistIds = (wishRows ?? []).map((w) => w.id);
  let wrMap = new Map<
    string,
    { use_global_default: boolean; reminder_kind: ReminderKind | null; custom_days_before: number | null }
  >();
  if (wishlistIds.length) {
    const { data: wr } = await supabase
      .from("wishlist_reminders")
      .select("wishlist_id, use_global_default, reminder_kind, custom_days_before")
      .in("wishlist_id", wishlistIds);
    for (const r of wr ?? []) {
      wrMap.set(r.wishlist_id, {
        use_global_default: r.use_global_default,
        reminder_kind: r.reminder_kind as ReminderKind | null,
        custom_days_before: r.custom_days_before,
      });
    }
  }

  for (const w of wishRows ?? []) userIds.add(w.user_id);

  const { data: watchedRows } = await supabase
    .from("watched_content")
    .select("id, user_id")
    .eq("content_id", content_id)
    .eq("media_type", "tv");

  const { data: progressRows } = await supabase
    .from("series_progress")
    .select("user_id, series_id, completed")
    .eq("series_id", content_id)
    .eq("completed", false);

  const activeUsers = new Set(
    (progressRows ?? []).map((p) => p.user_id),
  );

  const watchingCandidates: { id: string; user_id: string }[] = [];
  for (const wc of watchedRows ?? []) {
    if (media_type !== "tv") continue;
    if (!activeUsers.has(wc.user_id)) continue;
    watchingCandidates.push({ id: wc.id, user_id: wc.user_id });
    userIds.add(wc.user_id);
  }

  let whMap = new Map<
    string,
    { use_global_default: boolean; reminder_kind: ReminderKind | null; custom_days_before: number | null }
  >();
  if (watchingCandidates.length) {
    const { data: wh } = await supabase
      .from("watching_reminders")
      .select("watched_content_id, use_global_default, reminder_kind, custom_days_before")
      .in(
        "watched_content_id",
        watchingCandidates.map((c) => c.id),
      );
    for (const r of wh ?? []) {
      whMap.set(r.watched_content_id, {
        use_global_default: r.use_global_default,
        reminder_kind: r.reminder_kind as ReminderKind | null,
        custom_days_before: r.custom_days_before,
      });
    }
  }

  const prefs = await loadPrefs(supabase, [...userIds]);

  const link =
    media_type === "movie"
      ? `/movies/${content_id}`
      : `/series/${content_id}`;

  const releaseLuxon = DateTime.fromISO(release_date, { zone: "utc" }).startOf("day");

  for (const w of wishRows ?? []) {
    const p = prefs[w.user_id] ?? defaultPrefs;
    const wr = wrMap.get(w.id);
    const useGlobal = wr?.use_global_default !== false;
    const kind = (useGlobal
      ? p.default_reminder_kind
      : (wr?.reminder_kind ?? p.default_reminder_kind)) as ReminderKind;
    const custom = useGlobal
      ? p.custom_days_before
      : wr?.custom_days_before ?? p.custom_days_before;
    const offset = offsetDaysForKind(kind, custom);
    const target = releaseLuxon.minus({ days: offset });
    const targetStr = target.toISODate()!;
    const userToday = DateTime.now().setZone(p.timezone).toISODate()!;
    if (targetStr !== userToday) continue;

    const dedupe_key =
      `rel:${w.user_id}:${content_id}:${media_type}:${release_date}:${offset}`;
    const isMovie = media_type === "movie";
    const movieWhen =
      offset === 0
        ? "is in theatres today (CA)"
        : offset === 1
        ? "opens in theatres tomorrow (CA)"
        : `opens in theatres in ${offset} days (CA)`;
    const tvWhen =
      offset === 0
        ? "premieres today (CA)"
        : offset === 1
        ? "premieres tomorrow (CA)"
        : `premieres in ${offset} days (CA)`;
    await tryInsertNotification(supabase, {
      user_id: w.user_id,
      title: isMovie ? `In theatres: ${title}` : `Premiere: ${title}`,
      message: isMovie
        ? `"${title}" ${movieWhen}.`
        : `"${title}" ${tvWhen}.`,
      link,
      dedupe_key,
    });
  }

  for (const wc of watchingCandidates) {
    const p = prefs[wc.user_id] ?? defaultPrefs;
    const wh = whMap.get(wc.id);
    const useGlobal = wh?.use_global_default !== false;
    const kind = (useGlobal
      ? p.default_reminder_kind
      : (wh?.reminder_kind ?? p.default_reminder_kind)) as ReminderKind;
    const custom = useGlobal
      ? p.custom_days_before
      : wh?.custom_days_before ?? p.custom_days_before;
    const offset = offsetDaysForKind(kind, custom);
    const target = releaseLuxon.minus({ days: offset });
    const targetStr = target.toISODate()!;
    const userToday = DateTime.now().setZone(p.timezone).toISODate()!;
    if (targetStr !== userToday) continue;

    const dedupe_key =
      `rel:${wc.user_id}:${content_id}:${media_type}:${release_date}:${offset}:w`;
    const epWhen =
      offset === 0
        ? "has a new episode airing today (CA)"
        : offset === 1
        ? "has a new episode airing tomorrow (CA)"
        : `has a new episode in ${offset} days (CA)`;
    await tryInsertNotification(supabase, {
      user_id: wc.user_id,
      title: `New episode: ${title}`,
      message: `"${title}" ${epWhen}.`,
      link,
      dedupe_key,
    });
  }
}

Deno.serve(async (req) => {
  edgeLog(FN, "request", { method: req.method });
  const authErr = assertCronAuthorized(req);
  if (authErr) {
    edgeLog(FN, "auth_failed", { hasCronSecret: !!Deno.env.get("CRON_SECRET") });
    return authErr;
  }
  edgeLog(FN, "auth_ok");

  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey) {
    edgeLog(FN, "missing_tmdb_key");
    return new Response(JSON.stringify({ error: "Missing TMDB_API_KEY" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = serviceClient();

    const { data: pending, error: qErr } = await supabase
      .from("series_sync_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(BATCH);

    if (qErr) throw qErr;

    edgeLog(FN, "queue_fetched", {
      pendingCount: (pending ?? []).length,
      batchLimit: BATCH,
      queueIds: (pending ?? []).map((r) => r.id),
    });

    let processed = 0;
    let failed = 0;

    for (const row of pending ?? []) {
      const { data: locked, error: lockErr } = await supabase
        .from("series_sync_queue")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
      if (lockErr || !locked) {
        edgeLog(FN, "lock_skipped", { queueId: row.id, lockErr: lockErr?.message });
        continue;
      }

      edgeLog(FN, "processing_row", {
        queueId: row.id,
        content_id: row.content_id,
        media_type: row.media_type,
      });

      try {
        let title: string;
        let release_date: string | null;
        let poster_path: string | null;

        if (row.media_type === "movie") {
          const m = await tmdbMovieCa(apiKey, row.content_id);
          title = m.title;
          release_date = m.release_date;
          poster_path = m.poster_path;
        } else {
          const t = await tmdbTvNextAir(apiKey, row.content_id);
          title = t.title;
          release_date = t.release_date;
          poster_path = t.poster_path;
        }

        const now = new Date().toISOString();
        const { error: upErr } = await supabase.from("release_cache").upsert(
          {
            content_id: row.content_id,
            media_type: row.media_type,
            title,
            release_date,
            poster_path,
            refreshed_at: now,
            tmdb_region: "CA",
            updated_at: now,
          },
          { onConflict: "content_id,media_type" },
        );
        if (upErr) throw upErr;

        await materializeForContent(
          supabase,
          row.content_id,
          row.media_type,
          title,
          release_date,
        );

        edgeLog(FN, "row_tmdb_ok", {
          queueId: row.id,
          title,
          release_date,
        });

        await supabase
          .from("series_sync_queue")
          .update({
            status: "done",
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        processed++;
      } catch (e) {
        edgeLog(FN, "row_failed", { queueId: row.id, err: String(e) });
        console.error(e);
        await supabase
          .from("series_sync_queue")
          .update({
            status: "failed",
            attempts: (row.attempts ?? 0) + 1,
            last_error: String(e).slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        failed++;
      }
    }

    const body = {
      ok: true,
      picked: (pending ?? []).length,
      processed,
      failed,
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
