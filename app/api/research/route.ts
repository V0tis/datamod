import { NextRequest, NextResponse } from 'next/server'

/**
 * Research API - Rin-AI 검색/리서치 요청 처리
 *
 * POST /api/research - 검색어로 리서치 수행
 * GET /api/research?query=... - 쿼리 파라미터로 리서치 조회
 */

const FIRECRAWL_ENDPOINT = 'https://api.firecrawl.dev/v1/query'
const CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages'
const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? 'claude-3-5-sonnet-latest'

export interface ResearchRequest {
  query: string
}

export interface StructuredResearch {
  marketNews: string[]
  painPoints: string[]
  competitorTrends: string[]
  sentiment: {
    positive: number
    negative: number
  }
}

export interface ResearchResponse {
  success: boolean
  query: string
  data?: StructuredResearch
  error?: string
  message?: string
  rawClaudeOutput?: string
}

interface FirecrawlResult {
  url?: string
  title?: string
  description?: string
  content?: string
  markdown?: string
  publishedAt?: string
}

interface FirecrawlPayload {
  data?: {
    results?: FirecrawlResult[]
  }
}

function validateServerEnv(): string[] {
  const missing: string[] = []

  if (!process.env.FIRECRAWL_API_KEY) {
    missing.push('FIRECRAWL_API_KEY')
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    missing.push('ANTHROPIC_API_KEY')
  }

  return missing
}

type ParsedClaude = StructuredResearch & { [key: string]: unknown }

function normaliseStructuredResearch(raw: ParsedClaude): StructuredResearch {
  const toArrayOfStrings = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value.map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '')).trim()).filter(Boolean)
    }
    if (typeof value === 'string') {
      return value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    }
    if (value == null) {
      return []
    }
    return [String(value)]
  }

  const sentimentValue = (value: unknown): number => {
    if (typeof value === 'number') {
      return Math.min(100, Math.max(0, value))
    }
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value)
      if (Number.isFinite(parsed)) {
        return Math.min(100, Math.max(0, parsed))
      }
    }
    return 0
  }

  const sentimentSource = raw.sentiment as ParsedClaude['sentiment']
  let positive = 0
  let negative = 0

  if (sentimentSource && typeof sentimentSource === 'object') {
    positive = sentimentValue((sentimentSource as { positive?: unknown }).positive)
    negative = sentimentValue((sentimentSource as { negative?: unknown }).negative)
  }

  return {
    marketNews: toArrayOfStrings(raw.marketNews),
    painPoints: toArrayOfStrings(raw.painPoints),
    competitorTrends: toArrayOfStrings(raw.competitorTrends),
    sentiment: {
      positive,
      negative,
    },
  }
}

function buildFirecrawlBody(query: string) {
  return {
    query,
    time_range: '24h',
    include_images: false,
    include_full_content: true,
    format: 'markdown',
    num_results: 12,
  }
}

async function fetchFirecrawlDocuments(query: string): Promise<FirecrawlResult[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY

  const response = await fetch(FIRECRAWL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(buildFirecrawlBody(query)),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Firecrawl request failed: ${response.status} ${errorText}`)
  }

  const payload = (await response.json()) as FirecrawlPayload
  const results = payload.data?.results ?? []

  return results.slice(0, 8)
}

function buildClaudeUserPrompt(query: string, documents: FirecrawlResult[]): string {
  const sourcesAsMarkdown = documents
    .map((doc, index) => {
      const title = doc.title?.trim() || 'Untitled Source'
      const url = doc.url ? `URL: ${doc.url}` : 'URL: Not provided'
      const published = doc.publishedAt ? `PublishedAt: ${doc.publishedAt}` : 'PublishedAt: Unknown'
      const content = doc.markdown ?? doc.content ?? doc.description ?? ''
      const truncatedContent = content.length > 4000 ? `${content.slice(0, 4000)}\n... (truncated)` : content

      return [
        `### Source ${index + 1}`,
        `Title: ${title}`,
        url,
        published,
        '',
        truncatedContent || 'No content returned.',
      ].join('\n')
    })
    .join('\n\n---\n\n')

  return `사용자가 입력한 검색어: "${query}"

아래는 Firecrawl에서 지난 24시간 이내에 수집한 뉴스 및 커뮤니티 글의 요약/마크다운입니다.
각 소스를 검토하고 JSON 형식으로 결과를 작성하세요.

필수 JSON 형식 (추가 텍스트 금지):
{
  "marketNews": [ "string", ... ],
  "painPoints": [ "string", ... ],
  "competitorTrends": [ "string", ... ],
  "sentiment": { "positive": number, "negative": number }
}

- marketNews: 최신 뉴스에서 얻은 핵심 인사이트를 1~3줄씩 요약합니다.
- painPoints: 커뮤니티/유저 불만 및 페인 포인트를 정리합니다.
- competitorTrends: 경쟁사의 움직임을 요약합니다.
- sentiment: 긍정/부정 점수를 0~100 사이의 정수로 표현합니다.

Sources:
${sourcesAsMarkdown}`
}

