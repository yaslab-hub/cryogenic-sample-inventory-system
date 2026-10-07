# cryogenic-sample-inventory-system

YAS LAB cryogenic sample inventory system.

## Phase 1

The first release replaces the Nitrogen Tank Map spreadsheet with a structured storage map and sample inventory workflow.

See `docs/PHASE1_PLAN.md` and `docs/DATA_MODEL.md` for scope and architecture.

## Running it

The app is a React frontend plus a Node (Express) API backed by PostgreSQL, packaged as one container for Google Cloud Run with Cloud SQL as the database.

- Local development and deployment: `docs/CLOUD_RUN_CLOUD_SQL.md`

## Legacy: Google Sheets backend

The earlier Apps Script + Google Sheets backend is still in `apps-script/Code.gs` and described in `docs/GOOGLE_SHEETS_BACKEND.md`. The frontend no longer calls it; it now uses the same-origin `/api` endpoints of the Node server.
