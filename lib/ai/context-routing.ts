import { GEMINI_LONG_CONTEXT_MODEL } from '@/lib/gemini-config'
import { estimateTokensFromText } from '@/lib/ai/token-estimate'

/** 입력(system + user)이 이 값을 넘기면 Groq 우선 대신 Gemini Long Context 고정 */
export const LONG_CONTEXT_TOKEN_THRESHOLD = 8000

export function estimatePromptTokens(systemInstruction: string, prompt: string): number {
  return estimateTokensFromText(`${systemInstruction}\n${prompt}`)
}

export function shouldForceGeminiLongContext(estimatedTokens: number): boolean {
  return estimatedTokens > LONG_CONTEXT_TOKEN_THRESHOLD
}

export function getLongContextGeminiModel(): string {
  return GEMINI_LONG_CONTEXT_MODEL
}
