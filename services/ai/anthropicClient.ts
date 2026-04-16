/**
 * Optional Anthropic Messages API — strategy_generation 등 Groq/Gemini 이후 3차 폴백용.
 * user_settings.anthropic_api_key 가 있을 때만 호출된다.
 */

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
/** 빠른 응답·비용 절감을 위해 Haiku 계열 */
const DEFAULT_MODEL = 'claude-3-5-haiku-20241022'

export type AnthropicCompleteResult = {
  text: string
  model: string
}

export async function completeAnthropicMessages(
  apiKey: string,
  systemInstruction: string,
  userContent: string,
  options?: { maxTokens?: number; model?: string }
): Promise<AnthropicCompleteResult> {
  const maxTokens = Math.min(8192, Math.max(256, options?.maxTokens ?? 4096))
  const model = options?.model ?? DEFAULT_MODEL
  const res = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey.trim(),
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemInstruction.slice(0, 200_000),
      messages: [{ role: 'user', content: userContent.slice(0, 200_000) }],
    }),
  })
  const raw = await res.text()
  if (!res.ok) {
    const err = new Error(`Anthropic ${res.status}: ${raw.slice(0, 400)}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  let data: { content?: Array<{ type?: string; text?: string }> }
  try {
    data = JSON.parse(raw) as typeof data
  } catch {
    throw new Error('Anthropic: invalid JSON response')
  }
  const blocks = Array.isArray(data.content) ? data.content : []
  const text = blocks
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('')
    .trim()
  return { text, model }
}
