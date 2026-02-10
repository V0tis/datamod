-- research_history: Hugging Face 제거에 따른 analysis_hf 컬럼 삭제
ALTER TABLE research_history
  DROP COLUMN IF EXISTS analysis_hf;
