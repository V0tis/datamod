/**
 * Centralized Gemini API access for research, insight, and consensus flows.
 * All calls use exponential backoff (lib/gemini-retry); routes stay thin.
 */
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_TAB_MODEL, GEMINI_CONSENSUS_MODEL, GEMINI_MODEL } from '@/lib/gemini-config'
import { withExponentialBackoff } from '@/lib/gemini-retry'

const GEMINI_BASE_URL_V1 = 'https://generativelanguage.googleapis.com/v1/models'

const DEFAULT_BACKOFF = { maxRetries: 5, baseDelayMs: 1000 }

/** Build REST generateContent URL for a given model */
export function buildGenerateContentUrl(apiKey: string, model: string): string {
  return `${GEMINI_BASE_URL_V1}/${model}:generateContent?key=${apiKey}`
}

export type GeminiRequestBody = {
  contents: Array<{ parts: Array<{ text: string }> }>
  generationConfig?: { maxOutputTokens?: number }
}

/**
 * Call Gemini v1 REST API with exponential backoff.
 * Throws on 429/5xx after retries; returns Response on success.
 */
export async function requestGenerateContent(
  apiKey: string,
  body: GeminiRequestBody,
  model: string
): Promise<Response> {
  const url = buildGenerateContentUrl(apiKey, model)
  const res = await withExponentialBackoff(
    async () => {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (r.status === 429 || r.status >= 500) {
        const err = new Error(`Gemini ${r.status}`) as Error & { status?: number }
        err.status = r.status
        throw err
      }
      return r
    },
    DEFAULT_BACKOFF
  )
  return res
}

/**
 * Extract text from a successful generateContent REST response.
 * Returns empty string if structure is missing.
 */
export function parseGenerateContentResponse(data: {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
}): string {
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
  return text
}

export type GenerateTextOptions = {
  apiKey: string
  prompt: string
  systemInstruction?: string
  maxOutputTokens?: number
  model?: string
  /** Override retry predicate (e.g. skip retry on 404) */
  isRetryable?: (error: unknown) => boolean
}

/**
 * Generate text via Gemini SDK with exponential backoff.
 * Single responsibility: call model, return text. Throws on failure.
 */
export async function generateText(options: GenerateTextOptions): Promise<string> {
  const {
    apiKey,
    prompt,
    systemInstruction,
    maxOutputTokens = 2048,
    model = GEMINI_TAB_MODEL,
    isRetryable,
  } = options
  const genAI = new GoogleGenerativeAI(apiKey)
  const modelConfig: {
    model: string
    systemInstruction?: string
    generationConfig?: { maxOutputTokens: number }
  } = { model, generationConfig: { maxOutputTokens } }
  if (systemInstruction) modelConfig.systemInstruction = systemInstruction
  const geminiModel = genAI.getGenerativeModel(modelConfig)
  const text = await withExponentialBackoff(
    async () => {
      const result = await geminiModel.generateContent(prompt)
      return result.response.text()
    },
    { ...DEFAULT_BACKOFF, ...(isRetryable ? { isRetryable } : {}) }
  )
  return text
}

/** Model name for tab insight (logic/creative/fact) */
export function getTabModel(): string {
  return GEMINI_TAB_MODEL
}

/** Model name for consensus synthesis */
export function getConsensusModel(): string {
  return GEMINI_CONSENSUS_MODEL
}

export type ResearchWithGroundingResult = {
  text: string
  sourceLinks: Array<{ title: string; url: string }>
}

/**
 * Research flow with Google Search grounding. Returns text and extracted source links.
 * Uses SDK with googleSearchRetrieval tool; single responsibility for research + grounding.
 */
export async function generateResearchWithGrounding(
  apiKey: string,
  prompt: string,
  options: {
    systemInstruction?: string
    maxOutputTokens?: number
    model?: string
    isRetryable?: (error: unknown) => boolean
  } = {}
): Promise<ResearchWithGroundingResult> {
  const {
    systemInstruction,
    maxOutputTokens = 1500,
    model = GEMINI_MODEL,
    isRetryable,
  } = options
  const genAI = new GoogleGenerativeAI(apiKey)
  const geminiModel = genAI.getGenerativeModel({
    model,
    systemInstruction,
    generationConfig: { maxOutputTokens },
    tools: [{ googleSearchRetrieval: {} }],
  })
  const response = await withExponentialBackoff(
    async () => {
      const r = await geminiModel.generateContent(prompt)
      return r.response
    },
    { maxRetries: 5, baseDelayMs: 1000, ...(isRetryable ? { isRetryable } : {}) }
  )
  const text = response.text()
  type GroundingResp = {
    candidates?: Array<{
      groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> }
    }>
  }
  const candidate = (response as GroundingResp).candidates?.[0]
  const chunks = candidate?.groundingMetadata?.groundingChunks ?? []
  const sourceLinks = chunks
    .map((c) => ({
      title: (c.web?.title ?? '제목 없음').slice(0, 200),
      url: c.web?.uri ?? '',
    }))
    .filter((l) => l.url)
  return { text, sourceLinks }
}
