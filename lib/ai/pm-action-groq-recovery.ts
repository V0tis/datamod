/**
 * Groq 413(payload too large) 후 PM 액션 플랜 입력을 Gemini로 압축한 뒤 재시도할 때 사용.
 */
import { GEMINI_MODEL } from '@/lib/gemini-config'
import { generateTextWithUsage } from '@/services/ai/geminiClient'
import { compressTextForPmActionInput } from '@/lib/ai/pipeline-prompts'

const SUMMARY_SYSTEM = `역할: 리서치·전략 입력을 PM 액션 플랜용으로만 압축한다.
- 한국어 유지. 숫자·고유명사·리스크 표현은 빼지 않는다.
- 불릿·소제목 구조를 최대한 유지한다.
- 출력은 지정된 글자 수 이내의 단일 본문이다.`

/**
 * 긴 user 프롬프트를 Groq 한도 안으로 들어오게 요약한다. 실패 시 문자열 절단으로 폴백.
 */
export async function summarizeUserPromptForPmActionGemini(
  geminiKey: string,
  longPrompt: string
): Promise<string> {
  const capped = longPrompt.length > 120_000 ? longPrompt.slice(0, 120_000) : longPrompt
  try {
    const r = await generateTextWithUsage({
      apiKey: geminiKey,
      systemInstruction: SUMMARY_SYSTEM,
      prompt: `다음은 PM 액션 플랜 생성용 입력 전문이다. 외부 API가 요청 크기 한도(413)를 반환했다. 동일한 의사결정에 필요한 정보를 잃지 않도록 핵심만 남겨 4000자 이내로 재작성하라.\n\n---\n${capped}`,
      maxOutputTokens: 2048,
      model: GEMINI_MODEL,
      isRetryable: () => false,
    })
    const t = (r.text ?? '').trim()
    if (t.length >= 400) return t
  } catch (e) {
    console.warn('[pm-action-groq-recovery] Gemini summarize failed, using truncation', {
      message: e instanceof Error ? e.message : String(e),
    })
  }
  return compressTextForPmActionInput(longPrompt, 8000)
}
