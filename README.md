# AI Content Engine

> **Give us 7 photos. We'll handle the week.**

An AI-operated content marketing system that turns raw photos + a one-sentence
brief into a full week of platform-ready Facebook content — analysed,
strategised, written, approved, scheduled, published and measured.

This repository implements **V1 + V2** of the system described in the
architecture brief:

| | V1 | V2 |
|---|---|---|
| Upload images | ✅ | ✅ |
| AI vision analysis | ✅ | ✅ |
| Weekly content strategy | ✅ | ✅ |
| Generate 7–14 posts | ✅ | ✅ |
| Approval workflow | ✅ | ✅ |
| Scheduler + job queue | ✅ | ✅ |
| Facebook Page publishing (simulated) | ✅ | ✅ |
| Basic analytics | ✅ | ✅ |
| Multiple Facebook Pages / Groups | | ✅ |
| Brand profiles (Brand Brain) | | ✅ |
| Campaigns + memory | | ✅ |
| Client workspaces (agency mode) | | ✅ |
| Approval modes (manual/assisted/autonomous) | | ✅ |
| Content recycling | | ✅ |
| Learning engine (insights + mix adjustment) | | ✅ |
| AI workspace assistant | | ✅ |

---

## Quick start

```bash
# 1. Install dependencies 
bun install

# 2. Push the database schema
bun run db:push

# 3. Seed demo data (Maison Été workspace, 7 assets, 17 posts, analytics)
bun run seed

# 4. Start the Next.js app on port 3000
bun run dev

# 5. In a separate terminal, start the scheduler mini-service on port 3003
bun run scheduler
```


---

## Architecture at a glance

```
                    ┌──────────────────────────────┐
                    │       USER (browser)          │
                    └──────────────┬────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │   Next.js 16 app (port 3000)  │
                    │   Single-page UI / 10 sections │
                    │   24 API routes               │
                    └──────┬───────────────┬────────┘
                           │               │
                           ▼               ▼
                ┌──────────────────┐  ┌─────────────────┐
                │   SQLite (Prisma) │  │  z-ai-web-dev-sdk │
                │   16 models       │  │  (LLM + VLM)      │
                └────────┬─────────┘  └──────────────────┘
                         │
                         ▼
                ┌──────────────────────────────┐
                │  Scheduler mini-service       │
                │  (port 3003, polls every 30s) │
                │  Retry / backoff / job queue  │
                └──────────────┬────────────────┘
                               │
                               ▼
                ┌──────────────────────────────┐
                │   Publisher adapter           │
                │   ├── FacebookPage (simulated)│
                │   ├── Instagram (placeholder) │
                │   └── ... (add more here)     │
                └──────────────────────────────┘
```

The system is **modular by design** — each of the 12 modules from the
architecture brief has a clear home in the codebase:

| Module | Where it lives |
|---|---|
| 1. Content Intake | `src/components/sections/create-section.tsx` + `POST /api/assets/upload` |
| 2. Content Understander | `src/lib/ai.ts` → `analyzeAsset` + `POST /api/assets/[id]/analyze` |
| 3. Brand Brain | `src/components/sections/brand-section.tsx` + `prisma/schema.prisma` → `Brand`, `BrandRule`, `Product` |
| 4. Strategy Engine | `src/lib/ai.ts` → `generateWeeklyStrategy` (called from `POST /api/content/generate`) |
| 5. Content Generator | `src/lib/ai.ts` → `generatePostCandidates` + `generateAndPickBest` |
| 6. Media Engine | Originals stored under `uploads/`; resizing handled by `sharp` (placeholder for V2 extensions) |
| 7. Approval Engine | `src/components/sections/approval-section.tsx` + `POST /api/posts/approve-all` |
| 8. Scheduler | `mini-services/scheduler/` (independent Bun service, port 3003) |
| 9. Monitoring | `AuditLog` model + `GET /api/audit`; failed posts surfaced in dashboard |
| 10. Analytics | `src/components/sections/analytics-section.tsx` + `GET /api/analytics` |
| 11. Learning Engine | `src/lib/ai.ts` → `generateInsights` (cached in `PerformanceSnapshot`) |
| 12. Campaign Memory | `Campaign` model + `src/components/sections/campaigns-section.tsx` |

