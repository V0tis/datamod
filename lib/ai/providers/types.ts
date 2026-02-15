/**
 * AI provider interfaces. Implementations (Gemini, Groq) are swappable.
 * UI and API routes never depend on concrete providers—only on the unified service.
 */
import type {
  GenerateTextInput,
  GenerateTextOutput,
  ResearchWithGroundingInput,
  ResearchWithGroundingOutput,
  ChatCompletionInput,
  ChatCompletionOutput,
  GenerateContentInput,
  GenerateContentOutput,
} from '../schemas'

/** Text generation from a single prompt (e.g. stream analysis, follow-up Q&A). */
export type ITextGenerationProvider = {
  generateText(input: GenerateTextInput): Promise<GenerateTextOutput>
}

/** Research with search grounding (e.g. Gemini Google Search). Provider-specific. */
export type IResearchWithGroundingProvider = {
  generateResearchWithGrounding(
    input: ResearchWithGroundingInput
  ): Promise<ResearchWithGroundingOutput>
}

/** Chat completion with system + user messages (e.g. Groq). */
export type IChatCompletionProvider = {
  completeChat(input: ChatCompletionInput): Promise<ChatCompletionOutput>
}

/** Raw content generation (REST-style, e.g. Gemini generateContent). */
export type IContentGenerationProvider = {
  generateContent(input: GenerateContentInput): Promise<GenerateContentOutput>
}

export type ProviderSet = {
  text: ITextGenerationProvider
  grounding: IResearchWithGroundingProvider
  chat: IChatCompletionProvider
  content: IContentGenerationProvider
}
