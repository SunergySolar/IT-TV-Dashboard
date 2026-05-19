/* ═══════════════════════════════════════════════════════════════
   QuickSight Kiosk Server v4 — Unified
   ────────────────────────────────────
   - Uses GenerateEmbedUrlForRegisteredUser so InitialSheetId works
   - One API call per slide, sheet navigation is fully supported
   - Supports multiple profiles via QUICKSIGHT_PROFILE env var
   - Each profile defines its own slides, timing, and display title

   Start: node server.js
   ═══════════════════════════════════════════════════════════════ */

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const { QuickSightClient, GenerateEmbedUrlForRegisteredUserCommand } = require('@aws-sdk/client-quicksight');
const CONFIG     = require('./config');

// ── Select profile ───────────────────────────────────────────────
const PROFILE_NAME = process.env.QUICKSIGHT_PROFILE || 'info';
const PROFILE      = CONFIG.PROFILES[PROFILE_NAME];

if (!PROFILE) {
  console.error(`\nERROR: Unknown profile "${PROFILE_NAME}".`);
  console.error(`Available profiles: ${Object.keys(CONFIG.PROFILES).join(', ')}\n`);
  process.exit(1);
}

// Alias selected profile as CONFIG for backward compatibility
const CONFIG_SLIDES = PROFILE.SLIDES;

// ── Validate environment ─────────────────────────────────────────
const REQUIRED = ['AWS_REGION', 'AWS_ACCOUNT_ID', 'QUICKSIGHT_KIOSK_USER'];
const missing  = REQUIRED.filter(k => !process.env[k]);
if (missing.length) {
  console.error('\n❌  Missing required environment variables:\n');
  missing.forEach(k => console.error(`   ${k}`));
  console.error('\n   Add them to your .env file.\n');
  process.exit(1);
}

if (!CONFIG_SLIDES?.length) {
  console.error('\n❌  No slides defined in config.js\n');
  process.exit(1);
}

// ── AWS QuickSight client ────────────────────────────────────────
const qsClient = new QuickSightClient({ region: process.env.AWS_REGION });

const ACCOUNT_ID      = process.env.AWS_ACCOUNT_ID;
const NAMESPACE       = process.env.QUICKSIGHT_NAMESPACE || 'default';
const SESSION_MINUTES = parseInt(process.env.EMBED_SESSION_MINUTES || '60', 10);
const KIOSK_USER      = process.env.QUICKSIGHT_KIOSK_USER;
const ALLOWED         = (process.env.ALLOWED_DOMAINS || 'http://localhost:3000')
                          .split(',').map(d => d.trim()).filter(Boolean);

// ── Generate one embed URL for a slide ──────────────────────────
async function generateEmbedUrl(slide) {
  const userArn = `arn:aws:quicksight:${process.env.AWS_REGION}:${ACCOUNT_ID}:user/${NAMESPACE}/${KIOSK_USER}`;

  let experienceConfiguration;

  if (slide.visualId) {
    // Single-visual mode
    experienceConfiguration = {
      DashboardVisual: {
        InitialDashboardVisualId: {
          DashboardId: slide.dashboardId,
          SheetId:     slide.sheetId,
          VisualId:    slide.visualId,
        },
      },
    };
  } else {
    // Dashboard mode — InitialSheetId IS supported for registered users
    const shortSheetId = slide.sheetId?.includes('_')
      ? slide.sheetId.split('_').slice(1).join('_')
      : slide.sheetId;

    experienceConfiguration = {
      Dashboard: {
        InitialDashboardId: slide.dashboardId,
        ...(shortSheetId && { InitialSheetId: shortSheetId }),
        FeatureConfigurations: {
          StatePersistence: { Enabled: false },
          Bookmarks:        { Enabled: false },
        },
      },
    };
  }

  const command = new GenerateEmbedUrlForRegisteredUserCommand({
    AwsAccountId:             ACCOUNT_ID,
    UserArn:                  userArn,
    SessionLifetimeInMinutes: SESSION_MINUTES,
    AllowedDomains:           ALLOWED,
    ExperienceConfiguration:  experienceConfiguration,
  });

  console.log(`[${slide.name}] SheetId being sent:`, experienceConfiguration?.Dashboard?.InitialSheetId || 'NONE');

  const res = await qsClient.send(command);
  return res.EmbedUrl;
}

