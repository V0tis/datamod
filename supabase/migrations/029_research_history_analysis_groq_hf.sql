-- research_history: Groq / Hugging Face 듀얼 분석 결과 캐시
ALTER TABLE research_history
  ADD COLUMN IF NOT EXISTS analysis_groq JSONB,
  ADD COLUMN IF NOT EXISTS analysis_hf JSONB;

COMMENT ON COLUMN research_history.analysis_groq IS 'Groq(Llama 등) 분석 결과 JSON: { summary, modelName, ... }';
COMMENT ON COLUMN research_history.analysis_hf IS 'Hugging Face(Mistral 등) 분석 결과 JSON: { summary, modelName, ... }';
