-- research_history: progress step for analysis pipeline (1-5)
-- 1: signal_collection, 2: trend_detection, 3: risk_evaluation, 4: strategy_generation, 5: action_plan_generation
ALTER TABLE research_history
  ADD COLUMN IF NOT EXISTS progress_step INTEGER;

COMMENT ON COLUMN research_history.progress_step IS 'Current pipeline step 0-5 during analysis. Null when completed/failed.';
