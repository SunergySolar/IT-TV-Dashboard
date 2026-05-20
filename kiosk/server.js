/* ═══════════════════════════════════════════════════════════════
   QuickSight Kiosk Server v4 — Unified
   ────────────────────────────────────
   - Uses GenerateEmbedUrlForRegisteredUser so InitialSheetId works
   - One API call per slide, sheet navigation is fully supported
   - Supports multiple profiles via QUICKSIGHT_PROFILE env var
   - Each profile defines its own slides, timing, and display title

   Start: node server.js
   ═══════════════════════════════════════════════════════════════ */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const {
  QuickSightClient,
  GenerateEmbedUrlForRegisteredUserCommand,
} = require("@aws-sdk/client-quicksight");
const CONFIG = require("./config");

// ── Logger ───────────────────────────────────────────────────────
const DEBUG = process.env.DEBUG === "true";

class Logger {
  constructor(tag) {
    this.tag = tag;
  }
  _ts() {
    return new Date().toISOString();
  }
  _fmt(fn, params) {
    return `[${this._ts()}] [${this.tag}] [${fn}]${params ? " " + JSON.stringify(params) : ""}`;
  }
  info(fn, params) {
    if (DEBUG) console.log(this._fmt(fn, params));
  }
  warn(fn, params) {
    if (DEBUG) console.warn(this._fmt(fn, params));
  }
  error(fn, params) {
    console.error(this._fmt(fn, params));
  }
}
const log = new Logger("server");

// ── Select profile ───────────────────────────────────────────────
const PROFILE_NAME = process.env.QUICKSIGHT_PROFILE || "info";
const PROFILE = CONFIG.PROFILES[PROFILE_NAME];

if (!PROFILE) {
  log.error("init", {
    error: `Unknown profile "${PROFILE_NAME}"`,
    available: Object.keys(CONFIG.PROFILES),
  });
  process.exit(1);
}

// Alias selected profile as CONFIG for backward compatibility
const CONFIG_SLIDES = PROFILE.SLIDES;

// ── Validate environment ─────────────────────────────────────────
const REQUIRED = ["AWS_REGION", "AWS_ACCOUNT_ID", "QUICKSIGHT_KIOSK_USER"];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  log.error("init", {
    error: "Missing required environment variables",
    missing,
  });
  process.exit(1);
}

if (!CONFIG_SLIDES?.length) {
  log.error("init", { error: "No slides defined in config.js" });
  process.exit(1);
}

// ── AWS QuickSight client ────────────────────────────────────────
const qsClient = new QuickSightClient({ region: process.env.AWS_REGION });

const ACCOUNT_ID = process.env.AWS_ACCOUNT_ID;
const NAMESPACE = process.env.QUICKSIGHT_NAMESPACE || "default";
const SESSION_MINUTES = parseInt(process.env.EMBED_SESSION_MINUTES || "60", 10);
const KIOSK_USER = process.env.QUICKSIGHT_KIOSK_USER;
const ALLOWED = (process.env.ALLOWED_DOMAINS || "http://localhost:3000")
  .split(",")
  .map((d) => d.trim())
  .filter(Boolean);

// ── Generate one embed URL for a slide ──────────────────────────
// Builds the appropriate ExperienceConfiguration (visual or dashboard) and calls QuickSight to get a signed URL
async function generateEmbedUrl(slide) {
  log.info("generateEmbedUrl", {
    slide: slide?.name,
    dashboardId: slide?.dashboardId,
    sheetId: slide?.sheetId,
    visualId: slide?.visualId,
  });

  const userArn = `arn:aws:quicksight:${process.env.AWS_REGION}:${ACCOUNT_ID}:user/${NAMESPACE}/${KIOSK_USER}`;

  let experienceConfiguration;

  // Dashboard mode — InitialSheetId IS supported for registered users
  const shortSheetId = slide.sheetId?.includes("_")
    ? slide.sheetId.split("_").slice(1).join("_")
    : slide.sheetId;

  experienceConfiguration = {
    ...(!slide?.visualId && {
      Dashboard: {
        InitialDashboardId: slide.dashboardId,
        ...(shortSheetId && { InitialSheetId: shortSheetId }),
        FeatureConfigurations: {
          StatePersistence: { Enabled: false },
          Bookmarks: { Enabled: false },
        },
      },
    }),
    ...(slide?.visualId && {
      DashboardVisual: {
        InitialDashboardVisualId: {
          DashboardId: slide.dashboardId,
          SheetId: slide.sheetId,
          VisualId: slide.visualId,
        },
      },
    }),
  };

  const command = new GenerateEmbedUrlForRegisteredUserCommand({
    AwsAccountId: ACCOUNT_ID,
    UserArn: userArn,
    SessionLifetimeInMinutes: SESSION_MINUTES,
    AllowedDomains: ALLOWED,
    ExperienceConfiguration: experienceConfiguration,
  });

  log.info("generateEmbedUrl", {
    dashboardIdSent: { ...experienceConfiguration },
  });

  const res = await qsClient.send(command);
  if (!res.EmbedUrl)
    throw new Error(`AWS returned no EmbedUrl for slide "${slide.name}"`);
  return res.EmbedUrl;
}

