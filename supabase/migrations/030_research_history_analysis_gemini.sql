-- research_history: Gemini 탭 분석 결과 캐시 (Groq/HF와 동일 구조)
ALTER TABLE research_history
  ADD COLUMN IF NOT EXISTS analysis_gemini JSONB;

COMMENT ON COLUMN research_history.analysis_gemini IS 'Gemini 탭별 분석 결과 JSON: Record<tabId, string>';
