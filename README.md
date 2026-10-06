# cryogenic-sample-inventory-system

YAS LAB cryogenic sample inventory system.

## Phase 1

The first release replaces the Nitrogen Tank Map spreadsheet with a structured storage map and sample inventory workflow.

See `docs/PHASE1_PLAN.md` and `docs/DATA_MODEL.md` for scope and architecture.

## Google Sheets backend setup

The repository now includes the Apps Script backend in `apps-script/Code.gs`. Follow `docs/GOOGLE_SHEETS_BACKEND.md` to create the Sheet, initialize its tabs, deploy the Web App, and configure `VITE_API_BASE_URL`.
