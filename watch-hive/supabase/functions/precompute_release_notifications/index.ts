import { DateTime } from "https://esm.sh/luxon@3.5.0";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { assertCronAuthorized } from "../_shared/cron-auth.ts";
import { sendAtUtc } from "../_shared/airingTime.ts";
import { edgeLog } from "../_shared/edgeLog.ts";
import {
  defaultReminderPrefs,
  loadReminderPrefs,
  type UserReminderPrefs,
} from "../_shared/notificationPrefs.ts";
import {
  buildWatchingEpisodeCopy,
  buildWishlistReleaseCopyWithLink,
  releaseKeyForEpisode,
  releaseKeyForMovie,
  watchingDedupeKey,
  wishlistDedupeKey,
} from "../_shared/releaseNotifyCopy.ts";
import {
  MAX_REMINDER_OFFSET_DAYS,
  offsetDaysForKind,
  type ReminderKind,
} from "../_shared/reminders.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { resolveContentTitle } from "../_shared/releaseCacheTitle.ts";

const FN = "precompute_release_notifications";
const REGION = "CA";
const VALID_REMINDER_KINDS = new Set<string>([
  "release_day",
  "one_day_before",
  "one_week_before",
  "custom",
]);

type AiringRow = {
  id: string;
  show_id: number | null;
  episode_id: string | null;
  content_id: number | null;
  media_type: "movie" | "tv" | null;
  release_at_utc: string;
  catalog_episodes?: {
    season_number: number;
    episode_number: number;
  } | null;
};

