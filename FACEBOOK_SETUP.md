# Facebook Setup Guide

How to connect your Facebook account and Pages to the AI Content Engine.

---

## Two modes

### Simulation mode (default)

When `FB_APP_ID` and `FB_APP_SECRET` are **not** set, the system simulates
publishing — no real Facebook API calls. Useful for testing.

### Live mode

When `FB_APP_ID` + `FB_APP_SECRET` + `NEXT_PUBLIC_BASE_URL` are set, the
system calls the real Facebook Graph API to publish posts.

---

## Setting up a Facebook App

### Step 1: Create a Meta App

1. Go to [developers.facebook.com](https://developers.facebook.com/)
2. **My Apps** → **Create App** → type: **Business**
3. Fill in app name + contact email → **Create App ID**

### Step 2: Add Facebook Login

1. In your app dashboard → **Add Product**
2. Find **Facebook Login** → **Set Up** → choose **Web**
3. Enter your site URL

### Step 3: Configure redirect URI

1. **Facebook Login** → **Settings**
2. Under **Valid OAuth Redirect URIs**, add:
   ```
   https://your-domain.com/api/auth/facebook/callback
   ```
3. For local dev, also add:
   ```
   http://localhost:3000/api/auth/facebook/callback
   ```
4. **Save Changes**

### Step 4: Copy App ID and Secret

1. **Settings** → **Basic**
2. Copy **App ID** and **App Secret**
3. Add to `.env`:
   ```env
   FB_APP_ID=your_app_id
   FB_APP_SECRET=your_app_secret
   NEXT_PUBLIC_BASE_URL=https://your-domain.com
   ```

### Step 5: Permissions

The app requests these scopes during OAuth:

| Permission | What it does |
|---|---|
| `pages_show_list` | See your Pages |
| `pages_read_engagement` | Read post insights |
| `pages_manage_posts` | Publish posts |
| `pages_read_user_content` | Read Page content |

### Step 6: App Review (for public use)

In development mode, only App Admins/Testers can use it. To let real users
connect:
1. **App Review** → **Permissions and Features**
2. Request `pages_manage_posts` + `pages_read_engagement`
3. Submit for review (1-3 business days)

---

## Connecting your account

1. Open the app → **Distribution** section
2. Click **"Connect with Facebook"**
3. Log in to Facebook, approve permissions
4. The system stores your Pages as destinations automatically

### What gets stored

| Field | Where |
|---|---|
| User access token | `SocialAccount.accessToken` (60-day) |
| Page access token | `Destination.postingRules` (JSON) |
| Page ID | `Destination.externalId` |
| Page name | `Destination.name` |

---

## Adding Groups

1. Distribution → find an account → **"Add destination"**
2. Fill in: Type=Group, Name, External ID, Automation=Manual
3. Add a content style hint (e.g. "Conversational, like talking to friends")
4. **Add destination**

Groups have stricter automation — set to Manual and limit to 1x/week.

---

## How publishing works

1. You approve a post → status = `scheduled` with a time
2. Scheduler checks every 30s (or Vercel Cron every 1 min)
3. Publisher calls Facebook Graph API:
   - Text post: `POST /v21.0/{page-id}/feed`
   - Image post: `POST /v21.0/{page-id}/photos`
4. On success → status = `published`
5. On failure → retry with backoff (1m, 5m, 15m, 60m, then give up)

---

## Disconnecting

1. Distribution → find account → **Disconnect**
2. Account + destinations deleted; posts kept (destination cleared)
3. To revoke app access: [facebook.com/settings](https://www.facebook.com/settings?tab=applications)

---

## Troubleshooting

| Error | Fix |
|---|---|
| "Facebook OAuth is not configured" | Set `FB_APP_ID`, `FB_APP_SECRET`, `NEXT_PUBLIC_BASE_URL` in `.env` |
| "redirect_uri isn't valid" | Add exact URI in Facebook Login settings |
| "App is in development mode" | Add user as Tester, or submit for App Review |
| Posts "published" but not on Facebook | You're in simulation mode — set FB env vars for live |
| Token expired | Distribution → Reconnect |
| Image posts fail | Facebook needs a public image URL — use Cloudflare Tunnel or deploy publicly |

---

## Environment variables

```env
FB_APP_ID=your_meta_app_id
FB_APP_SECRET=your_meta_app_secret
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```
