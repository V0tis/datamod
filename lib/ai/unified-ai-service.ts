/**
 * Unified AI service: single entry point for all AI operations.
 * - Clear input/output schemas per operation (see schemas.ts).
 * - Uses swappable providers (Gemini, Groq); UI and routes never touch providers directly.
 * - Each function has a single responsibility.
 */
import { sleep, REQUEST_GAP_MS } from '@/lib/gemini-retry'
import {
  buildConsensusPrompt,
  parseConsensusFromRawText,
  FALLBACK_CONSENSUS,
  normalizeConsensus,
} from '@/services/ai/consensusService'
import {
  createGeminiTextProvider,
  createGeminiGroundingProvider,
  createGeminiContentProvider,
  getGeminiTabModel,
  getGeminiConsensusModel,
} from './providers/gemini-provider'
import { createGroqChatProvider } from './providers/groq-provider'
import type { ProviderSet } from './providers/types'
import type {
  GenerateTextInput,
  GenerateTextOutput,
  ResearchWithGroundingInput,
  ResearchWithGroundingOutput,
  ChatCompletionInput,
  ChatCompletionOutput,
  TabAnalysisInput,
  TabAnalysisOutput,
  SynthesizeConsensusInput,
  SynthesizeConsensusOutput,
  Consensus,
} from './schemas'

export type {
  GenerateTextInput,
  GenerateTextOutput,
  ResearchWithGroundingInput,
  ResearchWithGroundingOutput,
  ChatCompletionInput,
  ChatCompletionOutput,
  TabAnalysisInput,
  TabAnalysisOutput,
  SynthesizeConsensusInput,
  SynthesizeConsensusOutput,
  Consensus,
  ConsensusImpactItem,
  ConsensusSentiment,
  ConsensusStrategicSummary,
  ConsensusMetadata,
} from './schemas'

let defaultProviders: ProviderSet | null = null

function getDefaultProviders(): ProviderSet {
  if (!defaultProviders) {
    defaultProviders = {
      text: createGeminiTextProvider(),
      grounding: createGeminiGroundingProvider(),
      chat: createGroqChatProvider(),
      content: createGeminiContentProvider(),
    }
  }
  return defaultProviders
}

/**
 * For tests: inject providers so Gemini/Groq can be swapped or mocked.
 * Call with null to reset to default.
 */
export function setAiProviders(providers: ProviderSet | null): void {
  defaultProviders = providers
}

/**
 * Generate text from a single prompt (e.g. stream analysis, follow-up Q&A).
 * Uses the default text provider (Gemini).
 */
export async function generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
  return getDefaultProviders().text.generateText(input)
}

/**
 * Research with search grounding (e.g. Gemini Google Search).
 * Uses the default grounding provider (Gemini).
 */
export async function generateResearchWithGrounding(
  input: ResearchWithGroundingInput
): Promise<ResearchWithGroundingOutput> {
  return getDefaultProviders().grounding.generateResearchWithGrounding(input)
}

/**
 * Chat completion with system + user messages (e.g. Groq).
 * Uses the default chat provider (Groq).
 */
export async function completeChat(
  input: ChatCompletionInput
): Promise<ChatCompletionOutput> {
  return getDefaultProviders().chat.completeChat(input)
}

/**
 * Run tab analysis: Groq and/or Gemini with the same prompts.
 * Single responsibility: orchestrate chat + content providers; sequential when both needed.
 */
export async function runTabAnalysis(input: TabAnalysisInput): Promise<TabAnalysisOutput> {
  const { groqKey, geminiKey, provider, systemPrompt, userPrompt } = input
  const needGroq = provider === 'all' || provider === 'groq'
  const needGemini = provider === 'all' || provider === 'gemini'
  const providers = getDefaultProviders()

  const callGroq = async (): Promise<{ text: string | null; quotaError: boolean }> => {
    if (!needGroq || !groqKey) return { text: null, quotaError: false }
    const result = await providers.chat.completeChat({
      apiKey: groqKey,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })
    return {
      text: result.text ?? null,
      quotaError: result.quotaError === true,
    }
  }

  const callGemini = async (): Promise<{ text: string | null; quotaExceeded: boolean }> => {
    if (!needGemini || !geminiKey) return { text: null, quotaExceeded: false }
    try {
      const text = await providers.content.generateContent({
        apiKey: geminiKey,
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        model: getGeminiTabModel(),
        maxOutputTokens: 2048,
      })
      return { text: text || null, quotaExceeded: false }
    } catch (e) {
      const is429 = (e as { status?: number })?.status === 429
      return { text: null, quotaExceeded: is429 }
    }
  }

  let groqResult: { text: string | null; quotaError: boolean }
  let geminiResult: { text: string | null; quotaExceeded: boolean }

  if (needGroq && needGemini) {
    groqResult = await callGroq()
    await sleep(REQUEST_GAP_MS)
    geminiResult = await callGemini()
  } else if (needGroq) {
    groqResult = await callGroq()
    geminiResult = { text: null, quotaExceeded: false }
  } else if (needGemini) {
    geminiResult = await callGemini()
    groqResult = { text: null, quotaError: false }
  } else {
    groqResult = { text: null, quotaError: false }
    geminiResult = { text: null, quotaExceeded: false }
  }

  return {
    groqText: groqResult.text,
    geminiText: geminiResult.text,
    groqQuotaError: groqResult.quotaError,
    geminiQuotaExceeded: geminiResult.quotaExceeded,
  }
}

/**
 * Synthesize two analyses (Gemini + Groq) into one Consensus.
 * Uses the default content provider (Gemini consensus model). Never throws.
 */
export async function synthesizeConsensus(
  input: SynthesizeConsensusInput
): Promise<SynthesizeConsensusOutput> {
  const { apiKey, geminiAnalysis, groqAnalysis } = input
  const g = String(geminiAnalysis ?? '').trim()
  const r = String(groqAnalysis ?? '').trim()
  if (g.length < 20 && r.length < 20) return FALLBACK_CONSENSUS

  const prompt = buildConsensusPrompt(geminiAnalysis, groqAnalysis)
  if (!prompt) return FALLBACK_CONSENSUS

  try {
    const rawText = await getDefaultProviders().content.generateContent({
      apiKey,
      contents: [{ parts: [{ text: prompt }] }],
      model: getGeminiConsensusModel(),
      maxOutputTokens: 8192,
    })
    return parseConsensusFromRawText(rawText)
  } catch (e) {
    console.warn('[Unified AI] Consensus synthesis', e)
    return FALLBACK_CONSENSUS
  }
}

/** Normalize raw DB/API payload into Consensus (pure; no AI). Re-export for routes. */
export { normalizeConsensus, FALLBACK_CONSENSUS }
