# WatchHive (app)

This folder is the **Next.js** application. For a full intro (including testing on your phone over Wi‑Fi), start at the **[root README](../README.md)**.

Quick commands from **this** directory:

```bash
npm install
npm run dev          # http://localhost:3000 — this computer only
npm run host         # same, but reachable at http://<your-LAN-IPv4>:3000 on Wi‑Fi
```

On Windows, your LAN IPv4 addresses:

```bash
ipconfig | findstr /R /C:"IPv4"
```

See also: [Next.js documentation](https://nextjs.org/docs).

## Supabase Edge (cron)

Schedule **`weekly_series_catchup_notifications`** weekly (e.g. Sunday) with the same `CRON_SECRET` header as your other jobs. It inserts `series_catchup` notifications for in-progress series where the user is behind TMDB’s episode count (deduped per ISO week).

### Push notifications (cron pipeline)

Daily PT-anchored pipeline (UTC schedules in parens):

| PT (PDT) | UTC cron | Job | Role |
|----------|----------|-----|------|
| 00:00 | `0 7 * * *`  | `series-catalog-daily` (`refresh_series_progress_catalog`) | Refresh TMDB catalog totals; insert `catalog_expanded` rows when episode count grew while user is behind. |
| 01:00 | `0 8 * * *`  | `enqueue_release_sync_candidates` | Fill `series_sync_queue` from `wishlist` + in-progress TV. |
| 01:30 | `30 8 * * *` | `process_series_sync_queue` | Drain queue, refresh `release_cache`, insert `release_reminder` rows on the user's reminder day. |
| 02:00 | `0 9 * * *`  | **`daily_push_dispatcher`** | Group each user's pending rows into ONE aggregated web push, mark them `push_sent_at`. |

The 02:00 PT slot used to call `send_due_notifications` (one push per pending row → noisy when a user has multiple events the same day). The new `daily_push_dispatcher` keeps the same in-app rows (the feed is unchanged) and replaces only the push step:

- 1 row → reuses that row's title/message/link (single-event UX preserved).
- All rows for the same series → `"<Series> - N new episodes"` (or `"New season of <Series>"` when a `catalog_expanded` row is in the bundle).
- Multiple distinct titles → `"X new titles available"`, tap opens `/profile/notifications`.
- Payload includes `tag: wh-daily-<YYYY-MM-DD>` + `renotify: true` so the OS replaces yesterday's WatchHive push instead of stacking. The service worker (`public/sw.js`) honours these.

#### Deploy

```bash
supabase functions deploy daily_push_dispatcher
```

Required Edge secrets (already in use by `send_due_notifications`): `CRON_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, optional `VAPID_SUBJECT`. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected.

#### Swap the 02:00 PT cron job

In Supabase SQL editor (or Dashboard → Database → Cron):

```sql
-- Find the existing job
select jobid, jobname, schedule, command from cron.job where jobname = 'send_due_notifications';

-- Repoint it at the new function (keep the existing x-cron-secret header)
select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'send_due_notifications'),
  command := $$
    select net.http_post(
      url := 'https://<PROJECT_REF>.supabase.co/functions/v1/daily_push_dispatcher',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', '<CRON_SECRET>'
      )
    );
  $$
);
```

Or unschedule + reschedule with a new name:

```sql
select cron.unschedule('send_due_notifications');
select cron.schedule(
  'daily_push_dispatcher',
  '0 9 * * *',
  $$ select net.http_post(
       url := 'https://<PROJECT_REF>.supabase.co/functions/v1/daily_push_dispatcher',
       headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>')
     ); $$
);
```

The old `send_due_notifications` function stays deployed (marked deprecated in source) as a rollback safety net.

#### Smoke test

```bash
curl -X POST -H "x-cron-secret: $CRON_SECRET" \
  https://<PROJECT_REF>.supabase.co/functions/v1/daily_push_dispatcher
```

Expected JSON: `{ ok, rowsLoaded, usersConsidered, usersPushed, usersSkippedDisabled, usersSkippedNoSubs, rowsAggregated, subscriptionsCleared }`.

Verify on a phone:

- One subscribed user with multiple pending rows → exactly **one** OS notification appears.
- Re-running the same day → no new push (rows already have `push_sent_at`).
- Friend-request flow (Next.js synchronous path via `src/app/lib/friend-request-notify.js`) is unaffected and continues to push immediately.
