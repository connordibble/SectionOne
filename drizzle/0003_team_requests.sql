-- Demand signal for team editions: which programs fans actually want covered.
--
-- Deliberately minimal. This is a mailing-list-shaped table, not a CRM: the
-- only fields are what a fan types plus what the server can observe. No
-- tracking identifiers, no referrer, no IP — a request to cover App State does
-- not justify building a profile of the person who asked.
CREATE TABLE IF NOT EXISTS team_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Free text on purpose. Fans type "App State", "Appalachian St", and
  -- "appalachian state" for the same program; normalising at write time would
  -- discard the fan's own words, so the raw entry is kept and grouping is a
  -- read-time concern.
  team_name text NOT NULL,
  team_name_normalized text NOT NULL,
  email text,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Counting demand per program is the entire point of the table.
CREATE INDEX IF NOT EXISTS team_requests_normalized_idx
  ON team_requests(team_name_normalized);

CREATE INDEX IF NOT EXISTS team_requests_created_at_idx
  ON team_requests(created_at);
