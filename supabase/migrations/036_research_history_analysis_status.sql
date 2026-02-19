-- research_history: authoritative analysis_status for deterministic UI state
-- Values: queued | analyzing | completed | failed
-- UI renders ONLY from analysis_status; no inference from partial data
ALTER TABLE research_history
  ADD COLUMN IF NOT EXISTS analysis_status TEXT NOT NULL DEFAULT 'completed';

COMMENT ON COLUMN research_history.analysis_status IS 'Authoritative status: queued|analyzing|completed|failed. One-directional: queued→analyzing→completed|failed';
