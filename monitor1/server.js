/* ═══════════════════════════════════════════════════════════════
   QuickSight Kiosk Server v3
   ───────────────────────────
   - Generates anonymous embed URLs for any number of slides
   - Caches per unique dashboard — 13 tabs on the same dashboard
     costs only 1 AWS API call, not 13
   - Supports full-sheet AND single-visual embedding per slide
     (set visualId in config.js to embed one specific visual)

   Start: node server.js
   ═══════════════════════════════════════════════════════════════ */

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const { QuickSightClient, GenerateEmbedUrlForAnonymousUserCommand } = require('@aws-sdk/client-quicksight');
const CONFIG     = require('./config');

// ── Validate environment ─────────────────────────────────────────
const REQUIRED = ['AWS_REGION', 'AWS_ACCOUNT_ID'];
const missing  = REQUIRED.filter(k => !process.env[k]);
if (missing.length) {
  console.error('\n❌  Missing required environment variables:\n');
  missing.forEach(k => console.error(`   ${k}`));
  console.error('\n   Copy .env.example → .env and fill in your values.\n');
  process.exit(1);
}

if (!CONFIG.SLIDES?.length) {
  console.error('\n❌  No slides defined in config.js — add at least one slide.\n');
  process.exit(1);
}

// ── AWS QuickSight client ────────────────────────────────────────
const qsClient = new QuickSightClient({ region: process.env.AWS_REGION });

const ACCOUNT_ID      = process.env.AWS_ACCOUNT_ID;
const NAMESPACE       = process.env.QUICKSIGHT_NAMESPACE || 'default';
const SESSION_MINUTES = parseInt(process.env.EMBED_SESSION_MINUTES || '60', 10);
const ALLOWED         = (process.env.ALLOWED_DOMAINS || 'http://localhost:3000')
                          .split(',').map(d => d.trim()).filter(Boolean);

// ── Generate one embed URL for a slide ──────────────────────────
// Accepts the full slide object so it can switch between
// full-sheet (Dashboard) and single-visual (DashboardVisual) mode.
async function generateEmbedUrl(slide) {
  const arn = `arn:aws:quicksight:${process.env.AWS_REGION}:${ACCOUNT_ID}:dashboard/${slide.dashboardId}`;

  // Single-visual mode: slide has a visualId set
  const experienceConfiguration = slide.visualId
    ? {
        DashboardVisual: {
          InitialDashboardVisualId: {
            DashboardId: slide.dashboardId,
            SheetId:     slide.sheetId,
            VisualId:    slide.visualId,
          },
        },
      }
    // Full-sheet mode: show the whole sheet (or default sheet if no sheetId)
    : {
        Dashboard: {
          InitialDashboardId: slide.dashboardId,
          FeatureConfigurations: {
            StatePersistence: { Enabled: false },
            Bookmarks:        { Enabled: false },
          },
        },
      };

  const command = new GenerateEmbedUrlForAnonymousUserCommand({
    AwsAccountId: ACCOUNT_ID,
    Namespace:    NAMESPACE,
    SessionLifetimeInMinutes: SESSION_MINUTES,
    AuthorizedResourceArns: [arn],
    AllowedDomains: ALLOWED,
    ExperienceConfiguration: experienceConfiguration,
  });

  const res = await qsClient.send(command);
  return res.EmbedUrl;
}

