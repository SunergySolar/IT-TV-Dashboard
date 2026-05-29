/* ═══════════════════════════════════════════════════════════════
   Unified QuickSight Kiosk Configuration
   ────────────────────────────────────────
   Supports multiple "profiles" — each profile is a separate
   monitor instance with its own set of slides.

   Usage: Set QUICKSIGHT_PROFILE in .env to select one
   ("info" or "stats").

   Each slide supports three modes:
     Full dashboard  — set dashboardId only (sheetId: null)
     Specific sheet  — set dashboardId + sheetId
     Single visual   — set dashboardId + sheetId + visualId
   ═══════════════════════════════════════════════════════════════ */

module.exports = {
  PROFILES: {
    info: {
      DISPLAY_TITLE: "Overall Info",
      ROTATE_INTERVAL_MS: 60_000, // 60 seconds per slide
      REFRESH_INTERVAL_MS: 600_000, // Re-fetch embed URLs every 10 minutes

      SLIDES: [
        {
          name: "Sales & Installs",
          dashboardId: "b16a842d-7939-4084-8f01-afb36e1210eb",
          sheetId: null,
          // visualId:  null,             // uncomment + set to embed a single visual
        },
        {
          name: "Department Visual",
          dashboardId: "ece79b96-4add-415f-a753-97bca2613117",
          sheetId:
            "ece79b96-4add-415f-a753-97bca2613117_3fd6e3b8-a4cf-4aa5-87b5-46811d90767e",
          visualId:
            "ece79b96-4add-415f-a753-97bca2613117_81cf318f-ca69-4451-bd97-61420e05eb88",
          autoScroll: true,
          scrollSteps: 8,
          scrollContentHeight: 1800, // px — how tall the iframe is rendered so QuickSight draws full content
        },
      ],
    },

    stats: {
      DISPLAY_TITLE: "Stats per Department",
      ROTATE_INTERVAL_MS: 60_000, // 60 seconds per slide
      REFRESH_INTERVAL_MS: 600_000, // Re-fetch embed URLs every 10 minutes

      SLIDES: [
        {
          name: "Deal Review",
          dashboardId: "da47eea0-bf07-445a-8d2f-468f7c199a6e",
          sheetId:
            "da47eea0-bf07-445a-8d2f-468f7c199a6e_f2b2b6f9-271c-47fa-887c-5ca1b782dc3b",
        },
        {
          name: "Scope Review",
          dashboardId: "da47eea0-bf07-445a-8d2f-468f7c199a6e",
          sheetId:
            "da47eea0-bf07-445a-8d2f-468f7c199a6e_66d9f541-c6a2-4206-acba-47d1daff69f5",
        },
        {
          name: "QC",
          dashboardId: "da47eea0-bf07-445a-8d2f-468f7c199a6e",
          sheetId:
            "da47eea0-bf07-445a-8d2f-468f7c199a6e_d770153e-3c44-4838-9589-7605fd163152",
        },
        {
          name: "NEM",
          dashboardId: "da47eea0-bf07-445a-8d2f-468f7c199a6e",
          sheetId:
            "da47eea0-bf07-445a-8d2f-468f7c199a6e_5c3ae8e4-d5e9-4cc5-bfb1-5f0089b31396",
        },
        {
          name: "Permitting",
          dashboardId: "da47eea0-bf07-445a-8d2f-468f7c199a6e",
          sheetId:
            "da47eea0-bf07-445a-8d2f-468f7c199a6e_6cff9306-a36e-44d9-ac68-e11f4400e7c9",
        },
        {
          name: "Installations Scheduled",
          dashboardId: "da47eea0-bf07-445a-8d2f-468f7c199a6e",
          sheetId:
            "da47eea0-bf07-445a-8d2f-468f7c199a6e_88c4cec0-9e32-472f-aaf5-53a16b4a0614",
        },
        {
          name: "Field Audit",
          dashboardId: "da47eea0-bf07-445a-8d2f-468f7c199a6e",
          sheetId:
            "da47eea0-bf07-445a-8d2f-468f7c199a6e_afab427c-eeb4-4548-a6fc-9c4290b2cda0",
        },
        {
          name: "Non Standard",
          dashboardId: "da47eea0-bf07-445a-8d2f-468f7c199a6e",
          sheetId:
            "da47eea0-bf07-445a-8d2f-468f7c199a6e_3d3e15ac-87e3-4b83-b2a2-d3ba3f4aca7b",
        },
        {
          name: "M1",
          dashboardId: "da47eea0-bf07-445a-8d2f-468f7c199a6e",
          sheetId:
            "da47eea0-bf07-445a-8d2f-468f7c199a6e_dbcc3ee0-5631-4627-b662-b71f359b845f",
        },
        {
          name: "Inspections",
          dashboardId: "da47eea0-bf07-445a-8d2f-468f7c199a6e",
          sheetId:
            "da47eea0-bf07-445a-8d2f-468f7c199a6e_e9212720-0300-4eb8-b36d-739aa360668c",
        },
        {
          name: "PTO",
          dashboardId: "da47eea0-bf07-445a-8d2f-468f7c199a6e",
          sheetId:
            "da47eea0-bf07-445a-8d2f-468f7c199a6e_d0d64475-06ab-4ee8-abc9-5c7036d84117",
        },
        {
          name: "M2",
          dashboardId: "da47eea0-bf07-445a-8d2f-468f7c199a6e",
          sheetId:
            "da47eea0-bf07-445a-8d2f-468f7c199a6e_9b12bb90-d2ae-4c8f-9918-f11c322023c8",
        },
        {
          name: "Home Damage",
          dashboardId: "da47eea0-bf07-445a-8d2f-468f7c199a6e",
          sheetId:
            "da47eea0-bf07-445a-8d2f-468f7c199a6e_ecf7c2b7-7b7d-49d9-a7b4-82393267334d",
        },
      ],
    },
  },
};