// ── Build all slide URLs ─────────────────────────────────────────
// Sheet slides share a base URL per dashboard (one API call each unique dashboardId).
// Visual slides each get their own API call. Both sets run in parallel.
async function buildSlideUrls() {
  log.info("buildSlideUrls", { slideCount: CONFIG_SLIDES.length });

  const slides = CONFIG_SLIDES;

  const visualSlides = slides.filter(s => s.visualId);
  const sheetSlides  = slides.filter(s => !s.visualId);

  const delay = () => new Promise(r => setTimeout(r, 200));

  // One API call per unique dashboard for sheet slides
  const uniqueIds = [...new Set(sheetSlides.map(s => s.dashboardId))];
  const baseUrlMap = new Map();
  for (const id of uniqueIds) {
    baseUrlMap.set(id, await generateEmbedUrl({ dashboardId: id }));
    await delay();
  }

  // One API call per visual slide
  for (const slide of visualSlides) {
    slide._embedUrl = await generateEmbedUrl(slide);
    await delay();
  }

  // Assemble final list preserving original order
  return slides.map(slide => {
    let embedUrl;

    if (slide.visualId) {
      embedUrl = slide._embedUrl;
      delete slide._embedUrl;
    } else {
      const base = baseUrlMap.get(slide.dashboardId);
      embedUrl = slide.sheetId
        ? `${base}#p.initialSheetId=${encodeURIComponent(slide.sheetId)}`
        : base;
    }

    return {
      name:        slide.name,
      embedUrl,
      visualId:    slide.visualId,
      sheetId:     slide.sheetId,
      dashboardId: slide.dashboardId,
      autoScroll:  !!slide.autoScroll,
    };
  });
}

// ── Express app ──────────────────────────────────────────────────
const app = express();

app.use(cors({ origin: ALLOWED }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ── GET /api/config ──────────────────────────────────────────────
// Returns kiosk display settings: title, timing intervals, slide names, and auto-scroll indices
app.get("/api/config", (_req, res) => {
  log.info("GET /api/config", { profile: PROFILE_NAME });

  res.json({
    title: PROFILE.DISPLAY_TITLE,
    rotateMs: PROFILE.ROTATE_INTERVAL_MS,
    refreshMs: PROFILE.REFRESH_INTERVAL_MS,
    slideCount: CONFIG_SLIDES.length,
    slideNames: CONFIG_SLIDES.map((s) => s.name),
    autoScrollSlides: CONFIG_SLIDES.reduce(
      (acc, s, i) => (s.autoScroll ? [...acc, i] : acc),
      [],
    ),
    debug: DEBUG,
  });
});

// ── GET /api/embed ───────────────────────────────────────────────
// Generates signed embed URLs for all configured slides and returns them as a JSON array
app.get("/api/embed", async (req, res) => {
  log.info("GET /api/embed", {
    profile: PROFILE_NAME,
    slideCount: CONFIG_SLIDES.length,
  });

  try {
    log.info("GET /api/embed", { status: "generating URLs" });
    const slides = await buildSlideUrls();
    log.info("GET /api/embed", { status: "done", count: slides.length });
    res.json({
      slides,
      sessionExpiresAt: Date.now() + SESSION_MINUTES * 60 * 1000,
    });
  } catch (err) {
    log.error("GET /api/embed", { error: err.message });
    let hint = "Check server logs for details.";
    if (err.name === "ResourceNotFoundException")
      hint =
        "User or dashboard not found — check QUICKSIGHT_KIOSK_USER and dashboardId values.";
    else if (err.name === "AccessDeniedException")
      hint =
        "IAM policy missing quicksight:GenerateEmbedUrlForRegisteredUser permission.";
    else if (err.name === "QuickSightUserNotFoundException")
      hint =
        "QUICKSIGHT_KIOSK_USER not found — make sure the username in .env matches exactly.";
    res.status(500).json({ error: err.message, hint });
  }
});

// ── POST /api/embed-url — generate a single embed URL on demand ─
// Accepts a slide descriptor in the request body and returns a fresh signed embed URL
app.post("/api/embed-url", async (req, res) => {
  log.info("POST /api/embed-url", req.body);

  try {
    const { dashboardId, sheetId, visualId, name } = req.body;
    const slide = { dashboardId, sheetId, visualId, name: name || "unknown" };
    const embedUrl = await generateEmbedUrl(slide);
    res.json({ embedUrl });
  } catch (err) {
    log.error("POST /api/embed-url", { error: err.message });
    res
      .status(500)
      .json({ error: err.message, hint: "Check server logs for details." });
  }
});

// ── GET /api/health ──────────────────────────────────────────────
// Simple liveness check — returns status ok and current server time
app.get("/api/health", (_req, res) => {
  log.info("GET /api/health");

  res.json({ status: "ok", time: new Date().toISOString() });
});

// ── Start ────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "3000", 10);
app.listen(PORT, () => {
  log.info("startup", {
    profile: PROFILE_NAME,
    kioskUser: KIOSK_USER,
    slides: CONFIG_SLIDES.map(
      (s, i) => `${i + 1}. ${s.visualId ? "[visual]" : "[sheet ]"} ${s.name}`,
    ),
    rotateEvery: `${PROFILE.ROTATE_INTERVAL_MS / 1000}s`,
    refreshEvery: `${PROFILE.REFRESH_INTERVAL_MS / 1000 / 60}min`,
    region: process.env.AWS_REGION,
    url: `http://localhost:${PORT}`,
  });
});
