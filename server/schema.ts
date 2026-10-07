/**
 * PostgreSQL schema for Cloud SQL. Every statement is idempotent so it is safe to run on each start.
 * See docs/DATA_MODEL.md for the reasoning behind the constraints.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS stripes (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS boxes (
  id         TEXT PRIMARY KEY,
  stripe_id  TEXT NOT NULL REFERENCES stripes(id),
  name       TEXT NOT NULL,
  rows       INTEGER NOT NULL DEFAULT 9 CHECK (rows > 0),
  columns    TEXT[] NOT NULL DEFAULT ARRAY['A','B','C','D','E','F','G','H','I'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS positions (
  id         TEXT PRIMARY KEY,
  box_id     TEXT NOT NULL REFERENCES boxes(id) ON DELETE CASCADE,
  row_num    INTEGER NOT NULL,
  col        TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (box_id, col, row_num)
);

CREATE TABLE IF NOT EXISTS samples (
  id          TEXT PRIMARY KEY,
  cell_line   TEXT NOT NULL,
  sample_type TEXT NOT NULL DEFAULT '',
  passage     INTEGER,
  cell_count  INTEGER,
  qc_status   TEXT NOT NULL DEFAULT 'Pending' CHECK (qc_status IN ('Pending', 'Passed', 'Failed')),
  owner       TEXT NOT NULL DEFAULT '',
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- position_id as primary key: a position holds at most one sample.
-- UNIQUE sample_id: a sample occupies at most one position.
CREATE TABLE IF NOT EXISTS storage (
  position_id TEXT PRIMARY KEY REFERENCES positions(id),
  sample_id   TEXT NOT NULL UNIQUE REFERENCES samples(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_log (
  id            BIGSERIAL PRIMARY KEY,
  ts            TIMESTAMPTZ NOT NULL DEFAULT now(),
  action        TEXT NOT NULL,
  sample_id     TEXT,
  from_location TEXT NOT NULL DEFAULT '',
  to_location   TEXT NOT NULL DEFAULT '',
  actor         TEXT NOT NULL DEFAULT '',
  details       TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_positions_box ON positions(box_id);
CREATE INDEX IF NOT EXISTS idx_activity_sample ON activity_log(sample_id);
`
