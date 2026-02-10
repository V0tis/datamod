import { NextResponse } from 'next/server'

/** GET: API 키/연결 상태 및 AI 모델 정보 (키 값은 노출하지 않음). 메인 대시보드·시스템 설정용. */
export async function GET() {
  const gemini = !!(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim())
  const supabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim())
  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-1.5-flash'
  return NextResponse.json({ gemini, supabase, model })
}
