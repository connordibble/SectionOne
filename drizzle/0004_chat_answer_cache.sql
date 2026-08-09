-- Cached answers for questions already asked by someone else.
--
-- Only escalated answers land here. Composer answers are already deterministic
-- and free, so caching them would add a database round trip to save nothing,
-- and would introduce a staleness risk where none exists today.
--
-- `corpus_version` is the whole safety story. An answer is a function of the
-- question AND the sources behind it, so when the weekly package publishes or
-- a schedule is rebuilt, every row keyed to the old version stops matching.
-- Without it the cache would serve last Sunday's read with this Sunday's
-- confidence, which is the one failure this product cannot absorb.
CREATE TABLE IF NOT EXISTS chat_answer_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_slug text NOT NULL,
  -- Case- and punctuation-folded, so trivial rephrasings share a row without
  -- any embedding call at all.
  question_normalized text NOT NULL,
  -- Null when no real embedding provider is configured. The deterministic
  -- offline embedder is a hash, not a semantic model, so similarity between
  -- its vectors is meaningless and must never drive a cache hit.
  question_embedding vector(1536),
  corpus_version text NOT NULL,
  -- The public answer shape, already stripped of provider and model.
  answer jsonb NOT NULL,
  hit_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_hit_at timestamptz
);

-- The exact-match path: one lookup, no vector scan.
CREATE UNIQUE INDEX IF NOT EXISTS chat_answer_cache_exact_idx
  ON chat_answer_cache (team_slug, corpus_version, question_normalized);

-- Ages rows out independently of corpus changes, so a team whose sources sat
-- still for a month does not serve month-old answers.
CREATE INDEX IF NOT EXISTS chat_answer_cache_created_at_idx
  ON chat_answer_cache (created_at);
