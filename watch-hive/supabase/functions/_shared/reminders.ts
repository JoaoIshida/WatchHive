export type ReminderKind =
  | "release_day"
  | "one_day_before"
  | "one_week_before"
  | "custom";

/** Largest offset used when scanning release_cache for daily reminder materialization. */
export const MAX_REMINDER_OFFSET_DAYS = 30;

export function offsetDaysForKind(
  kind: ReminderKind,
  customDays: number | null,
): number {
  switch (kind) {
    case "release_day":
      return 0;
    case "one_day_before":
      return 1;
    case "one_week_before":
      return 7;
    case "custom":
      return Math.min(30, Math.max(1, customDays ?? 3));
    default:
      return 0;
  }
}
