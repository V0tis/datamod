/**
 * 리소스 사용량 기록 (Gemini / Firecrawl)
 * usage_stats 테이블에 used_date, service_type별로 count를 1씩 증가시킵니다.
 */

import { createClient } from '@/lib/supabase/server'

export type ServiceType = 'gemini' | 'firecrawl'

/**
 * 해당 서비스의 오늘 사용량을 1 증가시킵니다.
 * 호출 실패 시 로그만 하고 예외를 전파하지 않습니다.
 */
export async function trackUsage(serviceType: ServiceType): Promise<void> {
  try {
    const supabase = await createClient()
    const today = new Date().toISOString().slice(0, 10)

    const { data: row } = await supabase
      .from('usage_stats')
      .select('count')
      .eq('used_date', today)
      .eq('service_type', serviceType)
      .maybeSingle()

    const newCount = (row?.count ?? 0) + 1

    await supabase
      .from('usage_stats')
      .upsert(
        { used_date: today, service_type: serviceType, count: newCount },
        { onConflict: 'used_date,service_type' }
      )
  } catch (e) {
    console.warn('[usage] trackUsage failed:', e)
  }
}
