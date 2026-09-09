-- A validated last-good poll survives process restarts and upstream failures.
-- No reader or account information is stored here.
CREATE TABLE IF NOT EXISTS poll_snapshots (
  season integer PRIMARY KEY,
  week integer NOT NULL,
  captured_at timestamptz NOT NULL,
  snapshot jsonb NOT NULL
);
