import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  type ReminderKind,
} from "./reminders.ts";

const VALID_REMINDER_KINDS = new Set<string>([
  "release_day",
  "one_day_before",
  "one_week_before",
  "custom",
]);

export type UserReminderPrefs = {
  timezone: string;
  default_reminder_kind: ReminderKind;
  default_reminder_kinds: ReminderKind[];
  custom_days_before: number | null;
};

export const defaultReminderPrefs: UserReminderPrefs = {
  timezone: "America/Toronto",
  default_reminder_kind: "release_day",
  default_reminder_kinds: ["release_day"],
  custom_days_before: null,
};

function normalizeReminderKindsFromRow(row: {
  default_reminder_kinds?: unknown;
  default_reminder_kind?: string | null;
}): ReminderKind[] {
  const raw = row.default_reminder_kinds;
  if (Array.isArray(raw) && raw.length > 0) {
    const uniq: ReminderKind[] = [];
    const seen = new Set<string>();
    for (const k of raw) {
      const s = typeof k === "string" ? k : "";
      if (!VALID_REMINDER_KINDS.has(s) || seen.has(s)) continue;
      seen.add(s);
      uniq.push(s as ReminderKind);
    }
    if (uniq.length > 0) return uniq;
  }
  const one = row.default_reminder_kind;
  if (typeof one === "string" && VALID_REMINDER_KINDS.has(one)) {
    return [one as ReminderKind];
  }
  return [...defaultReminderPrefs.default_reminder_kinds];
}

export async function loadReminderPrefs(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Record<string, UserReminderPrefs>> {
  const out: Record<string, UserReminderPrefs> = {};
  if (userIds.length === 0) return out;
  const { data } = await supabase
    .from("notification_preferences")
    .select(
      "user_id, timezone, default_reminder_kind, default_reminder_kinds, custom_days_before",
    )
    .in("user_id", userIds);
  for (const row of data ?? []) {
    const kinds = normalizeReminderKindsFromRow(row);
    out[row.user_id] = {
      timezone: row.timezone || defaultReminderPrefs.timezone,
      default_reminder_kind: (row.default_reminder_kind ||
        kinds[0] ||
        defaultReminderPrefs.default_reminder_kind) as ReminderKind,
      default_reminder_kinds: kinds,
      custom_days_before: row.custom_days_before,
    };
  }
  return out;
}
