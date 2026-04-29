/**
 * Datamod 분석 차트 공통 토큰 — Pretendard + 한국어 숫자 포맷은 컴포넌트에서 적용
 */
import type { CSSProperties } from 'react'

export const chartColors = {
  primary: '#4F6EF7',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  neutral: '#6B7280',
  gradientStart: 'rgba(79,110,247,0.15)',
  gradientEnd: 'rgba(79,110,247,0)',
  /** 시장 다각도 막대: 낮은 값 → 높은 값 */
  mintLight: '#B2DFDB',
  mintDark: '#00796B',
  divergeNegDeep: '#B91C1C',
  divergeNeg: '#EF4444',
  divergePos: '#3B82F6',
  divergePosDeep: '#047857',
} as const

export const chartCardStyle: CSSProperties = {
  borderRadius: '16px',
  border: '1px solid rgba(0,0,0,0.08)',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
  padding: '24px',
}

/** Tailwind + dark 보더 */
export const chartCardClassName =
  'rounded-2xl border border-black/[0.08] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)] sm:p-6   '

export const chartFontFamily =
  "'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif"

export const chartAxisMuted = '#94a3b8'
export const chartGridMuted = 'rgba(148, 163, 184, 0.35)'

export function formatChartInt(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(Math.round(n))
}

/** #RRGGBB 보간 (막대 강도 색) */
export function mixTealBar(t: number): string {
  const a = { r: 0xb2, g: 0xdf, b: 0xdb }
  const b = { r: 0x00, g: 0x79, b: 0x6b }
  const u = Math.min(1, Math.max(0, t))
  const r = Math.round(a.r + (b.r - a.r) * u)
  const g = Math.round(a.g + (b.g - a.g) * u)
  const bl = Math.round(a.b + (b.b - a.b) * u)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`
}

/** 50 기준 편차에 따른 발산 색 (레거시·기타 차트용) */
export function divergingFillFromDelta(delta: number, maxAbs: number): string {
  const m = Math.max(1, maxAbs)
  const t = Math.min(1, Math.abs(delta) / m)
  if (delta < 0) {
    if (t > 0.66) return chartColors.divergeNegDeep
    if (t > 0.33) return chartColors.divergeNeg
    return '#FCA5A5'
  }
  if (delta > 0) {
    if (t > 0.66) return chartColors.divergePosDeep
    if (t > 0.33) return chartColors.success
    return chartColors.divergePos
  }
  return chartColors.neutral
}

/** 요인 강도·점수 분포 — 실제 점수(0~100) 기준 (편차 아님) */
export function getFactorStrengthBarColor(value: number): string {
  if (value >= 70) return '#0D9F6E'
  if (value >= 55) return '#34D399'
  if (value >= 45) return '#93C5FD'
  if (value >= 30) return '#FCD34D'
  return '#F87171'
}

/** @deprecated — getFactorStrengthBarColor 사용 권장 */
export function getBreakdownBarColor(score: number): string {
  return getFactorStrengthBarColor(score)
}
