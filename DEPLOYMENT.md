# Deployment Guide

Three ways to deploy the AI Content Engine:

- **Option A — Your own PC** (simplest, no server needed)
- **Option B — Vercel** (cloud, free tier, 24/7 uptime)
- **Option C — Self-hosted VPS** (full control)

---

## Option A: Your own PC (simplest)

Everything runs locally using SQLite and local file storage. No cloud accounts needed.

### Prerequisites

**Node.js 20+**:
- Windows: download from [nodejs.org](https://nodejs.org/)
- macOS: `brew install node`
- Linux: `sudo apt install nodejs` or use [nvm](https://github.com/nvm-sh/nvm)

**Bun**:
- macOS/Linux: `curl -fsSL https://bun.sh/install | bash`
- Windows (PowerShell): `irm bun.sh/install.ps1 | iex`

**Git** (to clone): download from [git-scm.com](https://git-scm.com/)

Verify:
```bash
node --version   # v20+
bun --version    # 1.x
```

### Step 1: Get the code

```bash
git clone https://github.com/yourusername/ai-content-engine.git
cd ai-content-engine
```

Or extract from a zip file.

### Step 2: Install dependencies

```bash
bun install
cd mini-services/scheduler && bun install && cd ../..
```

### Step 3: Configure environment

Create `.env` in the project root:

```env
DATABASE_URL="file:./db/custom.db"

# Optional — only for live Facebook publishing:
# FB_APP_ID=your_meta_app_id
# FB_APP_SECRET=your_meta_app_secret
# NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Step 4: Set up database

```bash
bun run db:push     # create SQLite database
bun run seed        # load demo data (7 images, 17 posts)
```

### Step 5: Start the app

Open **two terminals**:

**Terminal 1 — web app:**
```bash
bun run dev
```

**Terminal 2 — scheduler:**
```bash
bun run scheduler
```

### Step 6: Open the app

Go to `http://localhost:3000` in your browser.

### Keeping it running

**Background script** — create `start.sh` (macOS/Linux):
```bash
#!/bin/bash
cd "$(dirname "$0")"
bun run dev > app.log 2>&1 &
cd mini-services/scheduler && bun run dev > ../../scheduler.log 2>&1 &
echo "Started. Open http://localhost:3000"
```

**Windows** — create `start.bat`:
```bat
@echo off
start /min cmd /c "bun run dev > app.log 2>&1"
start /min cmd /c "cd mini-services\scheduler && bun run dev > ..\..\scheduler.log 2>&1"
echo Started. Open http://localhost:3000
```

**Start on boot**:
- macOS: use a LaunchAgent in `~/Library/LaunchAgents/`
- Windows: use Task Scheduler → trigger "When I log on"
- Linux: use a systemd user service in `~/.config/systemd/user/`

### Access from other devices (same Wi-Fi)

```bash
bun run dev -- -H 0.0.0.0
```
Find your IP (`ipconfig` / `ip addr`), then open `http://YOUR-IP:3000` on your phone.

### Facebook OAuth on localhost

Facebook needs a public callback URL. Use a tunnel:

**Cloudflare Tunnel (free, recommended):**
```bash
cloudflared tunnel --url http://localhost:3000
# Copy the https://xxx.trycloudflare.com URL
```

Set `NEXT_PUBLIC_BASE_URL` to that URL and add it to Facebook's redirect URIs.

### Backup

Copy two things:
- `db/custom.db` (database)
- `uploads/` folder (images)

### Update

```bash
pkill -f "next dev"
pkill -f "scheduler"
git pull
bun install
cd mini-services/scheduler && bun install && cd ../..
bun run db:push
bun run dev   # restart
```

### Troubleshooting

| Problem | Fix |
|---|---|
| `bun: command not found` | Close/reopen terminal, or `source ~/.bashrc` |
| Port 3000 in use | `bun run dev -- -p 3001` |
| Scheduler not publishing | Check `http://localhost:3003/health` returns `{"ok":true}` |
| Images don't appear | Ensure `uploads/` folder exists and is writable |
| Database locked | Stop processes, delete `db/custom.db`, run `db:push` + `seed` |

---

## Option B: Vercel (cloud, 24/7)

### Step 1: PostgreSQL database

Use [Neon](https://neon.tech), [Supabase](https://supabase.com), or [Railway](https://railway.app). Copy the connection string.

### Step 2: Blob storage

Vercel project → **Storage** → create Blob store → copy `BLOB_READ_WRITE_TOKEN`.

### Step 3: Switch to PostgreSQL

Edit `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```
```bash
bun run db:generate && bun run db:push
```

### Step 4: Update upload routes for blob storage

```bash
bun add @vercel/blob
```

In `src/app/api/assets/upload/route.ts` and `src/app/api/workspaces/[id]/logo/route.ts`, replace `fs.writeFile` with:
```typescript
import { put } from '@vercel/blob'
const blob = await put(`uploads/${filename}`, buffer, { access: 'public' })
const publicPath = blob.url
```

### Step 5: Deploy

1. Push to GitHub
2. [vercel.com](https://vercel.com) → **New Project** → import repo
3. Add environment variables (see below)
4. **Deploy**

### Step 6: Environment variables

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgresql://...` |
| `FB_APP_ID` | Meta App ID |
| `FB_APP_SECRET` | Meta App Secret |
| `NEXT_PUBLIC_BASE_URL` | `https://yourapp.vercel.app` |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token |
| `CRON_SECRET` | Random string |
| `ZAI_API_KEY` | AI SDK key |

### Step 7: Migrate database

```bash
npm i -g vercel && vercel link
vercel env pull .env.production.local
bun run db:push && bun run seed
```

### Step 8: Facebook redirect URI

Add `https://yourapp.vercel.app/api/auth/facebook/callback` to Meta App settings.

---

## Option C: Self-hosted VPS

### Step 1: Provision VPS

Ubuntu 22.04+, 1-2 GB RAM, Node.js 20+, Bun installed.

### Step 2: Clone + install

```bash
git clone https://github.com/yourusername/ai-content-engine.git
cd ai-content-engine
bun install
cd mini-services/scheduler && bun install && cd ../..
```

### Step 3: Configure

```env
DATABASE_URL=file:./db/custom.db
FB_APP_ID=your_app_id
FB_APP_SECRET=your_app_secret
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
```

### Step 4: Database

```bash
bun run db:push && bun run seed
```

### Step 5: Reverse proxy (Caddy — auto HTTPS)

`/etc/caddy/Caddyfile`:
```
yourdomain.com {
    reverse_proxy localhost:3000
}
```
```bash
sudo systemctl start caddy
```

### Step 6: systemd services

Create `/etc/systemd/system/ai-content-engine.service`:
```ini
[Unit]
Description=AI Content Engine
After=network.target
[Service]
Type=simple
User=youruser
WorkingDirectory=/home/youruser/ai-content-engine
ExecStart=/usr/bin/bun run start
Restart=always
[Install]
WantedBy=multi-user.target
```

Create `/etc/systemd/system/ai-content-scheduler.service`:
```ini
[Unit]
Description=AI Content Engine Scheduler
After=network.target
[Service]
Type=simple
User=youruser
WorkingDirectory=/home/youruser/ai-content-engine/mini-services/scheduler
ExecStart=/usr/bin/bun run start
Restart=always
[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable ai-content-engine ai-content-scheduler
sudo systemctl start ai-content-engine ai-content-scheduler
```

### Step 7: Facebook redirect URI

Add `https://yourdomain.com/api/auth/facebook/callback` to Meta App settings.

---

## Which option?

| | Your PC | Vercel | VPS |
|---|---|---|---|
| Cost | Free | Free/$20mo | $5-10/mo |
| Setup | 10 min | 30 min | 45 min |
| Uptime | When PC is on | 24/7 | 24/7 |
| Database | SQLite | PostgreSQL | SQLite/PostgreSQL |
| Facebook OAuth | Needs tunnel | Native | Native |
| Best for | Personal/testing | Free 24/7 | Production |

---

## Post-deployment checklist

- [ ] App loads
- [ ] Dashboard shows data
- [ ] Upload image works
- [ ] Generate week works (1-4 min)
- [ ] Approve posts works
- [ ] Calendar shows scheduled posts
- [ ] Scheduler publishes (or click Publish manually)
- [ ] Analytics charts render
- [ ] AI Assistant responds
- [ ] Brand profile editable
- [ ] Workspace name/logo changeable
- [ ] Connect with Facebook works (if FB_APP_ID set)

---

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | `file:./db/custom.db` (SQLite) or `postgresql://...` |
| `FB_APP_ID` | Live FB | Meta App ID |
| `FB_APP_SECRET` | Live FB | Meta App Secret |
| `NEXT_PUBLIC_BASE_URL` | Live FB | Public URL |
| `BLOB_READ_WRITE_TOKEN` | Vercel | Vercel Blob token |
| `CRON_SECRET` | Vercel | Protects cron endpoint |
| `ZAI_API_KEY` | Yes | AI SDK key |
