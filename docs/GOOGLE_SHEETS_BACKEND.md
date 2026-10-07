# Google Sheets + Apps Script Backend

> **Legacy.** The app now runs on Cloud Run with Cloud SQL (PostgreSQL); see `CLOUD_RUN_CLOUD_SQL.md`. The frontend no longer talks to this backend.

## Architecture

GitHub Pages (React) -> Google Apps Script Web App -> Google Sheets

Google Sheets is the persistence layer. Apps Script is the API and handles validation and concurrency locking.

## Sheet tabs

### Samples
sample_id, cell_line, sample_type, passage, cell_count, qc_status, owner, notes, created_at, updated_at

### Storage
storage_id, sample_id, stripe, box, position, updated_at

### Boxes
box_id, stripe, box_number, name, rows, columns

### Activity_Log
timestamp, action, sample_id, from_location, to_location, user, details

## Setup

1. Create a dedicated Google Sheet.
2. Open Extensions -> Apps Script.
3. Add apps-script/Code.gs.
4. Set SPREADSHEET_ID in Code.gs.
5. Run setupSheets() once and authorize.
6. Deploy as Web app.
7. Copy the /exec URL into .env.local as VITE_API_BASE_URL.
8. Run the frontend with npm run dev.

## Safety

- Never put service credentials in React or GitHub.
- Apps Script is the only layer that knows the Sheet structure.
- LockService protects write operations from simultaneous conflicts.
- The API boundary allows a future migration to a real database without rewriting the UI.

## Demo initialization

After setting SPREADSHEET_ID, run these functions from the Apps Script editor in order:
1. setupSheets()
2. seedDemoData()

The demo dataset creates:
- S1-B01: C3 -> YAS-001 / HEK293T; F6 -> YAS-002 / HeLa
- S1-B02: A1 -> YAS-003 / CHO-K1
- S2-B01: empty

seedDemoData() refuses to run when the inventory tabs already contain data, preventing accidental overwrite.

## API smoke test

After deploying the Web App, open:
YOUR_EXEC_URL?action=health

Expected response:
{ "ok": true, "service": "cryogenic-sample-inventory" }

Then open:
YOUR_EXEC_URL?action=inventory

The response should contain samples and boxes. The React Storage Map consumes this same response.
