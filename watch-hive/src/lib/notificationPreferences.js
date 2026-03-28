/** Valid reminder_kind values stored in default_reminder_kinds (text[]). */
export const REMINDER_KIND_VALUES = [
  'one_week_before',
  'one_day_before',
  'release_day',
  'custom',
];

const KIND_SET = new Set(REMINDER_KIND_VALUES);

/** Pick one legacy enum value for default_reminder_kind (Edge / old readers). */
export function legacyDefaultReminderKind(kinds) {
  const list = Array.isArray(kinds) ? kinds.filter((k) => KIND_SET.has(k)) : [];
  if (list.length === 0) return 'release_day';
  const priority = ['one_week_before', 'one_day_before', 'release_day', 'custom'];
  for (const p of priority) {
    if (list.includes(p)) return p;
  }
  return list[0];
}

export function normalizeReminderKindsInput(value) {
  if (!Array.isArray(value)) return null;
  const out = [...new Set(value.filter((k) => KIND_SET.has(k)))];
  return out.length ? out : null;
}

export function validateReminderKindsAndCustom(kinds, customDaysBefore) {
  if (!kinds?.length) {
    return { ok: false, error: 'Select at least one reminder option.' };
  }
  if (kinds.includes('custom')) {
    const n = Number(customDaysBefore);
    if (n < 1 || n > 30) {
      return { ok: false, error: 'Custom reminder needs a number of days between 1 and 30.' };
    }
  }
  return { ok: true };
}
