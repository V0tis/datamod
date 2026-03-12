/**
 * POST /api/settings/test-connection
 *
 * Tests API key validity by making a minimal request to each provider.
 * Body: { provider: 'gemini' | 'groq', apiKey: string }
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GEMINI_TAB_MODEL } from '@/lib/gemini-config'

export const dynamic = 'force-dynamic'

const GROQ_MODEL = process.env.GROQ_TAB_MODEL ?? 'llama-3.3-70b-versatile'

async function testGeminiKey(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  const url = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_TAB_MODEL}:generateContent?key=${apiKey}`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Say "ok"' }] }],
        generationConfig: { maxOutputTokens: 10 },
      }),
      signal: AbortSignal.timeout(15_000),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return { ok: true }
    }
    const msg = (data?.error?.message as string) ?? `HTTP ${res.status}`
    return { ok: false, error: msg }
  } catch (e) {
    const msg = e instanceof Error ? e.message : '네트워크 오류'
    return { ok: false, error: msg }
  }
}

async function testGroqKey(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: 'Say "ok"' }],
        max_tokens: 10,
      }),
      signal: AbortSignal.timeout(15_000),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data?.choices?.[0]?.message?.content) {
      return { ok: true }
    }
    const msg = (data?.error?.message as string) ?? `HTTP ${res.status}`
    return { ok: false, error: msg }
  } catch (e) {
    const msg = e instanceof Error ? e.message : '네트워크 오류'
    return { ok: false, error: msg }
  }
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { provider?: string; apiKey?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const provider = body.provider === 'groq' ? 'groq' : body.provider === 'gemini' ? 'gemini' : null
  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''

  if (!provider || !apiKey) {
    return NextResponse.json({ error: 'provider와 apiKey가 필요합니다.' }, { status: 400 })
  }

  if (apiKey === '••••••••••••••••' || apiKey.length < 10) {
    return NextResponse.json({ error: '유효한 API 키를 입력해 주세요.' }, { status: 400 })
  }

  const result =
    provider === 'gemini'
      ? await testGeminiKey(apiKey)
      : await testGroqKey(apiKey)

  if (result.ok) {
    return NextResponse.json({ ok: true, message: '연결 성공' })
  }
  return NextResponse.json({ ok: false, error: result.error ?? '연결 실패' }, { status: 400 })
}
