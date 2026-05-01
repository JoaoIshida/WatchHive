# WatchHive

WatchHive is for discovering movies and series, keeping track of what you watch, and sharing with friends. Think of it as your personal shelf and watchlist, with a social layer, without needing to know how any of that is built.

## Links

- **Live app:** [whive.vercel.app](https://whive.vercel.app)
- **Source code:** [github.com/JoaoIshida/watchhive](https://github.com/JoaoIshida/watchhive)

Stack: **Next.js**, **Supabase** (auth, data, Edge Functions), **TMDB** for catalogue and images, and optionally **[Watchmode](https://api.watchmode.com/)** for streaming availability and deeplink resolution when TMDB does not expose a solid per-provider link (Watchmode complements TMDB `watch/providers`; it does not replace the catalogue).

This product uses the TMDB API but is not endorsed or certified by TMDB ([themoviedb.org](https://www.themoviedb.org/)).

License: [MIT](LICENSE).

---

## For builders & testers (technical)

Short definitions so the steps below make sense:

| Term | Meaning |
|------|--------|
| **Repository (repo)** | This project folder from Git - the code for WatchHive. |
| **Terminal** | A text window where you type commands (PowerShell or Command Prompt on Windows). |
| **npm** | Node’s package runner; installs dependencies and starts scripts defined in `package.json`. |
| **localhost** | “This computer” - the app talking to itself at `http://localhost:3000`. |
| **LAN / same Wi‑Fi** | Your phone, tablet, or another PC on the **same home or office network** as the dev machine. |
| **IPv4 address** | A numeric address like `192.168.1.42` that identifies your PC on that network. |
| **VPN** | If a VPN is on, your PC may show **extra** IPv4 lines (virtual adapter). Use the address that matches how the other device reaches you - often the **Wi‑Fi or Ethernet** one for home testing. |
| **`npm run dev`** | Starts the Next.js dev server bound to localhost only (default). |
| **`npm run host`** | Same dev server, but listening on **all network interfaces** (`0.0.0.0`) so other devices on the LAN can open the site. Defined in `watch-hive/package.json`. |

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS is fine)
- Git clone of this repo

### Environment variables (local dev)

1. From the repo root, go to the app folder and copy the template (never commit your real `.env`):

   ```bash
   cd watch-hive
   ```

   **Windows (PowerShell or Command Prompt):** `copy .env.example .env`  
   **macOS / Linux:** `cp .env.example .env`

2. Fill in values. The canonical list of variable names and short hints is [`watch-hive/.env.example`](watch-hive/.env.example).

**Required for a useful local app**

- **Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (Dashboard → Project Settings → API).
- **TMDB:** `TMDB_API_KEY` and `AUTH_TOKEN`. `AUTH_TOKEN` must be your TMDB **API Read Access Token** (Bearer auth on `api.themoviedb.org/3`); create both under [TMDB API settings](https://www.themoviedb.org/settings/api).
- **Sessions:** `JWT_SECRET` — use a long random string in production (not the default).

**Optional**

- **TV Maze:** `TVMAZE_API_KEY` — [TV Maze API](https://www.tvmaze.com/api).
- **Streaming deeplinks:** `WATCHMODE_API_KEY` from [Watchmode](https://api.watchmode.com/). When set, the server route `/api/watch/watchmode-resolve` can return a `web_url` for “watch on this provider” when TMDB does not already expose a good link; see [`watch-hive/src/app/utils/streamingOutboundUrlReference.md`](watch-hive/src/app/utils/streamingOutboundUrlReference.md). Without it, the app still uses TMDB and per-provider search fallbacks.
- **Web push:** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, optional `VAPID_SUBJECT`.
- **Prime outbound links:** `NEXT_PUBLIC_AMAZON_ASSOCIATE_TAG`.

**Canonical URL:** `NEXT_PUBLIC_APP_URL` (e.g. `http://localhost:3000`) when not on Vercel; production uses `VERCEL_URL` where relevant.

### Supabase for contributors

1. Create a [Supabase](https://supabase.com/) project.
2. Apply the database schema from this repo, for example with the [Supabase CLI](https://supabase.com/docs/guides/cli): `supabase link` then `supabase db push` from the `watch-hive` directory (migrations live under `watch-hive/supabase/migrations/`).
3. Copy the project URL and keys into `watch-hive/.env` as described above.

Edge Functions, cron jobs, and push pipelines are documented in [`watch-hive/README.md`](watch-hive/README.md). Secrets such as `CRON_SECRET`, `TMDB_API_KEY`, and VAPID keys for those jobs are configured in the **Supabase Dashboard → Edge Functions → Secrets**, not only in Next.js `.env`.

### Install and run (this machine only)

```bash
cd watch-hive
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Run on another device (same Wi‑Fi)

1. Connect the phone or second computer to the **same Wi‑Fi** as the PC running the app.
2. On the PC, from the `watch-hive` folder:

   ```bash
   npm run host
   ```

3. **Find this PC’s IPv4 address (Windows)**  - in PowerShell or Command Prompt:

   ```bash
   ipconfig | findstr /R /C:"IPv4"
   ```

   You may see several lines. For typical home testing, use the address on your **Wi‑Fi or Ethernet** adapter (often something like `192.168.x.x` or `10.x.x.x`). If you use a VPN, ignore addresses that belong to the VPN unless you mean to test over that tunnel.

4. On the other device, open a browser and go to:

   ```text
   http://YOUR_IPV4_HERE:3000
   ```

   Example: `http://192.168.1.42:3000`

**Mac or Linux:** use your system network settings or e.g. `ip addr` / `ifconfig` to find the LAN IPv4 instead of `ipconfig`.

**Firewall:** Windows or router firewalls may block port `3000`; allow Node/terminal through the firewall if the phone cannot connect.

### Production build (optional)

```bash
cd watch-hive
npm run build
npm start
```

---

More detail about the Next.js app itself lives in [`watch-hive/README.md`](watch-hive/README.md).