Plus the cross-cutting concerns:
- **Module 22 — AI Assistant**: `src/components/sections/assistant-section.tsx` + `POST /api/conversation/message`
- **Module 14 — Groups as separate subsystem**: `Destination.type === 'group'` with `automationStatus: 'manual'` and `contentStyleHint` so the AI adapts tone per group.
- **Module 8 — Publisher adapter pattern**: `src/lib/publisher.ts` — add a new platform by implementing the `Publisher` interface and registering it in the `publishers` map.

---

## Project structure

```
my-project/
├── prisma/
│   └── schema.prisma              # 16 V1+V2 models
├── db/
│   └── custom.db                  # SQLite database
├── uploads/                       # User-uploaded images (served via /api/uploads)
│   └── demo/                      # Generated demo images from the seed
├── scripts/
│   └── seed.ts                    # Demo workspace seeder
├── mini-services/
│   └── scheduler/                 # Independent Bun scheduler (port 3003)
│       ├── index.ts               # Poller + HTTP status server
│       ├── publisher.ts           # Simulated FB publisher + retry logic
│       └── README.md
├── src/
│   ├── lib/
│   │   ├── ai.ts                  # AI orchestrator (LLM + VLM wrappers)
│   │   ├── db.ts                  # Prisma client singleton
│   │   ├── publisher.ts           # Publisher adapter pattern
│   │   ├── server-utils.ts        # Brand→DTO, audit log, scheduling helpers
│   │   └── types.ts               # Shared DTOs
│   ├── app/
│   │   ├── layout.tsx             # Root layout (providers, theme, fonts)
│   │   ├── page.tsx               # Single-page app shell (sidebar + sections)
│   │   ├── globals.css            # Emerald/teal premium theme
│   │   └── api/                   # 24 API routes (see below)
│   ├── components/
│   │   ├── layout/                # sidebar, topbar, footer
│   │   ├── sections/              # 10 UI sections
│   │   ├── providers/             # Query, theme, app context
│   │   ├── post-card.tsx          # Reusable post card
│   │   ├── upload-zone.tsx        # Drag-and-drop upload
│   │   └── error-state.tsx
│   └── hooks/                     # TanStack Query hooks
└── package.json
```

---

## The 10 UI sections

The whole product is a single-page app at `/`. Navigation is via the sidebar
(collapse to a Sheet on mobile).

### 1. Dashboard

Opens by default. Shows:
- A "THIS WEEK" hero card with campaign name + objective.
- 4 KPI tiles: Content supplied, Posts generated, Posts scheduled, Awaiting approval.
- Engagement summary with trend (% change vs previous 7 days).
- Two preview lists: Awaiting approval (3 most recent with one-click Approve) and Recently published (3 most recent with metrics).

### 2. Create Week (Content Intake)

The "Give us 7 photos" entry point. Two-step wizard:
- **Step 1** — drag-and-drop upload zone (or click to browse). Selected assets appear as thumbnails. You can also add a URL or text note.
- **Step 2** — weekly brief textarea ("What's happening this week?"), objective toggle chips (Awareness / Engagement / Sales / Leads / Event promotion), and a campaign selector.

On submit, the orchestrator runs:
1. `analyzeAsset` (VLM) on any un-analysed asset.
2. `generateWeeklyStrategy` (LLM) — produces a 7-day content mix and daily plan.
3. For each day, `generateAndPickBest` — generates 3 candidates (educational / storytelling / direct-response angles), scores each via `evaluateCandidate`, and picks the winner.
4. Creates `pending_approval` posts.

A progress card animates through the 4 stages. On success, a toast fires and you're navigated to the Approval section.

### 3. Approval (Module 7)

