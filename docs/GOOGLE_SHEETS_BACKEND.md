# Google Sheets + Apps Script Backend

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
