/**
 * AI service layer: Gemini, Groq, and research consensus.
 * @deprecated Prefer using lib/ai for new code. This layer will be removed.
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
  normalizeConsensus,
  FALLBACK_CONSENSUS,
} from '@/lib/ai/consensus'
export type {
  Consensus,
  ConsensusImpactItem,
  ConsensusSentiment,
  ConsensusStrategicSummary,
  ConsensusMetadata,
} from '@/lib/ai/consensus'

export { synthesizeConsensus } from '@/lib/ai/unified-ai-service'

export { runTabAnalysis } from './tabAnalysis'
export type { TabAnalysisInput, TabAnalysisResult, TabAnalysisProvider } from './tabAnalysis'
