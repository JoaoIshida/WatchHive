import { DateTime } from "https://esm.sh/luxon@3.5.0";

/** Default region calendar zone when only a date (no airstamp) is known. */
export const DEFAULT_REGION_ZONE = "America/Toronto";

/** Local hour when release reminders are delivered (user timezone). */
export const REMINDER_DELIVERY_HOUR = 9;

export type AiringInput = {
  airstamp?: string | null;
  airdate?: string | null;
  /** YYYY-MM-DD from TMDB when no episode-level TVMaze row */
  tmdbDate?: string | null;
  regionCode?: string;
};

const REGION_ZONES: Record<string, string> = {
  CA: DEFAULT_REGION_ZONE,
};

function zoneForRegion(regionCode: string): string {
  return REGION_ZONES[regionCode] ?? DEFAULT_REGION_ZONE;
}

/**
 * Resolve a single UTC instant for when content releases / airs.
 * Prefer TVMaze airstamp, then calendar airdate in region TZ, then TMDB date.
 */
export function releaseAtUtc(input: AiringInput): string | null {
  const region = input.regionCode ?? "CA";
  const zone = zoneForRegion(region);

  if (input.airstamp) {
    const dt = DateTime.fromISO(input.airstamp, { zone: "utc" });
    if (dt.isValid) return dt.toUTC().toISO()!;
  }

  const dateStr = input.airdate ?? input.tmdbDate;
  if (dateStr && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const day = dateStr.slice(0, 10);
    const dt = DateTime.fromISO(day, { zone }).startOf("day");
    if (dt.isValid) return dt.toUTC().toISO()!;
  }

  return null;
}

/** A tz the runtime can't resolve would make toISO() null and abort the whole precompute run. */
export function safeZone(userTimezone: string | null | undefined): string {
  if (userTimezone && DateTime.utc().setZone(userTimezone).isValid) return userTimezone;
  return DEFAULT_REGION_ZONE;
}

/**
 * Date-only releases (no airstamp) are stored as midnight in the region zone. Converting that
 * instant into a zone west of Toronto lands on the previous day, so those are read as a calendar
 * date instead.
 * ponytail: midnight-Toronto is the date-only marker; a real airstamp at exactly 00:00 ET is read
 * as that calendar day too (harmless: same-day reminder). Add regional_airings.is_date_only if it matters.
 */
function releaseDayInZone(releaseAtUtcIso: string, zone: string): DateTime {
  const utc = DateTime.fromISO(releaseAtUtcIso, { zone: "utc" });
  const region = utc.setZone(DEFAULT_REGION_ZONE);
  if (region.hour === 0 && region.minute === 0 && region.second === 0) {
    return DateTime.fromObject(
      { year: region.year, month: region.month, day: region.day },
      { zone },
    );
  }
  return utc.setZone(zone).startOf("day");
}

/**
 * When to fire the in-app / push reminder for a user (UTC), given release instant and offset days.
 */
export function sendAtUtc(
  releaseAtUtcIso: string,
  userTimezone: string,
  offsetDays: number,
): string {
  const zone = safeZone(userTimezone);
  const reminderLocal = releaseDayInZone(releaseAtUtcIso, zone)
    .minus({ days: offsetDays })
    .set({
      hour: REMINDER_DELIVERY_HOUR,
      minute: 0,
      second: 0,
      millisecond: 0,
    });
  return reminderLocal.toUTC().toISO()!;
}

/** User's local calendar date of the release (for grouping same-day drops). */
export function releaseLocalDate(releaseAtUtcIso: string, userTimezone: string): string {
  return releaseDayInZone(releaseAtUtcIso, safeZone(userTimezone)).toISODate()!;
}

/**
 * True when the reminder's local day is already over. Such a reminder would fire immediately with
 * stale copy ("in 7 days" two days before release), so it is skipped. A reminder due earlier
 * today still sends (late "airing today" is still right).
 */
export function isSendDayPast(sendAtUtcIso: string, userTimezone: string, now = DateTime.utc()): boolean {
  const zone = safeZone(userTimezone);
  const sendDay = DateTime.fromISO(sendAtUtcIso, { zone: "utc" }).setZone(zone).startOf("day");
  return sendDay < now.setZone(zone).startOf("day");
}
