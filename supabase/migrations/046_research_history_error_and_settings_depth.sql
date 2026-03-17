-- research_history: fail reason when analysis_status = 'failed'
ALTER TABLE research_history
  ADD COLUMN IF NOT EXISTS error_message TEXT;
COMMENT ON COLUMN research_history.error_message IS 'Reason when analysis_status = failed (e.g. timeout, abort, step error)';

-- research_history: depth used for this run (fast | standard | deep) for result page badges
ALTER TABLE research_history
  ADD COLUMN IF NOT EXISTS analysis_depth TEXT;
COMMENT ON COLUMN research_history.analysis_depth IS 'Depth used for this run: fast, standard, deep. For display and estimates.';

-- user_settings: analysis depth (fast | standard | deep) for runResearch mode
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS analysis_depth TEXT NOT NULL DEFAULT 'standard';
COMMENT ON COLUMN user_settings.analysis_depth IS 'Analysis depth: fast(quick), standard, deep. Passed to runResearch as mode.';
