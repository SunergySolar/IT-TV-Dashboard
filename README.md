# QuickSight Kiosk — Windows 11 Setup

Dual-monitor rotating kiosk for AWS QuickSight dashboards.

```
kiosk\
  config.js    →  profiles: "info" (2 dashboards), "stats" (13 tabs)
  server.js    →  unified server (registered-user embed + SDK)
```

*** New profiles can be added by editing `kiosk\config.js` — each profile defines its own slides and timing.

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
