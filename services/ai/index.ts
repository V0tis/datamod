/**
 * AI service layer: Gemini, Groq, and research consensus.
 * Use these in API routes instead of inlining fetch/SDK + retry logic.
 */
export {
  buildGenerateContentUrl,
  requestGenerateContent,
  parseGenerateContentResponse,
  generateText,
  getTabModel,
  getConsensusModel,
  generateResearchWithGrounding,
} from './geminiClient'
export type { GeminiRequestBody, GenerateTextOptions, ResearchWithGroundingResult } from './geminiClient'

export { completeChat } from './groqClient'
export type { GroqMessage, CompleteChatOptions, CompleteChatResult } from './groqClient'

export {
  synthesizeConsensus,
  normalizeConsensus,
  FALLBACK_CONSENSUS,
} from './consensusService'
export type {
  Consensus,
  ConsensusImpactItem,
  ConsensusSentiment,
  ConsensusStrategicSummary,
  ConsensusMetadata,
} from './consensusService'
