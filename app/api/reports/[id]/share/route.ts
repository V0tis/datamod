import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'

function generateShareToken(): string {
  return randomBytes(16).toString('base64url')
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: '리포트 ID가 필요합니다.' }, { status: 400 })
    }

    const { data: report, error: fetchError } = await supabase
      .from('reports')
      .select('id, user_id, share_token, shared_at')
      .eq('id', id)
      .single()

    if (fetchError || !report) {
      return NextResponse.json(
        { error: '리포트를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (report.user_id !== user.id) {
      return NextResponse.json(
        { error: '이 리포트를 공유할 수 없습니다.' },
        { status: 403 }
      )
    }

    let token = report.share_token as string | null
    if (!token) {
      token = generateShareToken()
      const { error: updateError } = await supabase
        .from('reports')
        .update({
          share_token: token,
          shared_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (updateError) {
        console.error('[Share API] update error:', updateError)
        return NextResponse.json(
          { error: '공유 링크 생성에 실패했습니다.' },
          { status: 500 }
        )
      }
    }

    const origin = req.headers.get('origin')
    const base = origin
      || (process.env.NEXT_PUBLIC_APP_URL
        ? (process.env.NEXT_PUBLIC_APP_URL.startsWith('http')
            ? process.env.NEXT_PUBLIC_APP_URL
            : `https://${process.env.NEXT_PUBLIC_APP_URL}`)
        : '')
    const url = base ? `${base.replace(/\/$/, '')}/share/${token}` : `/share/${token}`

    return NextResponse.json({ url, shareToken: token })
  } catch (e) {
    console.error('[Share API]', e)
    return NextResponse.json(
      { error: '공유 링크 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}
