/** Fallback when Intl.supportedValuesOf('timeZone') is unavailable. */
export const COMMON_TIME_ZONES = [
  'America/Toronto',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Vancouver',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Amsterdam',
  'Europe/Warsaw',
  'Europe/Athens',
  'Europe/Moscow',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Pacific/Auckland',
  'UTC',
];

export function getSortedTimeZones() {
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function') {
      return Intl.supportedValuesOf('timeZone').slice().sort((a, b) => a.localeCompare(b));
    }
  } catch {
    /* ignore */
  }
  return COMMON_TIME_ZONES.slice();
}

/** Current wall-clock time in that IANA zone (for picker labels). */
export function formatTimeInZone(iana, locale, now = new Date()) {
  try {
    return new Intl.DateTimeFormat(locale || undefined, {
      timeZone: iana,
      hour: 'numeric',
      minute: '2-digit',
    }).format(now);
  } catch {
    return '';
  }
}

/**
 * Short zone name for the given instant (e.g. PST, EDT, GMT+1).
 * Varies by locale and DST; useful for search and quick recognition.
 */
export function formatTimeZoneAbbreviation(iana, locale, now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat(locale || undefined, {
      timeZone: iana,
      timeZoneName: 'short',
    }).formatToParts(now);
    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    return tzPart?.value?.trim() || '';
  } catch {
    return '';
  }
}

export function timezoneOptionLabel(iana, locale, now = new Date()) {
  const name = iana.replace(/_/g, ' ');
  const time = formatTimeInZone(iana, locale, now);
  const abbr = formatTimeZoneAbbreviation(iana, locale, now);
  if (time && abbr) return `${name} · ${time} (${abbr})`;
  if (time) return `${name} · ${time}`;
  if (abbr) return `${name} (${abbr})`;
  return name;
}
