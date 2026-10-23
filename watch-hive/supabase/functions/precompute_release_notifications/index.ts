import { DateTime } from "https://esm.sh/luxon@3.5.0";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { assertCronAuthorized } from "../_shared/cron-auth.ts";
import { isSendDayPast, releaseLocalDate, sendAtUtc } from "../_shared/airingTime.ts";
import { edgeLog } from "../_shared/edgeLog.ts";
import {
  defaultReminderPrefs,
  loadReminderPrefs,
  type UserReminderPrefs,
} from "../_shared/notificationPrefs.ts";
import {
  buildWatchingEpisodeCopy,
  buildWishlistReleaseCopyWithLink,
  parseReleaseDedupeKey,
  releaseKeyForEpisode,
  releaseKeyForMovie,
  releaseKeyForWishlistTv,
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

type ReminderOverride = {
  use_global_default: boolean;
  reminder_kind: ReminderKind | null;
  custom_days_before: number | null;
};

type Counts = { queued: number; updated: number };

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

    const totals: Counts = { queued: 0, updated: 0 };
    let skipped = 0;
    let removedStale = 0;
    const add = (r: Counts) => {
      totals.queued += r.queued;
      totals.updated += r.updated;
    };

    const rows = (airings ?? []) as AiringRow[];
    const tvByShow = new Map<number, AiringRow[]>();

    for (const airing of rows) {
      if (airing.media_type === "movie" && airing.content_id) {
        const title = await resolveTitle(supabase, apiKey, airing);
        if (!title) {
          skipped++;
          edgeLog(FN, "skip_no_title", {
            content_id: airing.content_id,
            media_type: "movie",
          });
          continue;
        }
        const keep = new Set<string>();
        add(await precomputeMovie(supabase, airing.content_id, title, airing.release_at_utc, now, keep));
        removedStale += await deleteStalePending(supabase, airing.content_id, "movie", keep);
        continue;
      }

      if (airing.show_id && airing.episode_id && airing.catalog_episodes) {
        const list = tvByShow.get(airing.show_id) ?? [];
        list.push(airing);
        tvByShow.set(airing.show_id, list);
      }
    }

    for (const [showId, showAirings] of tvByShow) {
      showAirings.sort((a, b) =>
        a.release_at_utc.localeCompare(b.release_at_utc)
      );
      const title = await resolveTitle(supabase, apiKey, showAirings[0]);
      if (!title) {
        skipped += showAirings.length;
        edgeLog(FN, "skip_no_title", { show_id: showId, media_type: "tv" });
        continue;
      }

      const keep = new Set<string>();
      // Wishlist "Premiere" only for a season premiere; mid-season airings used to re-announce
      // the show as a premiere every week.
      const premiere = showAirings.find((a) => a.catalog_episodes!.episode_number === 1);
      if (premiere) {
        add(
          await precomputeWishlistTvShow(
            supabase,
            showId,
            title,
            premiere.release_at_utc,
            premiere.catalog_episodes!.season_number,
            now,
            keep,
          ),
        );
      }
      add(await precomputeWatchingShow(supabase, showId, title, showAirings, now, keep));
      removedStale += await deleteStalePending(supabase, showId, "tv", keep);
    }

    const body = {
      ok: true,
      airings: rows.length,
      queued: totals.queued,
      updated: totals.updated,
      removedStale,
      skipped,
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

/**
 * Pending rows for this title that this run did not regenerate are stale: the item left the
 * wishlist / watched list, the user changed reminder offsets, or the release moved.
 */
async function deleteStalePending(
  supabase: SupabaseClient,
  contentId: number,
  mediaType: "movie" | "tv",
  keep: Set<string>,
): Promise<number> {
  const { data, error } = await supabase
    .from("notification_queue")
    .select("id, dedupe_key")
    .eq("status", "pending")
    .like("dedupe_key", `rel:%:${contentId}:${mediaType}:%`);
  if (error) throw error;
  const stale = (data ?? [])
    .filter((r) => {
      const k = parseReleaseDedupeKey(r.dedupe_key);
      return k?.contentId === contentId && k.mediaType === mediaType && !keep.has(r.dedupe_key);
    })
    .map((r) => r.id);
  if (stale.length === 0) return 0;
  const { error: delErr } = await supabase.from("notification_queue").delete().in("id", stale);
  if (delErr) throw delErr;
  return stale.length;
}

async function precomputeMovie(
  supabase: SupabaseClient,
  contentId: number,
  title: string,
  releaseAtUtcIso: string,
  now: DateTime,
  keep: Set<string>,
) {
  const { data: wishRows, error } = await supabase
    .from("wishlist")
    .select("id, user_id")
    .eq("content_id", contentId)
    .eq("media_type", "movie");
  if (error) throw error;
  return precomputeWishlistUsers(
    supabase,
    wishRows ?? [],
    contentId,
    "movie",
    title,
    releaseAtUtcIso,
    releaseKeyForMovie(),
    `/movies/${contentId}`,
    now,
    keep,
  );
}

async function precomputeWishlistTvShow(
  supabase: SupabaseClient,
  showId: number,
  title: string,
  releaseAtUtcIso: string,
  season: number,
  now: DateTime,
  keep: Set<string>,
) {
  const { data: wishRows, error } = await supabase
    .from("wishlist")
    .select("id, user_id")
    .eq("content_id", showId)
    .eq("media_type", "tv");
  if (error) throw error;

  return precomputeWishlistUsers(
    supabase,
    wishRows ?? [],
    showId,
    "tv",
    title,
    releaseAtUtcIso,
    releaseKeyForWishlistTv(showId, season),
    `/series/${showId}`,
    now,
    keep,
  );
}

/**
 * Watching reminders for every user tracking the show. Airings that land on the same local day
 * (a streaming drop) become one reminder ("3 new episodes"), keyed by that day's first episode.
 */
async function precomputeWatchingShow(
  supabase: SupabaseClient,
  showId: number,
  title: string,
  airings: AiringRow[],
  now: DateTime,
  keep: Set<string>,
) {
  const link = `/series/${showId}`;
  let queued = 0;
  let updated = 0;

  const { data: watchedRows, error: wErr } = await supabase
    .from("watched_content")
    .select("id, user_id")
    .eq("content_id", showId)
    .eq("media_type", "tv");
  if (wErr) throw wErr;

  const { data: progressRows, error: pErr } = await supabase
    .from("series_progress")
    .select("user_id")
    .eq("series_id", showId);
  if (pErr) throw pErr;
  const tracking = new Set((progressRows ?? []).map((p) => p.user_id));

  const candidates = (watchedRows ?? []).filter((wc) => tracking.has(wc.user_id));
  const prefs = await loadReminderPrefs(
    supabase,
    [...new Set(candidates.map((c) => c.user_id))],
  );

  const whMap = new Map<string, ReminderOverride>();
  if (candidates.length) {
    const { data: wh, error } = await supabase
      .from("watching_reminders")
      .select(
        "watched_content_id, use_global_default, reminder_kind, custom_days_before",
      )
      .in("watched_content_id", candidates.map((c) => c.id));
    if (error) throw error;
    for (const r of wh ?? []) {
      whMap.set(r.watched_content_id, {
        use_global_default: r.use_global_default,
        reminder_kind: r.reminder_kind as ReminderKind | null,
        custom_days_before: r.custom_days_before,
      });
    }
  }

  for (const wc of candidates) {
    const p = prefs[wc.user_id] ?? defaultReminderPrefs;
    const wh = whMap.get(wc.id);
    const offsets = offsetsForRow(p, wh);

    const byDay = new Map<string, AiringRow[]>();
    for (const a of airings) {
      const day = releaseLocalDate(a.release_at_utc, p.timezone);
      const list = byDay.get(day) ?? [];
      list.push(a);
      byDay.set(day, list);
    }

    for (const group of byDay.values()) {
      const first = group[0];
      const ep = first.catalog_episodes!;
      const releaseKey = releaseKeyForEpisode(ep.season_number, ep.episode_number);
      for (const offset of offsets) {
        const send = sendAtUtc(first.release_at_utc, p.timezone, offset);
        if (isSendDayPast(send, p.timezone, now)) continue;
        const dedupe = watchingDedupeKey(wc.user_id, showId, releaseKey, offset);
        keep.add(dedupe);
        const payload = buildWatchingEpisodeCopy(title, offset, link, group.length);
        const r = await upsertQueueRow(supabase, wc.user_id, send, dedupe, payload);
        if (r === "inserted") queued++;
        else if (r === "updated") updated++;
      }
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
  now: DateTime,
  keep: Set<string>,
) {
  const wishlistIds = wishRows.map((w) => w.id);
  const wrMap = new Map<string, ReminderOverride>();
  if (wishlistIds.length) {
    const { data: wr, error } = await supabase
      .from("wishlist_reminders")
      .select(
        "wishlist_id, use_global_default, reminder_kind, custom_days_before",
      )
      .in("wishlist_id", wishlistIds);
    if (error) throw error;
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
    for (const offset of offsetsForRow(p, wrMap.get(w.id))) {
      const send = sendAtUtc(releaseAtUtcIso, p.timezone, offset);
      if (isSendDayPast(send, p.timezone, now)) continue;
      const dedupe = wishlistDedupeKey(
        w.user_id,
        contentId,
        mediaType,
        releaseKey,
        offset,
      );
      keep.add(dedupe);
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

/** Distinct reminder offsets (days before release) for a row, honoring a per-title override. */
function offsetsForRow(p: UserReminderPrefs, override?: ReminderOverride | null): number[] {
  const useGlobal = override?.use_global_default !== false;
  const kinds: ReminderKind[] = useGlobal
    ? p.default_reminder_kinds
    : [(override?.reminder_kind ?? p.default_reminder_kind) as ReminderKind];
  const custom = useGlobal
    ? p.custom_days_before
    : override?.custom_days_before ?? p.custom_days_before;
  const offsets = new Set<number>();
  for (const kind of kinds) {
    if (VALID_REMINDER_KINDS.has(kind)) offsets.add(offsetDaysForKind(kind, custom));
  }
  return [...offsets];
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

  const { data: existing, error: selErr } = await supabase
    .from("notification_queue")
    .select("id, status, send_at_utc")
    .eq("user_id", userId)
    .eq("dedupe_key", dedupeKey)
    .in("status", ["pending", "materialized"])
    .maybeSingle();
  if (selErr) throw selErr;

  if (!existing || existing.status !== "pending") return "skipped";

  const { error: upErr } = await supabase
    .from("notification_queue")
    .update({
      send_at_utc: sendAtUtcIso,
      payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);
  if (upErr) throw upErr;
  return "updated";
}