// ── Build all slide URLs for one /api/embed request ──────────────
// Visual slides each need their own API call (they can't share a
// base URL the way sheet slides can). Sheet slides are still cached
// per unique dashboardId to minimise API calls.
async function buildSlideUrls() {
  const slides = CONFIG.SLIDES;

  // Separate visual slides (need individual API calls) from sheet slides
  const visualSlides = slides.filter(s => s.visualId);
  const sheetSlides  = slides.filter(s => !s.visualId);

  // For sheet slides: one API call per unique dashboard, then append sheet fragment
  const uniqueIds = [...new Set(sheetSlides.map(s => s.dashboardId))];
  const sheetUrlEntries = await Promise.all(
    uniqueIds.map(async id => {
      // Use a minimal slide object to call generateEmbedUrl in Dashboard mode
      const url = await generateEmbedUrl({ dashboardId: id });
      return [id, url];
    })
  );
  const baseUrlMap = new Map(sheetUrlEntries);

  // For visual slides: one API call each (URLs are visual-specific)
  await Promise.all(
    visualSlides.map(async slide => {
      slide._embedUrl = await generateEmbedUrl(slide);
    })
  );

  // Assemble final slide list preserving original order
  return slides.map(slide => {
    let embedUrl;

    if (slide.visualId) {
      // Visual embed URL was generated individually above
      embedUrl = slide._embedUrl;
      delete slide._embedUrl; // clean up temp property
    } else {
      // Sheet embed: base dashboard URL + optional sheet fragment
      const base = baseUrlMap.get(slide.dashboardId);
      embedUrl = slide.sheetId
        ? `${base}#p.initialSheetId=${encodeURIComponent(slide.sheetId)}`
        : base;
    }

    return { name: slide.name, embedUrl };
  });
}

// ── Express app ──────────────────────────────────────────────────
const app = express();

app.use(cors({ origin: ALLOWED }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── GET /api/config ──────────────────────────────────────────────
// Sends display config (title, timing) to the frontend at boot.
app.get('/api/config', (_req, res) => {
  res.json({
    title:           CONFIG.DISPLAY_TITLE,
    rotateMs:        CONFIG.ROTATE_INTERVAL_MS,
    refreshMs:       CONFIG.REFRESH_INTERVAL_MS,
    slideCount:      CONFIG.SLIDES.length,
    slideNames:      CONFIG.SLIDES.map(s => s.name),
  });
});

// ── GET /api/embed ───────────────────────────────────────────────
// Returns fresh signed embed URLs for all slides.
app.get('/api/embed', async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Generating embed URLs for ${CONFIG.SLIDES.length} slides…`);

    const slides = await buildSlideUrls();

    console.log(`[${new Date().toISOString()}] ✓ Done (${new Set(CONFIG.SLIDES.map(s => s.dashboardId)).size} unique dashboard(s), ${slides.length} slides)`);

    res.json({
      slides,
      sessionExpiresAt: Date.now() + SESSION_MINUTES * 60 * 1000,
    });

  } catch (err) {
    console.error(`[${new Date().toISOString()}] ✗ Error:`, err.message);

    let hint = 'Check server logs for details.';
    if (err.name === 'UnsupportedPricingPlanException')
      hint = 'Anonymous embedding requires QuickSight Enterprise Edition.';
    else if (err.name === 'ResourceNotFoundException')
      hint = 'A dashboard ID was not found — check config.js dashboardId values.';
    else if (err.name === 'AccessDeniedException')
      hint = 'IAM policy missing quicksight:GenerateEmbedUrlForAnonymousUser — see README.';

    res.status(500).json({ error: err.message, hint });
  }
});

// ── GET /api/health ──────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ── Start ────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, () => {
  const uniqueDashboards = new Set(CONFIG.SLIDES.map(s => s.dashboardId)).size;
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║        QuickSight Kiosk Server — Running         ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`\n  Slides      : ${CONFIG.SLIDES.length} (${uniqueDashboards} unique dashboard${uniqueDashboards > 1 ? 's' : ''})`);
  CONFIG.SLIDES.forEach((s, i) => {
    const mode = s.visualId ? '[visual]' : '[sheet ]';
    console.log(`    ${String(i + 1).padStart(2, ' ')}. ${mode} ${s.name}`);
  });
  console.log(`\n  Rotate      : every ${CONFIG.ROTATE_INTERVAL_MS / 1000}s`);
  console.log(`  Refresh     : every ${CONFIG.REFRESH_INTERVAL_MS / 1000 / 60} min`);
  console.log(`  Region      : ${process.env.AWS_REGION}`);
  console.log(`  Session TTL : ${SESSION_MINUTES} min`);
  console.log(`\n  Open        : http://localhost:${PORT}\n`);
});
