-- Attribution ledger for paid model calls.
--
-- This is a meter, not a spend control: the authoritative ceiling is the
-- monthly limit configured on the Anthropic workspace. An application-side
-- check-then-spend sequence cannot enforce a cap (concurrent requests race
-- past the check, and a failed write silently loses the spend it should have
-- counted), so this table exists for visibility and per-team cost, and is
-- deliberately written on a best-effort path.
--
-- team_slug intentionally carries NO foreign key to teams(slug). The ledger has
-- to keep working on a deploy whose teams table was never seeded; an FK there
-- would turn "database not seeded" into "all cost visibility silently lost".
CREATE TABLE IF NOT EXISTS llm_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_slug text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  input_tokens integer NOT NULL,
  output_tokens integer NOT NULL,
  -- Nullable on purpose: an unpriced model still gets its tokens recorded
  -- rather than being dropped or costed at a neighbouring model's rate.
  cost_usd numeric(10, 6),
  -- False for generations the acceptance gate rejected. A rejected answer is
  -- still a billed call, so it belongs here; without this column the ledger
  -- would under-report by exactly the retry path.
  accepted boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS llm_usage_created_at_idx
  ON llm_usage(created_at);

CREATE INDEX IF NOT EXISTS llm_usage_team_created_idx
  ON llm_usage(team_slug, created_at);
