# QuickSight Kiosk — Windows 11 Setup

Dual-monitor rotating kiosk for AWS QuickSight dashboards.

```
monitor1\   →  2 dashboards       →  http://localhost:3000
monitor2\   →  13 dashboard tabs  →  http://localhost:3001
```
*** More can be added by copying the .envs you set up, changing ports, and making minor tweaks to the server.js and html files

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
- Install Node.js dependencies for both monitors
- Create `.env` files from the examples

### Step 2 — Fill in both .env files
Open `monitor1\.env` and `monitor2\.env` in Notepad and fill in:
```
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012
```
*** Must have username added for full dashboard + tabs integration
Ports are already set: monitor1 = 3000, monitor2 = 3001.

### Step 3 — Fill in both config.js files
Open `monitor1\config.js` — paste your 2 dashboard IDs.
Open `monitor2\config.js` — paste your dashboard ID and all 13 sheet IDs.

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
      "Action": ["quicksight:GenerateEmbedUrlForAnonymousUser"],
      "Resource": [
        "arn:aws:quicksight:YOUR_REGION:YOUR_ACCOUNT_ID:namespace/default",
        "arn:aws:quicksight:YOUR_REGION:YOUR_ACCOUNT_ID:dashboard/MONITOR1_DASHBOARD_1_ID",
        "arn:aws:quicksight:YOUR_REGION:YOUR_ACCOUNT_ID:dashboard/MONITOR1_DASHBOARD_2_ID",
        "arn:aws:quicksight:YOUR_REGION:YOUR_ACCOUNT_ID:dashboard/MONITOR2_DASHBOARD_ID"
      ]
    }
  ]
}
```

---

## QuickSight Requirements

1. **Enterprise Edition** — anonymous embedding is not available on Standard.
2. **Register domains in QuickSight console** (this is the #1 cause of blank/white screens):
   - Go to **Manage QuickSight** → **Domains and embedding**
   - Click **Add domain**
   - Add **both** of these:
     - `http://localhost:3000`
     - `http://localhost:3001`
   - These must match the `ALLOWED_DOMAINS` in each monitor's `.env` file
3. **Dashboards must be published** (not just saved).

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Node.js not found" | Install from nodejs.org, restart PC, re-run SETUP.bat |
| Chrome opens on wrong monitor | Edit MONITOR1_X / MONITOR2_X in START.bat; ensure TVs are detected in Windows Display Settings |
| Both Chrome windows open on the same TV | Increase the timeout between Chrome launches in START.bat (currently 6s); try `--monitor-id` instead of `--app-launch-window-position` |
| Blank screen in Chrome | Check the server window for error messages; verify .env values |
| "AccessDeniedException" | IAM policy is missing or a dashboard ID is wrong |
| "UnsupportedPricingPlanException" | Account is on Standard edition, not Enterprise |
| Port already in use | Run STOP.bat first, or restart the PC |
