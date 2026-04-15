/** 분석 리포트 앵커 — 짧은 id (스크롤·탭·목차 공통) */
export const REPORT_SECTION_IDS = [
  'summary',
  'market',
  'competition',
  'insights',
  'strategic',
  'action',
] as const

export type ReportSectionId = (typeof REPORT_SECTION_IDS)[number]

/** 상단 고정 탭바에만 노출 (요약/액션은 스크롤 영역만 존재) */
export const REPORT_STICKY_TAB_IDS = ['market', 'competition', 'insights', 'strategic'] as const

export type ReportStickyTabId = (typeof REPORT_STICKY_TAB_IDS)[number]

export const REPORT_STICKY_TAB_LABELS: Record<ReportStickyTabId, string> = {
  market: '시장 분석',
  competition: '경쟁사 분석',
  insights: '핵심 인사이트',
  strategic: '전략 제안',
}

export const REPORT_TAB_LABELS: Record<ReportSectionId, string> = {
  summary: '요약',
  market: '시장',
  competition: '경쟁',
  insights: '인사이트',
  strategic: '전략·GTM',
  action: '액션',
}

/** 목차·스크롤 앵커용 (탭 라벨보다 설명적) */
export const REPORT_TOC_LABELS: Record<ReportSectionId, string> = {
  summary: '요약·기회 점수',
  market: '시장·트렌드',
  competition: '경쟁 환경',
  insights: '핵심 인사이트',
  strategic: '전략·프레임워크',
  action: '액션 플랜',
}
