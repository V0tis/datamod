/**
 * AI layer: input and output schemas for every operation.
 * Single source of truth for contracts; providers and service use these.
 * No React, no I/O—types only.
 */

// ---- Generate text (stream, follow-up, initial analysis) ----
export type GenerateTextInput = {
  apiKey: string
  prompt: string
  systemInstruction?: string
  maxOutputTokens?: number
  model?: string
  /** Override retry predicate (e.g. skip retry on 404) */
  isRetryable?: (error: unknown) => boolean
}

export type GenerateTextOutput = string

// ---- Research with grounding (Gemini Google Search) ----
export type ResearchWithGroundingInput = {
  apiKey: string
  prompt: string
  systemInstruction?: string
  maxOutputTokens?: number
  model?: string
  isRetryable?: (error: unknown) => boolean
}

export type ResearchWithGroundingOutput = {
  text: string
  sourceLinks: Array<{ title: string; url: string }>
}

// ---- Chat completion (Groq-style messages) ----
export type ChatMessage = { role: 'system' | 'user'; content: string }

export type ChatCompletionInput = {
  apiKey: string
  messages: ChatMessage[]
  model?: string
  maxTokens?: number
}

export type ChatCompletionOutput = {
  text: string | null
  quotaError?: boolean
  /** 사용자 표시용 fallback 메시지 (text가 null일 때) */
  fallbackMessage?: string
}

// ---- Raw content generation (REST generateContent style) ----
export type GenerateContentInput = {
  apiKey: string
  contents: Array<{ parts: Array<{ text: string }> }>
  model: string
  maxOutputTokens?: number
}

export type GenerateContentOutput = string

// ---- Tab analysis (orchestration: Groq + optional Gemini) ----
export type TabAnalysisProvider = 'groq' | 'gemini' | 'all'

export type TabAnalysisInput = {
  groqKey: string | null
  geminiKey: string | null
  provider: TabAnalysisProvider
  systemPrompt: string
  userPrompt: string
}

export type TabAnalysisOutput = {
  groqText: string | null
  geminiText: string | null
  groqQuotaError: boolean
  geminiQuotaExceeded: boolean
  /** 양쪽 AI 모두 실패 시 사용자 표시용 fallback 메시지 */
  fallbackMessage?: string
}

// ---- Consensus synthesis (PM-oriented summary from two analyses) ----
export type ConsensusImpactItem = {
  subject: string
  score: number
  reason?: string
}

export type ConsensusSentiment = {
  score: number
  trend?: 'rising' | 'falling' | 'stable'
  ratio?: { positive?: number; neutral?: number; negative?: number }
}

export type ConsensusStrategicSummary = {
  summary: string
  opportunity?: string
  threat?: string
  actionItems?: string[]
}

export type ConsensusMetadata = {
  confidence: number
  dataPeriod?: string
}

export type Consensus = {
  marketNews?: string[]
  painPoints?: string[]
  competitorTrends?: string
  sentiment: ConsensusSentiment
  impactAnalysis?: ConsensusImpactItem[]
  strategicSummary: ConsensusStrategicSummary
  metadata: ConsensusMetadata
}

export type SynthesizeConsensusInput = {
  apiKey: string
  geminiAnalysis: string
  groqAnalysis: string
  /** When set, consensus uses this provider instead of defaulting to Gemini. */
  preferredProvider?: 'gemini' | 'groq'
  /** Required when preferredProvider is 'groq'. */
  groqKey?: string
}

export type SynthesizeConsensusOutput = Consensus
