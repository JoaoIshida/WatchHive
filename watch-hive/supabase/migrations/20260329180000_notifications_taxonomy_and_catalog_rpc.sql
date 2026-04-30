-- Notifications: per-category push prefs, friend-request notify throttle rename/column,
-- catalog refresh RPC (all series_progress, not only watched_content).
-- Safe to re-run: guards where needed.

-- 1) notification_preferences — push category toggles
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS push_friends BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS push_catchup BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS push_releases BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.notification_preferences.push_friends IS
  'Web Push for friend_request (master push_enabled must be true)';
COMMENT ON COLUMN public.notification_preferences.push_catchup IS
  'Web Push for series_catchup weekly nudges';
COMMENT ON COLUMN public.notification_preferences.push_releases IS
  'Web Push for release_reminder and catalog_expanded';

-- 2) friend_request_push_throttle → friend_request_notify_throttle, last_push_at → last_notified_at
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'friend_request_push_throttle'
  )
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'friend_request_notify_throttle'
  ) THEN
    ALTER TABLE public.friend_request_push_throttle RENAME TO friend_request_notify_throttle;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'friend_request_notify_throttle'
      AND column_name = 'last_push_at'
  ) THEN
    ALTER TABLE public.friend_request_notify_throttle
      RENAME COLUMN last_push_at TO last_notified_at;
  END IF;
END $$;

COMMENT ON TABLE public.friend_request_notify_throttle IS
  'Last friend-request in-app or Web Push notification per sender/receiver pair (1h throttle).';

-- 3) Catalog Edge job: distinct series_id from series_progress only
CREATE OR REPLACE FUNCTION public.series_ids_for_catalog_refresh(p_limit INTEGER DEFAULT 40)
RETURNS TABLE (series_id INTEGER)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sp.series_id
  FROM series_progress sp
  GROUP BY sp.series_id
  ORDER BY MIN(sp.catalog_refreshed_at) ASC NULLS FIRST
  LIMIT COALESCE(p_limit, 40);
$$;

COMMENT ON FUNCTION public.series_ids_for_catalog_refresh(INTEGER) IS
  'Distinct series_id from series_progress; stalest catalog_refreshed_at first for refresh_series_progress_catalog Edge job';

GRANT EXECUTE ON FUNCTION public.series_ids_for_catalog_refresh(INTEGER) TO service_role;

COMMENT ON COLUMN public.notifications.type IS
  'Types: friend_request, release_reminder, catalog_expanded, series_catchup, new_episodes (legacy), etc.';

-- ---------------------------------------------------------------------------
-- OPTIONAL: backfill watched_content for users with progress but no watched row
-- (run only if you still have catalog_total_episodes NULL / missing watched rows)
-- ---------------------------------------------------------------------------
-- INSERT INTO watched_content (user_id, content_id, media_type, date_watched, times_watched)
-- SELECT
--   sp.user_id,
--   sp.series_id,
--   'tv'::media_type,
--   COALESCE(sp.last_watched, sp.updated_at, NOW()),
--   1
-- FROM series_progress sp
-- WHERE (
--   sp.completed = TRUE
--   OR EXISTS (
--     SELECT 1 FROM series_seasons ss
--     JOIN series_episodes se ON se.series_season_id = ss.id
--     WHERE ss.series_progress_id = sp.id
--   )
-- )
-- AND NOT EXISTS (
--   SELECT 1 FROM watched_content wc
--   WHERE wc.user_id = sp.user_id
--     AND wc.content_id = sp.series_id
--     AND wc.media_type = 'tv'
-- )
-- ON CONFLICT (user_id, content_id, media_type) DO NOTHING;
--
-- INSERT INTO watching_reminders (watched_content_id, use_global_default)
-- SELECT wc.id, TRUE
-- FROM watched_content wc
-- WHERE wc.media_type = 'tv'
--   AND NOT EXISTS (
--     SELECT 1 FROM watching_reminders wr
--     WHERE wr.watched_content_id = wc.id
--   )
-- ON CONFLICT (watched_content_id) DO NOTHING;
