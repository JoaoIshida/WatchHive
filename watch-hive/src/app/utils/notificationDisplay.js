const TYPE_LABELS = {
  new_episodes: 'Episode update',
  catalog_expanded: 'Guide update',
  series_catchup: 'Catch up',
  release_reminder: 'Release reminder',
  friend_request: 'Friend request',
};

function titleCaseFromSnake(s) {
  return s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function notificationTypeLabel(type) {
  if (!type) return '';
  return TYPE_LABELS[type] || titleCaseFromSnake(type);
}

/** Date only, localized, no time — for notification feed. */
export function formatNotificationDate(iso, locale) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(locale || undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
