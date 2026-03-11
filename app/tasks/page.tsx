import { redirect } from 'next/navigation'

/** 분석 작업(폴링 job) → 분석 기록으로 통합. 기존 링크 호환용 리다이렉트 */
export default function TasksRedirect() {
  redirect('/history')
}
