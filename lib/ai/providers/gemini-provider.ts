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
    const body = {
      contents: input.contents,
      generationConfig: { maxOutputTokens: input.maxOutputTokens ?? 2048 },
    }
    const res = await requestGenerateContent(input.apiKey, body, input.model)
    const data = (await res.json().catch(() => ({}))) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    if (!res.ok) throw new Error(`Gemini ${res.status}`)
    return parseGenerateContentResponse(data)
  },
})

/** Model names for tab and consensus; used by unified service when calling content provider. */
export function getGeminiTabModel(): string {
  return getTabModel()
}

export function getGeminiConsensusModel(): string {
  return getConsensusModel()
}
