/**
 * 프로젝트 전역 Gemini 모델 설정.
 * env: GEMINI_MODEL, GEMINI_TAB_MODEL, GEMINI_CONSENSUS_MODEL 로 오버라이드 가능.
 */
export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash'
export const GEMINI_TAB_MODEL = process.env.GEMINI_TAB_MODEL?.trim() || GEMINI_MODEL
export const GEMINI_CONSENSUS_MODEL = process.env.GEMINI_CONSENSUS_MODEL?.trim() || 'gemini-2.5-flash'