Deno.serve(async (req) => {
  edgeLog(FN, "request", { method: req.method });
  const authErr = assertCronAuthorized(req);
  if (authErr) return authErr;

  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing TMDB_API_KEY" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = serviceClient();
    const now = DateTime.utc();
    const windowStart = now.minus({ days: 1 }).toISO()!;
    const windowEnd = now.plus({ days: MAX_REMINDER_OFFSET_DAYS + 2 }).toISO()!;

    const { data: airings, error: aErr } = await supabase
      .from("regional_airings")
      .select(
        "id, show_id, episode_id, content_id, media_type, release_at_utc, catalog_episodes(season_number, episode_number)",
      )
      .eq("region_code", REGION)
      .gte("release_at_utc", windowStart)
      .lte("release_at_utc", windowEnd);
    if (aErr) throw aErr;

    let queued = 0;
    let updated = 0;
    let skipped = 0;

    for (const airing of (airings ?? []) as AiringRow[]) {
      const title = await resolveTitle(supabase, apiKey, airing);
      if (!title) {
        skipped++;
        continue;
      }

      if (airing.media_type === "movie" && airing.content_id) {
        const r = await precomputeMovie(
          supabase,
          airing.content_id,
          title,
          airing.release_at_utc,
        );
        queued += r.queued;
        updated += r.updated;
        continue;
      }

      if (airing.show_id && airing.episode_id && airing.catalog_episodes) {
        const r = await precomputeTvEpisode(
          supabase,
          airing.show_id,
          airing.catalog_episodes.season_number,
          airing.catalog_episodes.episode_number,
          title,
          airing.release_at_utc,
        );
        queued += r.queued;
        updated += r.updated;
      }
    }

    const body = { ok: true, airings: (airings ?? []).length, queued, updated, skipped };
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

async function resolveTitle(
  supabase: SupabaseClient,
  apiKey: string,
  airing: AiringRow,
): Promise<string | null> {
  const contentId = airing.content_id ?? airing.show_id;
  const mediaType = airing.media_type ?? (airing.show_id ? "tv" : null);
  if (!contentId || !mediaType) return null;
  return resolveContentTitle(supabase, apiKey, contentId, mediaType);
}

async function precomputeMovie(
  supabase: SupabaseClient,
  contentId: number,
  title: string,
  releaseAtUtcIso: string,
) {
  const { data: wishRows } = await supabase
    .from("wishlist")
    .select("id, user_id")
    .eq("content_id", contentId)
    .eq("media_type", "movie");
  return precomputeWishlistUsers(
    supabase,
    wishRows ?? [],
    contentId,
    "movie",
    title,
    releaseAtUtcIso,
    releaseKeyForMovie(releaseAtUtcIso.slice(0, 10)),
    `/movies/${contentId}`,
  );
}

async function precomputeTvEpisode(
  supabase: SupabaseClient,
  showId: number,
  season: number,
  episode: number,
  title: string,
  releaseAtUtcIso: string,
) {
  const releaseKey = releaseKeyForEpisode(season, episode, releaseAtUtcIso);
  const link = `/series/${showId}`;

  let queued = 0;
  let updated = 0;

  const { data: wishRows } = await supabase
    .from("wishlist")
    .select("id, user_id")
    .eq("content_id", showId)
    .eq("media_type", "tv");
  const w = await precomputeWishlistUsers(
    supabase,
    wishRows ?? [],
    showId,
    "tv",
    title,
    releaseAtUtcIso,
    releaseKey,
    link,
  );
  queued += w.queued;
  updated += w.updated;

  const { data: watchedRows } = await supabase
    .from("watched_content")
    .select("id, user_id")
    .eq("content_id", showId)
    .eq("media_type", "tv");

  const { data: progressRows } = await supabase
    .from("series_progress")
    .select("user_id, completed")
    .eq("series_id", showId);
  const progressByUser = new Map(
    (progressRows ?? []).map((p) => [p.user_id, p]),
  );

  const watchingCandidates: { id: string; user_id: string }[] = [];
  for (const wc of watchedRows ?? []) {
    const prog = progressByUser.get(wc.user_id);
    if (!prog) continue;
    if (prog.completed && !releaseAtUtcIso) continue;
    watchingCandidates.push({ id: wc.id, user_id: wc.user_id });
  }

  const userIds = [...new Set(watchingCandidates.map((c) => c.user_id))];
  const prefs = await loadReminderPrefs(supabase, userIds);

  let whMap = new Map<
    string,
    {
      use_global_default: boolean;
      reminder_kind: ReminderKind | null;
      custom_days_before: number | null;
    }
  >();
  if (watchingCandidates.length) {
    const { data: wh } = await supabase
      .from("watching_reminders")
      .select(
        "watched_content_id, use_global_default, reminder_kind, custom_days_before",
      )
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

  for (const wc of watchingCandidates) {
    const p = prefs[wc.user_id] ?? defaultReminderPrefs;
    const wh = whMap.get(wc.id);
    const kinds = reminderKindsForRow(p, wh);
    const custom = customDaysForRow(p, wh);
    const seenOffsets = new Set<number>();

    for (const kind of kinds) {
      if (!VALID_REMINDER_KINDS.has(kind)) continue;
      const offset = offsetDaysForKind(kind, custom);
      if (seenOffsets.has(offset)) continue;
      seenOffsets.add(offset);

      const send = sendAtUtc(releaseAtUtcIso, p.timezone, offset);
      const dedupe = watchingDedupeKey(wc.user_id, showId, releaseKey, offset);
      const payload = buildWatchingEpisodeCopy(title, offset, link);
      const r = await upsertQueueRow(supabase, wc.user_id, send, dedupe, payload);
      if (r === "inserted") queued++;
      else if (r === "updated") updated++;
    }
  }

  return { queued, updated };
}

async function precomputeWishlistUsers(
  supabase: SupabaseClient,
  wishRows: { id: string; user_id: string }[],
  contentId: number,
  mediaType: "movie" | "tv",
  title: string,
  releaseAtUtcIso: string,
  releaseKey: string,
  link: string,
) {
  const wishlistIds = wishRows.map((w) => w.id);
  let wrMap = new Map<
    string,
    {
      use_global_default: boolean;
      reminder_kind: ReminderKind | null;
      custom_days_before: number | null;
    }
  >();
  if (wishlistIds.length) {
    const { data: wr } = await supabase
      .from("wishlist_reminders")
      .select(
        "wishlist_id, use_global_default, reminder_kind, custom_days_before",
      )
      .in("wishlist_id", wishlistIds);
    for (const r of wr ?? []) {
      wrMap.set(r.wishlist_id, {
        use_global_default: r.use_global_default,
        reminder_kind: r.reminder_kind as ReminderKind | null,
        custom_days_before: r.custom_days_before,
      });
    }
  }

  const userIds = [...new Set(wishRows.map((w) => w.user_id))];
  const prefs = await loadReminderPrefs(supabase, userIds);
  let queued = 0;
  let updated = 0;

  for (const w of wishRows) {
    const p = prefs[w.user_id] ?? defaultReminderPrefs;
    const wr = wrMap.get(w.id);
    const kinds = reminderKindsForRow(p, wr);
    const custom = customDaysForRow(p, wr);
    const seenOffsets = new Set<number>();

    for (const kind of kinds) {
      if (!VALID_REMINDER_KINDS.has(kind)) continue;
      const offset = offsetDaysForKind(kind, custom);
      if (seenOffsets.has(offset)) continue;
      seenOffsets.add(offset);

      const send = sendAtUtc(releaseAtUtcIso, p.timezone, offset);
      const dedupe = wishlistDedupeKey(
        w.user_id,
        contentId,
        mediaType,
        releaseKey,
        offset,
      );
      const payload = buildWishlistReleaseCopyWithLink(
        title,
        mediaType,
        offset,
        link,
      );
      const r = await upsertQueueRow(supabase, w.user_id, send, dedupe, payload);
      if (r === "inserted") queued++;
      else if (r === "updated") updated++;
    }
  }
  return { queued, updated };
}

function reminderKindsForRow(
  p: UserReminderPrefs,
  override?: {
    use_global_default: boolean;
    reminder_kind: ReminderKind | null;
    custom_days_before: number | null;
  } | null,
): ReminderKind[] {
  const useGlobal = override?.use_global_default !== false;
  if (useGlobal) return p.default_reminder_kinds;
  return [(override?.reminder_kind ?? p.default_reminder_kind) as ReminderKind];
}

function customDaysForRow(
  p: UserReminderPrefs,
  override?: {
    use_global_default: boolean;
    custom_days_before: number | null;
  } | null,
): number | null {
  const useGlobal = override?.use_global_default !== false;
  return useGlobal
    ? p.custom_days_before
    : override?.custom_days_before ?? p.custom_days_before;
}

async function upsertQueueRow(
  supabase: SupabaseClient,
  userId: string,
  sendAtUtcIso: string,
  dedupeKey: string,
  payload: { title: string; message: string; link: string },
): Promise<"inserted" | "updated" | "skipped"> {
  const { error: insErr } = await supabase.from("notification_queue").insert({
    user_id: userId,
    type: "release_reminder",
    send_at_utc: sendAtUtcIso,
    dedupe_key: dedupeKey,
    payload,
    status: "pending",
  });
  if (!insErr) return "inserted";
  if (insErr.code !== "23505") throw insErr;

  const { data: existing } = await supabase
    .from("notification_queue")
    .select("id, status, send_at_utc")
    .eq("user_id", userId)
    .eq("dedupe_key", dedupeKey)
    .in("status", ["pending", "materialized"])
    .maybeSingle();

  if (!existing || existing.status !== "pending") return "skipped";

  await supabase
    .from("notification_queue")
    .update({
      send_at_utc: sendAtUtcIso,
      payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);
  return "updated";
}
