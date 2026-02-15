/**
 * Unified AI layer. Use this from API routes only—never from React components.
 *
 * - generateText, generateResearchWithGrounding, completeChat, runTabAnalysis, synthesizeConsensus
 * - normalizeConsensus, FALLBACK_CONSENSUS (pure helpers)
 * - setAiProviders (for tests; swap Gemini/Groq)
 */
export {
  generateText,
  generateResearchWithGrounding,
  completeChat,
  runTabAnalysis,
  synthesizeConsensus,
  normalizeConsensus,
  FALLBACK_CONSENSUS,
  setAiProviders,
} from './unified-ai-service'

export type {
  GenerateTextInput,
  GenerateTextOutput,
  ResearchWithGroundingInput,
  ResearchWithGroundingOutput,
  ChatCompletionInput,
  ChatCompletionOutput,
  TabAnalysisInput,
  TabAnalysisOutput,
  TabAnalysisProvider,
  SynthesizeConsensusInput,
  SynthesizeConsensusOutput,
  Consensus,
  ConsensusImpactItem,
  ConsensusSentiment,
  ConsensusStrategicSummary,
  ConsensusMetadata,
} from './unified-ai-service'
