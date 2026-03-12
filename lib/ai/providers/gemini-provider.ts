/**
 * Gemini implementation of text, grounding, and content generation.
 * Delegates to existing Gemini client; no UI or route imports.
 */
import {
  generateText as geminiGenerateText,
  generateResearchWithGrounding as geminiResearchWithGrounding,
  requestGenerateContent,
  parseGenerateContentResponse,
  getTabModel,
  getConsensusModel,
} from '@/services/ai/geminiClient'
import { AI_FALLBACK_MESSAGES } from '@/lib/ai/safe-fetch'
import type {
  ITextGenerationProvider,
  IResearchWithGroundingProvider,
  IContentGenerationProvider,
} from './types'
import type {
  GenerateTextInput,
  ResearchWithGroundingInput,
  GenerateContentInput,
} from '../schemas'

export const createGeminiTextProvider = (): ITextGenerationProvider => ({
  async generateText(input: GenerateTextInput) {
    return geminiGenerateText({
      apiKey: input.apiKey,
      prompt: input.prompt,
      systemInstruction: input.systemInstruction,
      maxOutputTokens: input.maxOutputTokens,
      model: input.model,
      isRetryable: input.isRetryable,
    })
  },
})

export const createGeminiGroundingProvider = (): IResearchWithGroundingProvider => ({
  async generateResearchWithGrounding(input: ResearchWithGroundingInput) {
    return geminiResearchWithGrounding(input.apiKey, input.prompt, {
      systemInstruction: input.systemInstruction,
      maxOutputTokens: input.maxOutputTokens,
      model: input.model,
      isRetryable: input.isRetryable,
    })
  },
})

export const createGeminiContentProvider = (): IContentGenerationProvider => ({
  async generateContent(input: GenerateContentInput) {
    try {
      const body = {
        contents: input.contents,
        generationConfig: { maxOutputTokens: input.maxOutputTokens ?? 2048 },
      }
      const res = await requestGenerateContent(input.apiKey, body, input.model)
      let data: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
      try {
        data = (await res.json()) as typeof data
      } catch {
        throw new Error(AI_FALLBACK_MESSAGES.GENERIC)
      }
      if (!res.ok) {
        throw new Error(res.status === 429 ? AI_FALLBACK_MESSAGES.QUOTA : AI_FALLBACK_MESSAGES.GENERIC)
      }
      const text = parseGenerateContentResponse(data)
      if (typeof text !== 'string' || text.trim().length === 0) {
        throw new Error(AI_FALLBACK_MESSAGES.GENERIC)
      }
      return text
    } catch (e) {
      const msg = e instanceof Error ? e.message : AI_FALLBACK_MESSAGES.GENERIC
      throw new Error(msg)
    }
  },
})

/** Model names for tab and consensus; used by unified service when calling content provider. */
export function getGeminiTabModel(): string {
  return getTabModel()
}

export function getGeminiConsensusModel(): string {
  return getConsensusModel()
}
