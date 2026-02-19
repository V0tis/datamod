-- research_history: structured analysis fields for PM usability
-- analysis_target, confidence_score, market_temperature_score, summary_insights
-- Used for deterministic UI and structured rendering

ALTER TABLE research_history
  ADD COLUMN IF NOT EXISTS analysis_target TEXT;

ALTER TABLE research_history
  ADD COLUMN IF NOT EXISTS confidence_score INTEGER;

ALTER TABLE research_history
  ADD COLUMN IF NOT EXISTS market_temperature_score INTEGER;

ALTER TABLE research_history
  ADD COLUMN IF NOT EXISTS summary_insights TEXT;

COMMENT ON COLUMN research_history.analysis_target IS 'Inferred target: product|company|market|person|policy|technology';
COMMENT ON COLUMN research_history.confidence_score IS 'AI confidence 0-100';
COMMENT ON COLUMN research_history.market_temperature_score IS 'Market temperature 0-100';
COMMENT ON COLUMN research_history.summary_insights IS 'Summary insights for PM display';
