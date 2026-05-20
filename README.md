# QuickSight Kiosk — Windows 11 Setup

Dual-monitor rotating kiosk for AWS QuickSight dashboards, displayed on two 57" TVs.

```
├── SETUP.bat                First-time setup (install deps, create .env)
├── START.bat                Launch both servers + Chrome on both TVs
├── START-PS.ps1             PowerShell alternative to START.bat
├── STOP.bat                 Kill server processes
├── SETUP-AUTOSTART.ps1      Add auto-start on Windows login
├── REMOVE-AUTOSTART.ps1     Remove auto-start entry
├── kiosk\
│   ├── .env.example         Environment variable template
│   ├── config.js            Slide profiles (info + stats)
│   ├── server.js            Express server (embed URL generation)
│   ├── package.json         Node dependencies
│   └── public\
│       └── index.html       Kiosk frontend (HUD, rotation, QuickSight SDK)
```

> **New profiles can be added by editing `kiosk\config.js`** — each profile defines its own slides and timing.

---

## Prerequisites

Install these before running SETUP.bat:

| Software | Where to get it |
|---|---|
| **Node.js LTS** | https://nodejs.org — choose "LTS", run the installer |
| **Google Chrome** | https://google.com/chrome |
| **AWS credentials** | IAM user with the policy below |

---

## First-time setup (do this once)

### Step 1 — Run SETUP.bat
Double-click `SETUP.bat`. It will:
- Install Node.js dependencies in `kiosk/`
- Create `.env` from `.env.example`

### Step 2 — Fill in .env
Open `kiosk\.env` in Notepad and fill in:
```
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012
QUICKSIGHT_KIOSK_USER=TV-IT
```

Ports are already set: info = 3000, stats = 3001.

### Step 3 — Edit config.js (optional)
Open `kiosk\config.js` to modify dashboard/sheet IDs or add new profiles.

Finding your IDs: open a QuickSight dashboard tab in your browser. The URL looks like:
```
/dashboards/DASHBOARD_ID/sheets/SHEET_ID
```

**Auto-scroll slides** — slides that are taller than one screen can be configured to scroll automatically:

```js
{
  name: "Department Visual",
  dashboardId: "...",
  sheetId: "...",
  visualId: "...",
  autoScroll: true,         // enables auto-scroll for this slide
  scrollSteps: 8,           // how many scroll steps across the rotation interval (default: 8)
  scrollContentHeight: 1800 // height in px that the iframe is rendered at (default: 1800)
}
```

`scrollContentHeight` is the most important tuning value. It controls how tall QuickSight
renders the iframe, which determines how much content is drawn. If the scroll stops before
reaching the bottom of the visual, increase this number. If there is dead black space at
the bottom of the scroll, decrease it. Start with `1800` and adjust in ~200px increments
until the bottom of the visual lines up with the bottom of the screen at the end of a
rotation.

### Step 4 — Adjust monitor positions in START.bat
Open `START.bat` in Notepad. Near the top, set the screen coordinates
for where Chrome should open on each monitor:

```bat
:: Stacked vertically (top TV = Windows #2, bottom TV = Windows #1, both 1080p):
:: Info (2 dashboards)  goes on the TOP TV (Windows monitor #2) at Y=0
:: Stats (13 tabs)      goes on the BOTTOM TV (Windows monitor #1) at Y=1080
set MONITOR1_X=0
set MONITOR1_Y=0
set MONITOR2_X=0       <- same X as Monitor 1 (stacked directly below)
set MONITOR2_Y=1080    <- height of Monitor 1 (1080 for 1080p, 2160 for 4K)

:: Side by side (left TV = #1, right TV = #2):
:: set MONITOR1_X=0     set MONITOR1_Y=0
:: set MONITOR2_X=1920  set MONITOR2_Y=0
```

To find your exact values:
  Right-click Desktop → Display Settings → click each monitor → note the resolution.

### Step 5 — Run START.bat
Double-click `START.bat`. Both servers start and Chrome opens in kiosk
mode on each monitor automatically.

**If START.bat doesn't work** (window flashes and closes), use the PowerShell
launcher instead: right-click `START-PS.ps1` -> **Run with PowerShell**.
This version logs every step to `kiosk-launch-ps.log` so you can see exactly
what's failing.

---

## Day-to-day use

