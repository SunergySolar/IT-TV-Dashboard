/* ═══════════════════════════════════════════════════════════════
   MONITOR 1 — Configuration
   ─────────────────────────
   2 dashboards rotating every 60 seconds.
   Edit the SLIDES array with your dashboard/sheet IDs.

   Each slide supports three modes:
     Full dashboard  — set dashboardId only (sheetId: null, no visualId)
     Specific sheet  — set dashboardId + sheetId
     Single visual   — set dashboardId + sheetId + visualId
   ═══════════════════════════════════════════════════════════════ */

module.exports = {

  DISPLAY_TITLE: "Overall Info",

  ROTATE_INTERVAL_MS:  60_000,   // 60 seconds per slide
  REFRESH_INTERVAL_MS: 600_000,  // Re-fetch embed URLs every 10 minutes

  SLIDES: [
    {
      name:        "Dashboard 1 — Sales & Installs",
      dashboardId: "b16a842d-7939-4084-8f01-afb36e1210eb",
      sheetId:     null,     // null = default first tab
      // visualId: null,     // uncomment + set to embed a single visual
    },
    {
      name:        "Dashboard 2 — Department Visual",
      dashboardId: "ece79b96-4add-415f-a753-97bca2613117",
      sheetId:     "ece79b96-4add-415f-a753-97bca2613117_674e8584-cbc5-43ac-8f89-8a3e98a1b56f",
      visualId:    "ece79b96-4add-415f-a753-97bca2613117_7459ce6f-7ae1-440b-a8fe-8f8c0f2d87d2",
    },
  ],

};
