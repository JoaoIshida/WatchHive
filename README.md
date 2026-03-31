# WatchHive

WatchHive is for discovering movies and series, keeping track of what you watch, and sharing with friends. Think of it as your personal shelf and watchlist, with a social layer -without needing to know how any of that is built.

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