// ── Build all slide URLs (sequential to avoid rate limiting) ─────
async function buildSlideUrls() {
  const results = [];
  for (const slide of CONFIG_SLIDES) {
    const embedUrl = await generateEmbedUrl(slide);
    results.push({
      name: slide.name,
      embedUrl,
      sheetId: slide.sheetId,
      dashboardId: slide.dashboardId,
      autoScroll: !!slide.autoScroll,
    });
    await new Promise(r => setTimeout(r, 200)); // 200ms gap between calls
  }
  return results;
}

// ── Express app ──────────────────────────────────────────────────
const app = express();

app.use(cors({ origin: ALLOWED }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── GET /api/config ──────────────────────────────────────────────
app.get('/api/config', (_req, res) => {
  res.json({
    title:           PROFILE.DISPLAY_TITLE,
    rotateMs:        PROFILE.ROTATE_INTERVAL_MS,
    refreshMs:       PROFILE.REFRESH_INTERVAL_MS,
    slideCount:      CONFIG_SLIDES.length,
    slideNames:      CONFIG_SLIDES.map(s => s.name),
    autoScrollSlides: CONFIG_SLIDES.reduce((acc, s, i) => s.autoScroll ? [...acc, i] : acc, []),
  });
});

// ── GET /api/embed ───────────────────────────────────────────────
app.get('/api/embed', async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Generating embed URLs for ${CONFIG_SLIDES.length} slides…`);
    const slides = await buildSlideUrls();
    console.log(`[${new Date().toISOString()}] ✓ Done (${slides.length} slides)`);
    res.json({ slides, sessionExpiresAt: Date.now() + SESSION_MINUTES * 60 * 1000 });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ✗ Error:`, err.message);
    let hint = 'Check server logs for details.';
    if (err.name === 'ResourceNotFoundException')
      hint = 'User or dashboard not found — check QUICKSIGHT_KIOSK_USER and dashboardId values.';
    else if (err.name === 'AccessDeniedException')
      hint = 'IAM policy missing quicksight:GenerateEmbedUrlForRegisteredUser permission.';
    else if (err.name === 'QuickSightUserNotFoundException')
      hint = 'QUICKSIGHT_KIOSK_USER not found — make sure the username in .env matches exactly.';
    res.status(500).json({ error: err.message, hint });
  }
});

// ── POST /api/embed-url — generate a single embed URL on demand ─
app.post('/api/embed-url', async (req, res) => {
  try {
    const { dashboardId, sheetId, visualId, name } = req.body;
    const slide = { dashboardId, sheetId, visualId, name: name || 'unknown' };
    const embedUrl = await generateEmbedUrl(slide);
    res.json({ embedUrl });
  } catch (err) {
    console.error(`[embed-url] Error:`, err.message);
    res.status(500).json({ error: err.message, hint: 'Check server logs for details.' });
  }
});

// ── GET /api/health ──────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ── Start ────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║        QuickSight Kiosk Server v4 — Running     ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`\n  Profile    : ${PROFILE_NAME}`);
  console.log(`  Kiosk user : ${KIOSK_USER}`);
  console.log(`  Slides     : ${CONFIG_SLIDES.length}`);
  CONFIG_SLIDES.forEach((s, i) => {
    const mode = s.visualId ? '[visual]' : '[sheet ]';
    console.log(`    ${String(i + 1).padStart(2, ' ')}. ${mode} ${s.name}`);
  });
  console.log(`\n  Rotate     : every ${PROFILE.ROTATE_INTERVAL_MS / 1000}s`);
  console.log(`  Refresh    : every ${PROFILE.REFRESH_INTERVAL_MS / 1000 / 60} min`);
  console.log(`  Region     : ${process.env.AWS_REGION}`);
  console.log(`\n  Open       : http://localhost:${PORT}\n`);
});
