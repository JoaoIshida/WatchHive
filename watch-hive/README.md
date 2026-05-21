# WatchHive (app)

This folder is the **Next.js** application. For a full intro (including testing on your phone over Wi‑Fi), start at the **[root README](../README.md)**. For **environment variables** (`.env.example`, TMDB, optional Watchmode, and related keys) and **Supabase for contributors** (migrations, where Edge secrets live), see the same doc: [Environment variables (local dev)](../README.md#environment-variables-local-dev) and [Supabase for contributors](../README.md#supabase-for-contributors).

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