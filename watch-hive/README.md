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
