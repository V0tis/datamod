/**
 * Single entry for AI communication. Use this from API routes instead of
 * inlining fetch/SDK calls or importing from multiple service files.
 *
 * - Gemini: generateText, generateResearchWithGrounding, requestGenerateContent, etc.
 * - Groq: completeChat
 * - Consensus: synthesizeConsensus, normalizeConsensus
 * - Tab insight: runTabAnalysis (Groq + Gemini with gap)
 *
 * Key resolution and request/response parsing live in lib/ (research-keys, research-parser).
 */
export {
  buildGenerateContentUrl,
  requestGenerateContent,
  parseGenerateContentResponse,
  generateText,
  getTabModel,
  getConsensusModel,
  generateResearchWithGrounding,
} from '@/services/ai/geminiClient'
export type {
  GeminiRequestBody,
  GenerateTextOptions,
  ResearchWithGroundingResult,
} from '@/services/ai/geminiClient'

export { completeChat } from '@/services/ai/groqClient'
export type { GroqMessage, CompleteChatOptions, CompleteChatResult } from '@/services/ai/groqClient'

export {
  synthesizeConsensus,
  normalizeConsensus,
  FALLBACK_CONSENSUS,
} from '@/services/ai/consensusService'
export type {
  Consensus,
  ConsensusImpactItem,
  ConsensusSentiment,
  ConsensusStrategicSummary,
  ConsensusMetadata,
} from '@/services/ai/consensusService'

export { runTabAnalysis } from '@/services/ai/tabAnalysis'
export type {
  TabAnalysisInput,
  TabAnalysisResult,
  TabAnalysisProvider,
} from '@/services/ai/tabAnalysis'
