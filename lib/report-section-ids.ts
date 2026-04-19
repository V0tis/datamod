/** 분석 리포트 DOM 앵커 id — 목차·scrollIntoView·스크롤 스파이 공통 */
export const REPORT_SECTION_IDS = [
  'summary-section',
  'market-section',
  'competitor-section',
  'insight-strategy-section',
  'action-section',
] as const

export type ReportSectionId = (typeof REPORT_SECTION_IDS)[number]

/** 상단 스크롤 스파이 탭 순서 — 5개 섹션(액션 포함) */
export const REPORT_SCROLL_SPY_TAB_ORDER = [
  'summary-section',
  'market-section',
  'competitor-section',
  'insight-strategy-section',
  'action-section',
] as const

export type ReportScrollSpyTabId = (typeof REPORT_SCROLL_SPY_TAB_ORDER)[number]

export const REPORT_SCROLL_SPY_TAB_LABELS: Record<ReportScrollSpyTabId, string> = {
  'summary-section': '📊 종합 요약',
  'market-section': '📈 시장 분석',
  'competitor-section': '⚔️ 경쟁사 분석',
  'insight-strategy-section': '💡 인사이트·전략',
  'action-section': '🎯 PM 액션',
}

export const REPORT_TAB_LABELS: Record<ReportSectionId, string> = {
  'summary-section': '요약',
  'market-section': '시장',
  'competitor-section': '경쟁',
  'insight-strategy-section': '인사이트',
  'action-section': '액션',
}

export const REPORT_TOC_LABELS: Record<ReportSectionId, string> = {
  'summary-section': '종합 요약',
  'market-section': '시장 분석',
  'competitor-section': '경쟁사 분석',
  'insight-strategy-section': '인사이트·전략',
  'action-section': 'PM 액션 플랜',
}
