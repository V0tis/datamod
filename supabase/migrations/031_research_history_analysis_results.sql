-- research_history: 통합 분석 결과 (Gemini + Groq + HF) JSONB
ALTER TABLE research_history
  ADD COLUMN IF NOT EXISTS analysis_results JSONB;

COMMENT ON COLUMN research_history.analysis_results IS '통합 분석 결과: { gemini, groq, hf } 문자열';