| What | How |
|---|---|
| Start the kiosk | Double-click `START.bat` (or `START-PS.ps1` if batch doesn't work) |
| Stop the kiosk | Double-click `STOP.bat` |
| Exit kiosk Chrome | Press `Alt + F4` on that monitor |
| If keyboard is stuck in kiosk | Press `Ctrl + Alt + Delete` then Task Manager and end Chrome |
| START.bat flashes and closes | Use `START-PS.ps1` instead (right-click -> Run with PowerShell). Check `kiosk-launch.log` for batch errors or `kiosk-launch-ps.log` for PowerShell errors |
| Chrome opens on wrong monitor | Edit `MONITOR1_X/Y` / `MONITOR2_X/Y` in `START.bat` or try `--monitor-id` flag |
| Only one TV shows content | Make sure both TVs are detected in Windows Display Settings; increase the delay between Chrome launches in `START.bat` |

---

## Auto-start on Windows login (optional)

To have the kiosk launch automatically every time the PC logs in:

1. Right-click `SETUP-AUTOSTART.ps1` → **Run with PowerShell**
2. Click **Yes** when Windows asks for admin permission
3. Done — the kiosk will now start on every login

To remove auto-start: right-click `REMOVE-AUTOSTART.ps1` → Run with PowerShell.

---

## API Endpoints

The Express server (`kiosk/server.js`) exposes four endpoints. Both monitor instances serve the same frontend (`kiosk/public/index.html`) — which profile is active is determined by the `QUICKSIGHT_PROFILE` environment variable set at startup.

### `GET /api/health`

**Purpose:** Simple liveness check.

**Response:**
```json
{ "status": "ok", "time": "2026-05-19T12:00:00.000Z" }
```

**Frontend usage:** Not used by the frontend. Useful for monitoring/healthcheck tooling.

---

### `GET /api/config`

**Purpose:** Returns the current profile's configuration — display title, rotation/refresh intervals, slide names, and which slides have auto-scroll enabled.

**Response:**
```json
{
  "title": "Stats per Department",
  "rotateMs": 60000,
  "refreshMs": 600000,
  "slideCount": 13,
  "slideNames": ["Deal Review", "Scope Review", "QC", "NEM", "Permitting", ...],
  "autoScrollSlides": []
}
```

**Frontend usage (called during boot in `init()`):**
1. Sets the HUD title (`document.title` and the top-left logo text)
2. Configures the rotation timer (`rotSecs = rotateMs / 1000`) and refresh timer (`refSecs = refreshMs / 1000`)
3. Builds the dot navigation rail with `slideCount` dots
4. Determines which slides need auto-scrolling (`autoScrollSlides` array)

---

### `GET /api/embed`

**Purpose:** Generates signed QuickSight embed URLs for **all slides** in the current profile. Calls AWS `GenerateEmbedUrlForRegisteredUser` once per slide (with a 200ms gap to avoid rate limiting).

**Response:**
```json
{
  "slides": [
    {
      "name": "Deal Review",
      "embedUrl": "https://...quicksight.amazonaws.com/embed/...",
      "sheetId": "da47eea0-...-f2b2b6f9-271c-47fa-887c-5ca1b782dc3b",
      "dashboardId": "da47eea0-bf07-445a-8d2f-468f7c199a6e",
      "autoScroll": false,
      "scrollContentHeight": null,
      "scrollSteps": null
    },
    ...
  ],
  "sessionExpiresAt": 1747656000000
}
```

**Frontend usage (called during boot in `init()`):**
1. After fetching config, the frontend calls `fetchEmbedUrls()` which hits this endpoint
2. The returned `embedUrl` for slide 0 is immediately embedded into the viewport via the QuickSight Embedding SDK
3. Every `refreshMs` (default 10 minutes), the frontend calls this endpoint again to refresh all embed URLs before their session expires

---

### `POST /api/embed-url`

**Purpose:** Generates a **single** QuickSight embed URL on demand. Used when navigating to a slide on a *different* dashboard (which requires a fresh embedding context and new signed URL).

**Request body:**
```json
{
  "dashboardId": "da47eea0-bf07-445a-8d2f-468f7c199a6e",
  "sheetId": "da47eea0-...-f2b2b6f9-271c-47fa-887c-5ca1b782dc3b",
  "visualId": null,
  "name": "Deal Review"
}
```

All fields are accepted; `visualId` is optional and used for single-visual embedding mode.

**Response:**
```json
{ "embedUrl": "https://...quicksight.amazonaws.com/embed/..." }
```

**Frontend usage (called in `goTo()`):**
1. When the user clicks a dot or the auto-rotator advances to a new slide
2. If the new slide is on a **different dashboard** than the current one, the frontend calls `fetchFreshEmbedUrl()` which hits this endpoint
3. The fresh URL is then embedded via the QuickSight SDK (a new `EmbeddingContext` must be created per dashboard)
4. If the new slide is on the **same dashboard**, the frontend uses `navigateToSheet()` (QuickSight SDK method) instead — no API call needed

---

## Architecture

```
START.bat / START-PS.ps1
    │
    ├── Server 1: node server.js  (PORT=3000, QUICKSIGHT_PROFILE=info)
    │   └── Profile "info": 2 slides (Sales & Installs, Department Visual)
    │       └── Chrome on Monitor 1 (top TV) → http://localhost:3000
    │
    └── Server 2: node server.js  (PORT=3001, QUICKSIGHT_PROFILE=stats)
        └── Profile "stats": 13 slides (Deal Review → Home Damage)
            └── Chrome on Monitor 2 (bottom TV) → http://localhost:3001
```

Each server is an Express instance that:
1. Serves the static frontend (`kiosk/public/index.html`)
2. Generates signed QuickSight embed URLs via AWS SDK (`GenerateEmbedUrlForRegisteredUser`)
3. Supports three slide modes: full dashboard, specific sheet, or single visual

The frontend uses the **QuickSight Embedding SDK** (v2.9.0) to embed dashboards in iframes. It handles slide rotation, HUD display (clock, countdown ring, slide name), dot navigation, and auto-scroll for long dashboards.

---

## IAM Policy

Paste this in AWS Console → IAM → your user → Add permissions → JSON.
Replace the placeholder values with your region, account ID, and dashboard IDs.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["quicksight:GenerateEmbedUrlForRegisteredUser"],
      "Resource": [
        "arn:aws:quicksight:YOUR_REGION:YOUR_ACCOUNT_ID:namespace/default",
        "arn:aws:quicksight:YOUR_REGION:YOUR_ACCOUNT_ID:user/default/TV-IT",
        "arn:aws:quicksight:YOUR_REGION:YOUR_ACCOUNT_ID:dashboard/b16a842d-7939-4084-8f01-afb36e1210eb",
        "arn:aws:quicksight:YOUR_REGION:YOUR_ACCOUNT_ID:dashboard/ece79b96-4add-415f-a753-97bca2613117",
        "arn:aws:quicksight:YOUR_REGION:YOUR_ACCOUNT_ID:dashboard/da47eea0-bf07-445a-8d2f-468f7c199a6e"
      ]
    }
  ]
}
```

---

## QuickSight Requirements

1. **Registered user** — register `TV-IT` (or your chosen user) in QuickSight:
   - Go to **Manage QuickSight** → **Users** → **Create user**
   - Set user name to match `QUICKSIGHT_KIOSK_USER` in `.env`
   - Role: **Reader**
2. **Register domains in QuickSight console** (this is the #1 cause of blank/white screens):
   - Go to **Manage QuickSight** → **Domains and embedding**
   - Click **Add domain**
   - Add **both** of these:
     - `http://localhost:3000`
     - `http://localhost:3001`
   - These must match the `ALLOWED_DOMAINS` in `.env`
