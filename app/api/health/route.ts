import { NextResponse } from 'next/server'
import { getSystemGeminiKey } from '@/lib/license'

/** GET: API 키/연결 상태 및 AI 모델 정보 (키 값은 노출하지 않음). 메인 대시보드·시스템 설정용. */
export async function GET() {
  const gemini = getSystemGeminiKey().length > 0
  const supabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim())
  const model = process.env.GEMINI_MODEL?.trim() || process.env.GEMINI_TAB_MODEL?.trim() || 'gemini-2.5-flash'
  return NextResponse.json({ gemini, supabase, model })
}
