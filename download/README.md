# AI Content Engine

> **Give us 7 photos. We'll handle the week.**

An AI-operated content marketing system that turns raw photos + a one-sentence
brief into a full week of platform-ready Facebook content — analysed,
strategised, written, approved, scheduled, published and measured.

## Documentation

| Document | What it covers |
|---|---|
| **README.md** | This file — system overview, architecture, features |
| **FACEBOOK_SETUP.md** | How to connect Facebook Pages, OAuth setup, publishing flow |
| **DEPLOYMENT.md** | How to deploy on your PC, Vercel, or a VPS |
| **USER_GUIDE.md** | Complete walkthrough for new users |
| **.env.example** | Environment variable template |
| **vercel.json** | Vercel Cron configuration |
| **WORKLOG.md** | Development history |
| **SCHEDULER_README.md** | Scheduler mini-service docs |

## Quick start

```bash
bun install                          # install dependencies
bun run db:push                      # create the database
bun run seed                         # load demo data (7 images, 17 posts)
bun run dev                          # start the app on port 3000
bun run scheduler                    # start the scheduler on port 3003 (separate terminal)
```

Open `http://localhost:3000` in your browser.

## What it does

1. **Upload** 7 photos + write a one-sentence brief
2. **AI analyses** each photo (vision model)
3. **AI plans** a 7-day content strategy
4. **AI writes** 7-14 posts (3 candidates per slot, picks the best)
5. **You review** and approve
6. **Scheduler publishes** to your Facebook Page at the right time
7. **AI learns** what works and improves next week

## Features

- 10-section dashboard: Dashboard, Create Week, Approval, Calendar, Campaigns, Analytics, Brand Brain, Distribution, Assistant, Settings
- AI vision analysis of uploaded photos
- Weekly content strategy generation
- 3-candidate evaluation per post slot
- Approval workflow (Manual / Assisted / Autonomous)
- Content recycling (generate fresh variations of old top performers)
- Learning engine (AI insights from analytics)
- Workspace AI assistant (chat with context about your campaigns)
- Custom workspace logo + name
- Real Facebook OAuth + Graph API publishing
- Scheduler with retry/backoff
- Full audit log

## Tech stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS 4 + shadcn/ui
- Prisma ORM + SQLite (dev) / PostgreSQL (prod)
- z-ai-web-dev-sdk (LLM + VLM)
- Bun runtime
- Recharts for analytics

## Single-tenant model

Each client hosts their own instance — no multi-tenant complexity, each
deployment owns its own data. See DEPLOYMENT.md for details.
