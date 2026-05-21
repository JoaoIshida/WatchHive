-- pg_cron jobs for precomputed release notifications (project sweeiqvuedrrsbihjwfl).
-- Replace <CRON_SECRET> with the Edge Functions secret value before running.
-- Requires extensions: pg_cron, pg_net (enabled on hosted Supabase).

-- Ingest TVMaze/TMDB airings into regional_airings (every 3h UTC)
SELECT cron.schedule(
  'ingest_regional_airings',
  '0 */3 * * *',
  $$
    SELECT net.http_post(
      url := 'https://sweeiqvuedrrsbihjwfl.supabase.co/functions/v1/ingest_regional_airings',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', '<CRON_SECRET>'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Precompute notification_queue rows (30 min after ingest)
SELECT cron.schedule(
  'precompute_release_notifications',
  '30 */3 * * *',
  $$
    SELECT net.http_post(
      url := 'https://sweeiqvuedrrsbihjwfl.supabase.co/functions/v1/precompute_release_notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', '<CRON_SECRET>'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Materialize due queue rows into notifications (every 15 min)
SELECT cron.schedule(
  'dispatch_notification_queue',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://sweeiqvuedrrsbihjwfl.supabase.co/functions/v1/dispatch_notification_queue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', '<CRON_SECRET>'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Optional: hourly web push (replaces once-daily if you unschedule the old job)
-- SELECT cron.schedule(
--   'daily_push_dispatcher_hourly',
--   '0 * * * *',
--   $$
--     SELECT net.http_post(
--       url := 'https://sweeiqvuedrrsbihjwfl.supabase.co/functions/v1/daily_push_dispatcher',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'x-cron-secret', '<CRON_SECRET>'
--       ),
--       body := '{}'::jsonb
--     );
--   $$
-- );
