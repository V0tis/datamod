/**
 * Groq implementation of chat completion.
 * Delegates to existing Groq client; no UI or route imports.
 */
import { completeChat as groqCompleteChat } from '@/services/ai/groqClient'
import type { IChatCompletionProvider } from './types'
import type { ChatCompletionInput, ChatCompletionOutput } from '../schemas'

export const createGroqChatProvider = (): IChatCompletionProvider => ({
  async completeChat(input: ChatCompletionInput): Promise<ChatCompletionOutput> {
    const result = await groqCompleteChat(input.apiKey, input.messages, {
      model: input.model,
      maxTokens: input.maxTokens,
    })
    return {
      text: result.text,
      quotaError: result.quotaError,
    }
  },
})
