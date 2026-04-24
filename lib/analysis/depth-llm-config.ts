/**
 * 분석 깊이(Quick/Standard/Deep)별 LLM 컨텍스트·토큰·프롬프트 강도.
 * `runResearch`의 `mode`(quick|standard|deep)와 DB `analysis_depth`(fast|standard|deep)에 대응.
 */
import { compressTextForPmActionInput } from '@/lib/ai/pipeline-prompts'

export type ResearchDepthMode = 'quick' | 'standard' | 'deep'

export type AnalysisDepthForPrompt = 'shallow' | 'standard' | 'deep'

export type DepthLlmParams = {
  /** COLLECTED_DATA·시장/경쟁 요약에 쓰는 대략적 상한(문자) */
  context_limit: number
  /** 프롬프트에 명시하는 분석 심도 라벨 */
  analysis_depth: AnalysisDepthForPrompt
  serperResultCap: number
  webContextMaxChars: number
  articleBodySlice: number
  articleSummaryMaxOut: number
  trendMaxOut: number
  competitionMaxOut: number
  marketBundleMaxOut: number
  insightMaxOut: number
  strategyOut: number
  pmActionMaxOut: number
  strategyBundleMaxOut: number
  evalMaxOut: number
  /** 심층: 전략 평가에 정량-정성 교차검증 리포트 형식 강제 */
  forceCrossValidationReport: boolean
}

const PRESETS: Record<ResearchDepthMode, DepthLlmParams> = {
  quick: {
    context_limit: 2200,
    analysis_depth: 'shallow',
    serperResultCap: 4,
    webContextMaxChars: 3600,
    articleBodySlice: 900,
    articleSummaryMaxOut: 1000,
    trendMaxOut: 520,
    competitionMaxOut: 1600,
    marketBundleMaxOut: 2400,
    insightMaxOut: 900,
    strategyOut: 800,
    pmActionMaxOut: 1600,
    strategyBundleMaxOut: 2800,
    evalMaxOut: 900,
    forceCrossValidationReport: false,
  },
  standard: {
    context_limit: 4800,
    analysis_depth: 'standard',
    serperResultCap: 8,
    webContextMaxChars: 7200,
    articleBodySlice: 1500,
    articleSummaryMaxOut: 1500,
    trendMaxOut: 800,
    competitionMaxOut: 2200,
    marketBundleMaxOut: 3200,
    insightMaxOut: 1200,
    strategyOut: 1000,
    pmActionMaxOut: 2000,
    strategyBundleMaxOut: 3500,
    evalMaxOut: 1200,
    forceCrossValidationReport: false,
  },
  deep: {
    context_limit: 8000,
    analysis_depth: 'deep',
    serperResultCap: 10,
    webContextMaxChars: 12000,
    articleBodySlice: 2200,
    articleSummaryMaxOut: 2000,
    trendMaxOut: 1200,
    competitionMaxOut: 2800,
    marketBundleMaxOut: 4200,
    insightMaxOut: 2000,
    strategyOut: 1600,
    pmActionMaxOut: 2400,
    strategyBundleMaxOut: 4500,
    evalMaxOut: 2000,
    forceCrossValidationReport: true,
  },
}

export function getDepthLlmParams(mode: ResearchDepthMode): DepthLlmParams {
  return PRESETS[mode] ?? PRESETS.standard
}

export function clipContextText(s: string, maxChars: number): string {
  return compressTextForPmActionInput(s?.trim() ?? '', maxChars)
}