async function callClaudeForStructuredJson(query: string, documents: FirecrawlResult[]): Promise<{ data: StructuredResearch; raw: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? ''
  const response = await fetch(CLAUDE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 800,
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content:
            'You are Rin-AI, a market research analyst. Always respond with valid JSON matching the provided schema. Do not include any additional commentary.',
        },
        {
          role: 'user',
          content: buildClaudeUserPrompt(query, documents),
        },
      ],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Claude request failed: ${response.status} ${errorText}`)
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>
  }

  const rawText = data.content?.map((block) => block.text ?? '').join('').trim() ?? ''
  if (!rawText) {
    throw new Error('Claude returned an empty response')
  }

  try {
    const parsed = JSON.parse(rawText) as ParsedClaude
    return { data: normaliseStructuredResearch(parsed), raw: rawText }
  } catch (error) {
    throw new Error(`Failed to parse Claude JSON: ${(error as Error).message}`)
  }
}

async function buildResearchResponse(query: string): Promise<{
  status: number
  body: ResearchResponse
}> {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) {
    return {
      status: 400,
      body: {
        success: false,
        query: '',
        error: '검색어를 입력해주세요.',
      },
    }
  }

  const missingEnv = validateServerEnv()
  if (missingEnv.length > 0) {
    return {
      status: 500,
      body: {
        success: false,
        query: '',
        error: `서버 환경 변수가 설정되지 않았습니다: ${missingEnv.join(', ')}`,
      },
    }
  }

  try {
    const documents = await fetchFirecrawlDocuments(trimmedQuery)
    if (documents.length === 0) {
      return {
        status: 200,
        body: {
          success: true,
          query: trimmedQuery,
          data: {
            marketNews: [],
            painPoints: [],
            competitorTrends: [],
            sentiment: { positive: 0, negative: 0 },
          },
          message: '관련 데이터를 찾지 못했습니다.',
        },
      }
    }

    const { data, raw } = await callClaudeForStructuredJson(trimmedQuery, documents)
    return {
      status: 200,
      body: {
        success: true,
        query: trimmedQuery,
        data,
        rawClaudeOutput: raw,
      },
    }
  } catch (error) {
    console.error('[Research API] Research orchestrator failed:', error)
    return {
      status: 502,
      body: {
        success: false,
        query: '',
        error: '외부 리서치 서비스 호출에 실패했습니다.',
      },
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body?.query || typeof body.query !== 'string') {
      return NextResponse.json<ResearchResponse>(
        {
          success: false,
          query: '',
          error: '검색어(query)가 필요합니다.',
        },
        { status: 400 }
      )
    }

    const result = await buildResearchResponse(body.query)
    return NextResponse.json<ResearchResponse>(result.body, { status: result.status })
  } catch (error) {
    console.error('[Research API] POST error:', error)

    return NextResponse.json<ResearchResponse>(
      {
        success: false,
        query: '',
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
          error: 'query 파라미터가 필요합니다.',
        },
        { status: 400 }
      )
    }

    const result = await buildResearchResponse(query)
    return NextResponse.json<ResearchResponse>(result.body, { status: result.status })
  } catch (error) {
    console.error('[Research API] GET error:', error)

    return NextResponse.json<ResearchResponse>(
      {
        success: false,
        query: '',
        error: '리서치 처리 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}
