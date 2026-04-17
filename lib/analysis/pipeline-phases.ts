/**
 * dataMod 분석 파이프라인 — 단계 의존성·Phase 그룹 (runResearch 기준).
 *
 * ## 1) 데이터 의존성 (요약)
 * - Phase 1 → Phase 2: `articlesForAnalysis`(추출·요약), `webContext`, `competitorWebContext`
 * - Phase 2 → Phase 3: `trendData`, `competitionData` → `marketOverview`, `competitionSummary`
 * - Phase 3 → Phase 4: `insightData` → `strategyData` → `executionData` → `strategyEvaluation`
 *   (전략 → PM 액션 → 리스크 평가는 **순차**: 리스크 단계가 `product_actions`를 소비)
 *
 * ## 2) 과다 API 호출(수십 회) 요인
 * - Serper 웹 검색 다회, RSS, 기사 HTTP 추출, 기사 요약 LLM(배치), 트렌드·경쟁 LLM, 이후 단계별 LLM, 사용량 기록 등이 합산됨.
 * - 병렬 루프(추출·요약 배치)는 `runResearch` + `lib/ai/concurrency-pool`에서 동시성 상한으로 제한.
 *
 * ## 3) done 이후 로그 이슈
 * - 스트림 소비자가 `done`에서 조기 `break`하면 async generator 정리가 불완전할 수 있음 → `/api/research/run`에서 전 구간 소비.
 */

/** UI·캐시·RSS·기사 본문/요약·경쟁사 웹 맥락까지 */
export const PHASE_1_IDS = ['cache', 'signal_layer', 'article_extraction', 'article_summary', 'web_grounding'] as const

/** 트렌드 LLM + 경쟁 LLM — 동일 입력(기사·웹)에만 의존, 서로 무의존 → 병렬 가능 */
export const PHASE_2_PARALLEL_TASKS = ['trend_analysis', 'competition_analysis'] as const

/** 인사이트 단일 LLM — Phase 2 산출물 필요 */
export const PHASE_3_IDS = ['insight_extraction'] as const

/** 전략 → 실행(액션) → 리스크 평가는 데이터 체인으로 순차 (4-parallel 불가) */
export const PHASE_4_SEQUENTIAL_TASKS = [
  'strategy_generation',
  'execution_layer',
  'risk_opportunity',
] as const

export const POST_PIPELINE_IDS = ['post_processing', 'creative', 'saving', 'final_refining'] as const