The most important screen. Shows all `pending_approval` posts grouped by day (Monday → Sunday, matching the strategy's daily plan). Each card shows:
- Asset thumbnail
- Large serif hook
- Expandable caption
- CTA
- Hashtag chips
- Objective + pillar badges
- Destination name
- **Edit / Regenerate / Approve** buttons

- **Edit** opens a dialog with textarea fields for hook, caption, CTA, hashtags.
- **Regenerate** opens a dialog asking for an instruction ("Make it less salesy") and calls the LLM to rewrite.
- **Approve** moves the post to `scheduled` and assigns a sensible `scheduledAt` (next occurrence of that weekday at the pillar's default time).

At the bottom: **"Approve all (N)"** — bulk-approves every pending post.

### 4. Calendar

14-day grid (7 cols on desktop, collapses to 2 / 1 on mobile). Each day cell shows the posts scheduled for that day as small cards with time, caption preview, and a status dot. Filters: All / Scheduled / Published / Pending. Click any card to open a dialog with the full post details.

### 5. Campaigns

List of campaigns as cards: name, objective badge, status badge, date range, content-mix bar chart (CSS bars coloured by pillar), post count, total reach, total engagement. Click to expand and see the campaign's posts.

### 6. Analytics

- 4 KPI tiles: Total reach, Total engagement, Avg engagement rate, Posts published.
- Recharts bar chart: avg engagement by content pillar.
- Recharts bar chart: posts by objective.
- Top 5 performing posts (by engagementRate) with caption and metrics.
- Side panel: AI insights from the Learning Engine (calls `generateInsights`, cached for 1 hour in a `PerformanceSnapshot`).

### 7. Brand (Brand Brain — Module 3)

Full editor for the persistent brand profile:
- Profile fields: name, description, audience, location, personality, writing style, CTA.
- Vocabulary cards: "Use" and "Avoid" — add/remove chips.
- Brand rules list with type select (prohibition / guideline / preference).
- Products list with name, price, description, features, promotion, promotion expiry.

Single Save button calls `PATCH /api/brands/[id]`. The brand profile is fed into every AI call so the system never has to "rediscover the business every week".

### 8. Assistant (Module 22)

Chat interface. Persistent across sessions (stored in DB). Messages have role styling (user right, assistant left). Typing indicator while waiting. Suggestion chips for common asks ("What performed best last month?", "Make the Friday caption less salesy", "Give me a content plan for next week"). The assistant has read-only workspace context: active campaigns, posts awaiting approval, last-30-day analytics totals.

### 9. Distribution

- Facebook account card with connection status badge and "Reconnect" button (simulated).
- Destinations grid: Page vs Groups, each with automation status, posting rules, content style hint, allowed frequency, last post date.

Groups are treated as a separate subsystem (Module 14) — their `automationStatus` defaults to `manual` and the AI adapts the tone per group's `contentStyleHint`.

### 10. Settings

- Approval mode radio cards: **Manual** (everything requires approval), **Assisted** (AI prepares; user approves the week), **Autonomous** (AI publishes unless a rule is violated). Default is Assisted.
- **Recycle bin**: lists old high-performing published posts with a "Recycle" button that calls `POST /api/posts/[id]/recycle` to generate 3 fresh variations.
- **Audit log** table: every orchestrator run, approval, publish, and regeneration is logged.

---

## The 24 API routes

All routes return `{ success: boolean, data?: T, error?: string }` and resolve the demo workspace via `resolveWorkspace('maison-ete')`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/dashboard` | Weekly KPIs + campaign + recent activity |
| GET | `/api/brands` | List brands |
| PATCH | `/api/brands/[id]` | Update brand fields |
| GET | `/api/campaigns` | List campaigns with stats |
| GET | `/api/assets` | List assets with analyses |
| POST | `/api/assets/upload` | Multipart upload (up to 10 files) |
| POST | `/api/assets/[id]/analyze` | Run VLM analysis on an asset |
| POST | `/api/content/generate` | **The orchestrator** — full weekly workflow |
| GET | `/api/posts?status=...` | List posts (with filter) |
| PATCH | `/api/posts/[id]` | Update post fields / status |
| POST | `/api/posts/[id]/regenerate` | AI-rewrite a post from an instruction |
| POST | `/api/posts/[id]/publish` | Trigger immediate publish |
| POST | `/api/posts/[id]/recycle` | Create 3 fresh variations of an old post |
| POST | `/api/posts/approve-all` | Bulk approve + schedule |
| GET | `/api/calendar` | 14-day calendar view |
| GET | `/api/analytics` | Aggregated metrics + AI insights |
| GET | `/api/conversation` | Get the workspace AI conversation |
| POST | `/api/conversation/message` | Send a message to the assistant |
| GET | `/api/uploads/[...path]` | Serve an uploaded file |
| GET | `/api/workspaces` | List workspaces (agency mode) |
| PATCH | `/api/workspaces/[id]` | Update workspace (e.g. approval mode) |
| GET | `/api/distribution/accounts` | List social accounts + destinations |
| POST | `/api/distribution/accounts/[id]/reconnect` | Reconnect a disconnected account |
| GET | `/api/audit` | Recent audit log entries |

---

## Database schema (16 models)

The full schema is in [`prisma/schema.prisma`](./prisma/schema.prisma). The
relationship is:

```
USER
 │
 └── WORKSPACE
       │
       ├── BRAND
       │    ├── BrandRules
       │    └── Products
       │
       ├── SOCIAL ACCOUNTS
       │    └── Destinations (Page | Group)
       │
       ├── CAMPAIGNS
       │    └── Posts
       │
       ├── ASSETS
       │    └── AssetAnalysis (VLM output)
       │
       ├── POSTS
       │    └── PostAnalytics
       │
       ├── PerformanceSnapshots (Learning Engine cache)
       ├── AIConversation (assistant memory)
       └── AuditLogs
```

JSON-shaped fields (arrays, objects) are stored as `String` and parsed with
`parseJsonArray` / `parseJsonObject` from `src/lib/server-utils.ts` (SQLite
has no native JSON type).

---

## The scheduler mini-service

A standalone Bun project at `mini-services/scheduler/` running on **port 3003**.
It is **completely independent** of the Next.js app — they share only the
SQLite database.

### What it does

- Polls every **30 seconds** for posts with `status = 'scheduled'` AND `scheduledAt <= now()`.
- For each due post, calls the (simulated) Facebook publisher.
- On failure: increments `retryCount`, sets `failureReason`, schedules `nextRetryAt` using exponential backoff:
  - Retry 1 → +1 minute
  - Retry 2 → +5 minutes
  - Retry 3 → +15 minutes
  - Retry 4 → +60 minutes
  - Retry 5+ → marked permanently `failed` (no further retries)
  - Up to 10% jitter to avoid thundering herd.
- Also picks up previously-failed posts whose `nextRetryAt <= now()` (until retry 5).
- HTTP status endpoints:
  - `GET /health` → `{ ok: true }`
  - `GET /` → `{ service, status, uptime, lastTick, stats: { published, failed, retried, pending } }`

### How to run it

```bash
# From the project root
bun run scheduler

# Or directly
cd mini-services/scheduler && bun run dev
```

It logs to stdout. Graceful shutdown on SIGINT/SIGTERM.

See [`mini-services/scheduler/README.md`](./mini-services/scheduler/README.md) for full details.

---

## AI layer

All AI calls go through [`src/lib/ai.ts`](./src/lib/ai.ts), which wraps
`z-ai-web-dev-sdk` behind a domain-specific API. The rest of the app never
talks to the SDK directly.

| Function | Module | Purpose |
|---|---|---|
| `analyzeAsset(filePath, brandContext?)` | 2 | VLM image understanding → structured `AssetAnalysisDTO` |
| `generateWeeklyStrategy({...})` | 4 | LLM produces 7-day content mix + daily plan |
| `generatePostCandidates({...})` | 5 | LLM writes 3 candidates (educational / storytelling / direct-response) |
| `evaluateCandidate({...})` | 5b | LLM scores a candidate on brand voice, accuracy, repetition, spamminess |
| `generateAndPickBest({...})` | 5 | Convenience: generate + evaluate + pick highest score |
| `regeneratePost({...})` | 7 | LLM rewrites a post from a natural-language instruction |
| `runAssistant({...})` | 22 | Multi-turn chat with workspace context |
| `generateInsights({...})` | 11 | Reads analytics → produces insights + recommended mix |

All prompts are built from the brand + campaign + asset context so the models
"never have to rediscover the business every week". Every prompt asks for
STRICT JSON output and is parsed defensively (handles ```json fences, extracts
`{ ... }` blocks, falls back to sensible defaults).

**`z-ai-web-dev-sdk` is server-side only** — every file that imports it has
`import 'server-only'` at the top.

---

## Publisher adapter pattern

[`src/lib/publisher.ts`](./src/lib/publisher.ts) defines a generic `Publisher`
interface:

```ts
interface Publisher {
  platform: string
  publish(input: PublishInput): Promise<PublishResult>
}
```

The registry maps platform names to adapters:

```ts
const publishers: Record<string, Publisher> = {
  facebook: new FacebookPublisher(),
}
```

**Adding a new platform** (Instagram, TikTok, X, LinkedIn) means:
1. Implement the `Publisher` interface.
2. Register it in the `publishers` map.
3. Nothing else in the codebase changes.

The Facebook adapter is **simulated** in this sandbox because Meta requires
app review for the Pages Publishing API. The real Graph API call is documented
inline in `FacebookPublisher.publish()` — swapping it in is a drop-in change.
The simulator includes a 5% random transient failure rate so the retry/backoff
logic is exercised end-to-end.

---

## Demo workspace

The seed script (`scripts/seed.ts`) creates a complete demo workspace so you
can explore the system immediately:

- **Workspace**: `maison-ete` (Maison Été — luxury fashion retailer in Maseru, Lesotho)
- **Brand**: full profile with vocabulary, rules, 3 products
- **Social accounts**: 1 Facebook Page (connected) + 1 Facebook Group (Maseru Fashion Lovers, manual automation)
- **Campaign**: Summer Collection Launch (active, 14-day window)
- **Assets**: 7 generated product photos (1080×1080 JPEGs created with `sharp`)
- **Posts**: 17 total — 7 awaiting approval (one per weekday), 2 scheduled for next week, 8 historical published posts with analytics
- **AI conversation**: pre-seeded welcome message

To re-seed (this wipes all data):

```bash
bun run seed
```

---

## Approval modes (V2)

The workspace `approvalMode` field controls how the approval workflow behaves:

| Mode | Behaviour |
|---|---|
| **Manual** | Every post requires explicit approval. The orchestrator creates `pending_approval` posts; nothing is scheduled until a human approves. |
| **Assisted** (default) | The orchestrator prepares the week; the user approves the whole week with one click ("Approve all"). Posts then move to `scheduled`. |
| **Autonomous** | The orchestrator can publish automatically unless a brand rule is violated. (In this sandbox, autonomous mode still routes through the approval queue — full auto-publish is a V4 feature.) |

Change the mode in **Settings**.

---

## Content recycling (V2)

Old high-performing posts are surfaced in the **Settings → Recycle bin**.
Clicking "Recycle" on a post calls `POST /api/posts/[id]/recycle`, which:
1. Finds the original post and its asset.
2. Calls `generatePostCandidates` with `count: 3` to produce fresh variations.
3. Creates 3 new `pending_approval` posts with `recycledFromId` set to the original.

This gives the marketer a "virtually inexhaustible content reservoir" — every
old winner can become 3 new candidates.

---

## Learning engine (Module 11)

The Analytics section calls `GET /api/analytics`, which:
1. Aggregates `PostAnalytics` by pillar and by objective.
2. If there are ≥5 published posts with analytics, calls `generateInsights` (LLM).
3. Caches the result in a `PerformanceSnapshot` (period `30d`) for 1 hour.
4. Returns plain-English insights + a recommended content mix for the next cycle.

Example insight: *"Lifestyle posts generate 2.1× the engagement of promotional posts. Consider increasing lifestyle content from 20% to 30% next cycle."*

---

## Security notes

This is a sandbox demo. For a real SaaS deployment you would need to:

- **Encrypt social credentials at rest** (currently stored as plain strings in `SocialAccount.accessToken`).
- **Use OAuth** for Facebook instead of long-lived tokens.
- **Implement proper authentication** (NextAuth.js is available in the stack — the schema already has `User`, `Workspace`, `WorkspaceMember` with roles).
- **Enforce tenant isolation** so one workspace can never read another's data.
- **Add rate limiting** to AI endpoints.
- **Move file storage to object storage** (S3 / R2) instead of local disk.

The audit log (`AuditLog` model + `GET /api/audit`) is already in place — every orchestrator run, approval, publish, and regeneration is recorded.

---

## Commands

| Command | What it does |
|---|---|
| `bun run dev` | Start the Next.js app on port 3000 (with hot reload) |
| `bun run scheduler` | Start the scheduler mini-service on port 3003 |
| `bun run lint` | Run ESLint |
| `bun run db:push` | Push the Prisma schema to SQLite (destructive) |
| `bun run db:generate` | Regenerate the Prisma client |
| `bun run seed` | Re-seed the demo workspace (wipes all data) |

---

## Tech stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York style)
- **Database**: Prisma ORM + SQLite
- **State**: TanStack Query (server), React context (client UI)
- **AI**: `z-ai-web-dev-sdk` (LLM + VLM)
- **Charts**: Recharts
- **Icons**: lucide-react
- **Image processing**: sharp
- **Scheduler**: standalone Bun service

---

## Roadmap (V3 → V4)

The architecture is designed to extend cleanly:

- **V3**: Facebook Groups workflow (full automation where allowed), Instagram, WhatsApp, lead tracking, AI comment assistance, advanced analytics.
- **V4**: Autonomous marketing — "Grow this business's Facebook presence over the next 90 days" — with a 90-day strategy engine that continuously plans, creates, publishes, measures, learns, and re-plans.

The modular separation (Strategy / Content / Distribution / Measurement as
the central feedback loop) makes each V3/V4 addition a new module rather than
a rewrite.
