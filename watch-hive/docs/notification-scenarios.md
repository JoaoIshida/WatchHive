# Notification scenarios (example copy)

Examples below match the strings built in code. Placeholders use **bold** labels.

**In-app feed:** Every row below is stored in `notifications` and appears under **`/profile/notifications`** whether or not Web Push succeeds (push is a separate step that sets `push_sent_at` when it works).

## `release_reminder` (Edge: `precompute_release_notifications` → `dispatch_notification_queue`)

Wishlist reminders use the user’s reminder offset vs release date; copy uses **(CA)** for calendar semantics.

| Sub-scenario | `title` (in-app) | `message` (in-app) |
|--------------|------------------|--------------------|
| Wishlist **movie**, offset **0** | `In theatres: **Movie Title**` | `"**Movie Title**" is in theatres today (CA).` |
| Wishlist **movie**, offset **1** | `In theatres: **Movie Title**` | `"**Movie Title**" opens in theatres tomorrow (CA).` |
| Wishlist **movie**, offset **N** | `In theatres: **Movie Title**` | `"**Movie Title**" opens in theatres in **N** days (CA).` |
| Wishlist **TV** premiere, offset **0** | `Premiere: **Show Name**` | `"**Show Name**" premieres today (CA).` |
| Wishlist **TV** premiere, offset **1** | `Premiere: **Show Name**` | `"**Show Name**" premieres tomorrow (CA).` |
| Wishlist **TV** premiere, offset **N** | `Premiere: **Show Name**` | `"**Show Name**" premieres in **N** days (CA).` |
| **Watching** (TV on your watched list), offset **0** | `New episode: **Show Name**` | `"**Show Name**" has a new episode airing today (CA).` |

Watching reminders apply when you have watch progress for the series. If you marked the series **completed** but TMDB still has a **next episode** scheduled (e.g. a finale not aired yet), you still receive episode reminders until that air date passes.
| **Watching**, offset **1** | `New episode: **Show Name**` | `"**Show Name**" has a new episode airing tomorrow (CA).` |
| **Watching**, offset **N** | `New episode: **Show Name**` | `"**Show Name**" has a new episode in **N** days (CA).` |

- **Link:** `/movies/{id}` or `/series/{id}`.
- **Web push (batched):** `daily_push_dispatcher` usually mirrors the row’s `title` / `message` when there is **one** pending row for that user; see [Aggregated push](#aggregated-push-daily_push_dispatcher) when there are several.

---

## `catalog_expanded` (Edge: `refresh_series_progress_catalog`)

Shown when the catalog episode count for a series increased and the user is still behind on marked-watched episodes. Copy is app-focused (no TMDB wording).

| Field | Example |
|-------|---------|
| `title` | `New episodes` |
| `message` | `**Stranger Things** now has new episodes listed. Open the show when you're ready.` |

- **Link:** `/series/{id}` (opens the show). The notification still appears in **`/profile/notifications`**.

---

## `series_catchup` (Edge: `weekly_series_catchup_notifications`)

Weekly nudge for in-progress series where `catalog_total_episodes` is known and the user has **not** marked every episode watched. **`x`** is **episodes not watched yet** (`catalog_total` minus marked watched).

| Case | `title` | `message` | `link` |
|------|---------|-------------|--------|
| **One** qualifying show this run for the user | `Episodes waiting` | `**The Bear** has **8** episodes not watched yet. Catch up when you're ready.` | `/series/{id}` |
| **Two or more** qualifying shows in the same run | `Episodes waiting` | `A few titles aren't finalized yet. Catch up when you're ready.` | `/profile/notifications` |

The multi-show row uses dedupe `weekly_catchup:{user_id}:multi:{week}` so the user gets one summary for that week instead of one notification per title.

---

## `friend_request` (Next.js: `friend-request-notify.js`)

Immediate Web Push (not the daily dispatcher). In-app and push bodies differ slightly.

| Channel | `title` | Body / `message` |
|---------|---------|-------------------|
| In-app row | `Friend request` | `**Alex** sent you a friend request.` (uses `display_name` or `Someone`) |
| Web push | `Friend request` | `**Alex** wants to connect on WatchHive.` |

- **Link / URL:** `/profile/friends`

---

## Aggregated push (`daily_push_dispatcher`)

When a user has **more than one** pending row of types `release_reminder`, `catalog_expanded`, or `series_catchup` (same run, `push_sent_at` still null), the push may **not** match a single row verbatim:

| Case | Push `title` | Push `body` | `url` |
|------|--------------|-------------|-------|
| Several rows, **one** series link (no `catalog_expanded`) | `WatchHive` | `**Show Name** - **3** new episodes` | that series link |
| Several rows, **one** link and **any** row is `catalog_expanded` | `WatchHive` | `New season of **Show Name**` | that link |
| Rows for **multiple** links | `WatchHive` | `**5** new titles available` | `/profile/notifications` |

---

## Source files

| Type | Code |
|------|------|
| `release_reminder` | `supabase/functions/precompute_release_notifications/index.ts`, `dispatch_notification_queue/index.ts`, `_shared/releaseNotifyCopy.ts` |
| `catalog_expanded` | `supabase/functions/refresh_series_progress_catalog/index.ts` |
| `series_catchup` | `supabase/functions/weekly_series_catchup_notifications/index.ts` |
| `friend_request` | `src/app/lib/friend-request-notify.js` |
| Batched push copy | `supabase/functions/daily_push_dispatcher/index.ts` (`decideVariant`, `extractSeriesName`) |

---

## Cron pipeline notes

### Release reminders (precomputed)

1. **`ingest_regional_airings`** — TVMaze episode `airstamp` / `airdate` (or TMDB fallback) → `catalog_episodes` + `regional_airings.release_at_utc`.
2. **`precompute_release_notifications`** — For each airing in the next **30** days, enqueue `notification_queue` with `send_at_utc` (user timezone, 09:00 local on reminder day).
3. **`dispatch_notification_queue`** — `send_at_utc <= now()` → insert `notifications` (no external APIs).
4. **`daily_push_dispatcher`** — Web Push from pending `notifications` rows.

TMDB cache refresh (titles/posters, movie dates) still uses **`enqueue_release_sync_candidates`** + **`process_series_sync_queue`** → `release_cache` only.

### Other types

- **`enqueue_release_sync_candidates`** enqueues every wishlist + watched TV title daily. Only skips if a row is already `pending` in `series_sync_queue`.

---

*Examples documented from repo; last updated 2026-05-21.*
