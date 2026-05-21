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

/**
 * When to fire the in-app / push reminder for a user (UTC), given release instant and offset days.
 */
export function sendAtUtc(
  releaseAtUtcIso: string,
  userTimezone: string,
  offsetDays: number,
): string {
  const releaseLocal = DateTime.fromISO(releaseAtUtcIso, { zone: "utc" }).setZone(
    userTimezone,
  );
  const reminderLocal = releaseLocal
    .startOf("day")
    .minus({ days: offsetDays })
    .set({
      hour: REMINDER_DELIVERY_HOUR,
      minute: 0,
      second: 0,
      millisecond: 0,
    });
  return reminderLocal.toUTC().toISO()!;
}
