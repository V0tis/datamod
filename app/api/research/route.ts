import { NextRequest, NextResponse } from 'next/server'

/**
 * Research API - Rin-AI 검색/리서치 요청 처리
 *
 * POST /api/research - 검색어로 리서치 수행
 * GET /api/research?query=... - 쿼리 파라미터로 리서치 조회
 */

export interface ResearchRequest {
  query: string
}

export interface ResearchSource {
  type: 'news' | 'community' | 'data'
  title: string
  snippet: string
  url?: string
  publishedAt?: string
}

export interface ResearchResponse {
  success: boolean
  query: string
  sources: ResearchSource[]
  summary?: string
  error?: string
}

async function performResearch(query: string): Promise<ResearchSource[]> {
  // TODO: 실제 리서치 로직 구현
  // - 시장 뉴스 검색 (news API, RSS 등)
  // - 커뮤니티 반응 수집 (트위터, 레딧 등)
  // - 데이터 신선도 검증

  // Placeholder: Mock 응답
  return [
    {
      type: 'news',
      title: `"${query}" 관련 최신 뉴스`,
      snippet: '시장 뉴스 검색 결과가 여기에 표시됩니다.',
      publishedAt: new Date().toISOString(),
    },
    {
      type: 'community',
      title: '커뮤니티 반응',
      snippet: '유저 반응 및 소셜 데이터가 여기에 표시됩니다.',
    },
    {
      type: 'data',
      title: '데이터 신선도',
      snippet: '수집된 데이터의 신선도 및 출처 검증 결과입니다.',
    },
  ]
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body?.query || typeof body.query !== 'string') {
      return NextResponse.json<ResearchResponse>(
        {
          success: false,
          query: '',
          sources: [],
          error: '검색어(query)가 필요합니다.',
        },
        { status: 400 }
      )
    }

    const query = body.query.trim()
    if (!query) {
      return NextResponse.json<ResearchResponse>(
        {
          success: false,
          query: '',
          sources: [],
          error: '검색어를 입력해주세요.',
        },
        { status: 400 }
      )
    }

    const sources = await performResearch(query)

    return NextResponse.json<ResearchResponse>({
      success: true,
      query,
      sources,
      summary: `${query}에 대한 리서치가 완료되었습니다.`,
    })
  } catch (error) {
    console.error('[Research API] POST error:', error)

    return NextResponse.json<ResearchResponse>(
      {
        success: false,
        query: '',
        sources: [],
        error: '리서치 처리 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')

    if (!query?.trim()) {
      return NextResponse.json<ResearchResponse>(
        {
          success: false,
          query: '',
          sources: [],
          error: 'query 파라미터가 필요합니다.',
        },
        { status: 400 }
      )
    }

    const sources = await performResearch(query.trim())

    return NextResponse.json<ResearchResponse>({
      success: true,
      query: query.trim(),
      sources,
    })
  } catch (error) {
    console.error('[Research API] GET error:', error)

    return NextResponse.json<ResearchResponse>(
      {
        success: false,
        query: '',
        sources: [],
        error: '리서치 처리 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}
