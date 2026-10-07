# Cloud Run + Cloud SQL (PostgreSQL)

This replaces the Google Sheets + Apps Script backend (see `GOOGLE_SHEETS_BACKEND.md`, now legacy).

## Architecture

```
Browser -> Cloud Run (one container) -> Cloud SQL for PostgreSQL
           ├─ /api/*  Express API (server/)
           └─ /       React build (dist/)
```

One Cloud Run service serves both the React app and the API, so the frontend uses same-origin `/api` calls and needs no CORS or API URL setting.

The database enforces the rules from `DATA_MODEL.md`:

- `storage.position_id` is the primary key, so a position can never hold two samples.
- `storage.sample_id` is unique, so a sample can never be in two positions.
- A move is one transaction (lock the sample's storage row, check the target is free, update the row, write the activity log).

The schema (`server/schema.ts`) is idempotent and applied automatically when the server starts, under a Postgres advisory lock so several instances can start at once.

## API

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| GET | `/api/health` | | `{ ok, service }` (also checks the database) |
| GET | `/api/inventory` | | `{ samples, boxes }` |
| POST | `/api/samples` | `{ action: "create" \| "update", sample }` | the saved sample |
| POST | `/api/move` | `{ sampleId, toLocationId }` | the moved sample |

Errors are JSON `{ error }` with status 400 (invalid input), 404 (not found) or 409 (position already occupied).

`update` changes sample metadata only; location changes must go through `move`.

## Local development

```bash
npm install                      # commit the generated package-lock.json
createdb cryogenic_inventory     # any local PostgreSQL 14+
cp .env.example .env.local       # then export DATABASE_URL (or use DB_* variables)
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/cryogenic_inventory
npm run db:seed                  # optional demo data (refuses to run on a non-empty database)
npm run dev:server               # API on :8080
npm run dev                      # Vite on :5173, proxies /api to :8080
```

Build and run the production bundle locally:

```bash
npm run build:all
npm start
```

## Deploy to Google Cloud

Set the variables once:

```bash
PROJECT_ID=your-project
REGION=asia-east1
INSTANCE=cryogenic-inventory
DB_NAME=cryogenic_inventory
DB_USER=app
SERVICE=cryogenic-inventory
gcloud config set project $PROJECT_ID
```

### 1. Enable APIs

```bash
gcloud services enable run.googleapis.com sqladmin.googleapis.com \
  cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

### 2. Create the Cloud SQL instance, database and user

```bash
gcloud sql instances create $INSTANCE \
  --database-version=POSTGRES_16 --edition=ENTERPRISE \
  --tier=db-f1-micro --region=$REGION --backup-start-time=18:00
gcloud sql databases create $DB_NAME --instance=$INSTANCE
DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')
gcloud sql users create $DB_USER --instance=$INSTANCE --password="$DB_PASSWORD"
```

`db-f1-micro` is the cheapest tier and is enough to start; change `--tier` for more capacity. Automated backups are enabled with `--backup-start-time` (UTC). Keep the instance in the same region as Cloud Run.

### 3. Store the password in Secret Manager

```bash
printf '%s' "$DB_PASSWORD" | gcloud secrets create cryogenic-db-password --data-file=-
```

### 4. Create a runtime service account

```bash
gcloud iam service-accounts create cryogenic-run --display-name="Cryogenic inventory runtime"
SA=cryogenic-run@$PROJECT_ID.iam.gserviceaccount.com
gcloud projects add-iam-policy-binding $PROJECT_ID --member=serviceAccount:$SA --role=roles/cloudsql.client
gcloud secrets add-iam-policy-binding cryogenic-db-password --member=serviceAccount:$SA --role=roles/secretmanager.secretAccessor
```

### 5. Build and deploy

Run from the repository root; Cloud Build uses the `Dockerfile`.

```bash
gcloud run deploy $SERVICE --source . --region $REGION \
  --service-account=$SA \
  --add-cloudsql-instances=$PROJECT_ID:$REGION:$INSTANCE \
  --set-env-vars=INSTANCE_CONNECTION_NAME=$PROJECT_ID:$REGION:$INSTANCE,DB_NAME=$DB_NAME,DB_USER=$DB_USER \
  --set-secrets=DB_PASSWORD=cryogenic-db-password:latest \
  --max-instances=2 \
  --no-allow-unauthenticated
```

`--max-instances=2` keeps the total number of database connections low (each instance opens at most 5, see `DB_POOL_MAX`), which matters on small Cloud SQL tiers.

On first start the server creates the tables. Then check:

```bash
gcloud run services proxy $SERVICE --region $REGION      # authenticated local tunnel on :8080
curl http://localhost:8080/api/health
```

### 6. Load the demo data (optional)

Use the Cloud SQL Auth Proxy from your machine ([install guide](https://cloud.google.com/sql/docs/postgres/connect-auth-proxy)):

```bash
cloud-sql-proxy $PROJECT_ID:$REGION:$INSTANCE --port 5432 &
DATABASE_URL="postgres://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME" npm run db:seed
```

The seed creates the same demo data as the old Apps Script `seedDemoData()`: 2 stripes, 3 boxes with 81 positions each, and samples YAS-001, YAS-002 and YAS-003.

## Access control — read this before opening the service to users

Phase 1 has no application login (see `PHASE1_PLAN.md`). The commands above therefore deploy with `--no-allow-unauthenticated`, so only Google identities with the `roles/run.invoker` role can call the service:

```bash
gcloud run services add-iam-policy-binding $SERVICE --region $REGION \
  --member=user:someone@example.com --role=roles/run.invoker
```

A plain browser cannot attach that IAM token, so lab members can use `gcloud run services proxy`, or you can put the service behind Identity-Aware Proxy (see the Cloud Run documentation for IAP). Using `--allow-unauthenticated` would expose the whole inventory to anyone who has the URL; only do that once application-level authentication exists.

## Data from the old Google Sheets backend

There is no automatic copy. The Excel / Sheets import is milestone P5 in `PHASE1_PLAN.md`. Until then, boxes and positions are created by the seed script or by SQL (insert into `stripes`, `boxes`, then one `positions` row per box cell with id `<boxId>-<column><row>`, for example `S1-B01-C3`).

## Backups and restore

Cloud SQL automated backups are configured in step 2. Restore with `gcloud sql backups list --instance=$INSTANCE` and `gcloud sql backups restore`. For an ad-hoc export use `gcloud sql export sql`.
