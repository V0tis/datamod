import { redirect } from 'next/navigation'

/** 내 분석 → 분석 기록으로 통합. 기존 링크 호환용 리다이렉트 */
export default function AnalysesRedirect() {
  redirect('/history')
}
