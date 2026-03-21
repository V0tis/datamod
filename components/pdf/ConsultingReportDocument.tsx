'use client'

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'

// 한글 지원: Noto Sans KR (WOFF - 한글 깨짐 방지)
Font.register({
  family: 'NotoSansKR',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/notosanskr/v27/PbykFmXiEBPT4ITbgNA5Cgm20HTs4JMMuA.woff',
      fontWeight: 400,
    },
    {
      src: 'https://fonts.gstatic.com/s/notosanskr/v27/PbykFmXiEBPT4ITbgNA5Cgm20HTs4JMMuA.woff',
      fontWeight: 700,
    },
  ],
})

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    padding: 40,
    fontFamily: 'NotoSansKR',
    fontSize: 10,
    lineHeight: 1.5,
  },
  cover: {
    flex: 1,
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#1a1a2e',
    paddingBottom: 24,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: '#1a1a2e',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    color: '#4a4a6a',
  },
  generatedDate: {
    fontSize: 9,
    color: '#6b7280',
    marginTop: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#1a1a2e',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    letterSpacing: 0.5,
  },
  bodyText: {
    fontSize: 10,
    color: '#374151',
    marginBottom: 6,
    textAlign: 'justify',
  },
  bulletList: {
    marginLeft: 12,
    marginBottom: 4,
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  bullet: {
    width: 4,
    marginRight: 8,
    marginTop: 5,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1a1a2e',
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    color: '#374151',
  },
  competitorCard: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  competitorName: {
    fontSize: 11,
    fontWeight: 600,
    color: '#1a1a2e',
    marginBottom: 4,
  },
  actionCard: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#f0fdf4',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
  },
  actionTitle: {
    fontSize: 10,
    fontWeight: 600,
    color: '#166534',
    marginBottom: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#9ca3af',
  },
})

export interface PdfReportPayload {
  keyword: string
  countryCode?: string
  generatedAt?: string
  /** Market Overview */
  marketSummary?: string
  marketTemperature?: number
  opportunityScore?: number
  positiveSignals?: string[]
  negativeRisks?: string[]
  /** Key Insights */
  keyInsights?: string[]
  summaryInsights?: string
  /** Strategic Recommendations */
  strategySummary?: string
  productStrategy?: {
    summary?: string
    product_idea?: string
    target_customer?: string
    monetization?: string
  }
  /** Competitor Landscape */
  competitors?: Array<{
    name?: string
    positioning?: string
    strength?: string
    weakness?: string
  }>
  /** PM Action Plan */
  actionPlan?: Array<{
    action_title?: string
    title?: string
    description?: string
    reasoning?: string
    priority?: string
  }>
}

function BulletList({ items }: { items: string[] }) {
  if (!items?.length) return null
  return (
    <View style={styles.bulletList}>
      {items.filter(Boolean).map((item, i) => (
        <View key={i} style={styles.bulletItem}>
          <View style={styles.bullet} />
          <Text style={styles.bulletText}>{String(item).trim()}</Text>
        </View>
      ))}
    </View>
  )
}

export function ConsultingReportDocument({ data }: { data: PdfReportPayload }) {
  const {
    keyword,
    generatedAt = new Date().toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    marketSummary,
    marketTemperature,
    opportunityScore,
    positiveSignals = [],
    negativeRisks = [],
    keyInsights = [],
    summaryInsights,
    strategySummary,
    productStrategy,
    competitors = [],
    actionPlan = [],
  } = data

  const strategyText =
    strategySummary ||
    productStrategy?.summary ||
    [productStrategy?.product_idea, productStrategy?.target_customer, productStrategy?.monetization]
      .filter(Boolean)
      .join('. ')

  const insights = [
    ...keyInsights,
    ...(summaryInsights ? [summaryInsights] : []),
  ].filter(Boolean)

  const actions = actionPlan.map((a) => ({
    title: a.action_title ?? a.title ?? '',
    desc: a.description ?? a.reasoning ?? '',
    priority: a.priority,
  }))

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Cover / Title */}
        <View style={styles.cover}>
          <Text style={styles.title}>{keyword} 시장 분석 리포트</Text>
          <Text style={styles.subtitle}>AI 기반 시장 리서치 컨설팅 보고서</Text>
          <Text style={styles.generatedDate}>작성일: {generatedAt}</Text>
          {(marketTemperature != null || opportunityScore != null) && (
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
              {marketTemperature != null && (
                <Text style={styles.bodyText}>시장 온도: {marketTemperature}/100</Text>
              )}
              {opportunityScore != null && (
                <Text style={styles.bodyText}>기회 점수: {opportunityScore}/100</Text>
              )}
            </View>
          )}
        </View>

        {/* 1. Market Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Market Overview</Text>
          {marketSummary && (
            <Text style={styles.bodyText}>{marketSummary}</Text>
          )}
          {positiveSignals.length > 0 && (
            <>
              <Text style={[styles.bodyText, { fontWeight: 600, marginTop: 8 }]}>긍정 신호</Text>
              <BulletList items={positiveSignals.slice(0, 5)} />
            </>
          )}
          {negativeRisks.length > 0 && (
            <>
              <Text style={[styles.bodyText, { fontWeight: 600, marginTop: 8 }]}>리스크 요인</Text>
              <BulletList items={negativeRisks.slice(0, 5)} />
            </>
          )}
        </View>

        {/* 2. Key Insights */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Key Insights</Text>
          {insights.length > 0 ? (
            <BulletList items={insights.slice(0, 8)} />
          ) : (
            <Text style={styles.bodyText}>데이터 없음</Text>
          )}
        </View>

        {/* 3. Strategic Recommendations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Strategic Recommendations</Text>
          {strategyText ? (
            <Text style={styles.bodyText}>{strategyText}</Text>
          ) : (
            <Text style={styles.bodyText}>데이터 없음</Text>
          )}
        </View>

        <Text style={styles.footer}>
          Generated by Rin-AI · Confidential · {keyword} Market Analysis
        </Text>
      </Page>

      {/* Page 2: Competitor Landscape + PM Action Plan */}
      <Page size="A4" style={styles.page}>
        {/* 4. Competitor Landscape */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Competitor Landscape</Text>
          {competitors.length > 0 ? (
            competitors.slice(0, 6).map((c, i) => (
              <View key={i} style={styles.competitorCard}>
                <Text style={styles.competitorName}>{c.name ?? `경쟁사 ${i + 1}`}</Text>
                {c.positioning && (
                  <Text style={styles.bodyText}>포지셔닝: {c.positioning}</Text>
                )}
                {c.strength && (
                  <Text style={[styles.bodyText, { marginTop: 2 }]}>강점: {c.strength}</Text>
                )}
                {c.weakness && (
                  <Text style={[styles.bodyText, { marginTop: 2 }]}>약점: {c.weakness}</Text>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.bodyText}>경쟁사 정보 없음</Text>
          )}
        </View>

        {/* 5. PM Action Plan */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. PM Action Plan</Text>
          {actions.length > 0 ? (
            actions.slice(0, 8).map((a, i) => (
              <View key={i} style={styles.actionCard}>
                <Text style={styles.actionTitle}>
                  {a.priority ? `[${a.priority}] ` : ''}{a.title || `액션 ${i + 1}`}
                </Text>
                {a.desc && <Text style={styles.bodyText}>{a.desc}</Text>}
              </View>
            ))
          ) : (
            <Text style={styles.bodyText}>액션 플랜 없음</Text>
          )}
        </View>

        <Text style={styles.footer}>
          Generated by Rin-AI · Confidential · {keyword} Market Analysis
        </Text>
      </Page>
    </Document>
  )
}
