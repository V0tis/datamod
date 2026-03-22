-- Mark if Serper web search was used for this analysis (for result page display)
ALTER TABLE research_history
  ADD COLUMN IF NOT EXISTS serper_used BOOLEAN DEFAULT false;

COMMENT ON COLUMN research_history.serper_used IS '이 분석에 Serper 웹 검색이 사용되었는지 여부';