3. **Dashboards must be published** (not just saved).

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Node.js not found" | Install from nodejs.org, restart PC, re-run SETUP.bat |
| Chrome opens on wrong monitor | Edit MONITOR1_X / MONITOR2_X in START.bat; ensure TVs are detected in Windows Display Settings |
| Both Chrome windows open on the same TV | Increase the timeout between Chrome launches in START.bat (currently 6s); try `--monitor-id` instead of `--app-launch-window-position` |
| Blank screen in Chrome | Check the server window for error messages; verify .env values |
| "AccessDeniedException" | IAM policy is missing `GenerateEmbedUrlForRegisteredUser` or a dashboard ID is wrong |
| "QuickSightUserNotFoundException" | `QUICKSIGHT_KIOSK_USER` not registered in QuickSight — create the user per QuickSight Requirements above |
| "ResourceNotFoundException" | User or dashboard not found — check `QUICKSIGHT_KIOSK_USER` and dashboard IDs |
| Port already in use | Run STOP.bat first, or restart the PC |
| Auto-scroll stops before reaching the bottom | Increase `scrollContentHeight` in `config.js` for that slide (try +200px increments) |
| Auto-scroll ends with black space at the bottom | Decrease `scrollContentHeight` in `config.js` for that slide (try -200px increments) |
