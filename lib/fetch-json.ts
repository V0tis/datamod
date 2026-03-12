import { logger } from '@/lib/logger'

function isJsonResponse(res: Response): boolean {
  const ct = res.headers.get('content-type') ?? ''
  return ct.includes('application/json')
}

/**
 * res.ok가 아니거나 Content-Type이 JSON이 아니면 res.json()을 호출하지 않고
 * res.text()로 본문을 읽어 Error를 throw. HTML 404 등에서 "Unexpected token '<'" 방지.
 */
export async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!res.ok) {
    const err = new Error(text || res.statusText || `HTTP ${res.status}`) as Error & { status: number }
    err.status = res.status
    logger.error('parseJsonResponse: non-OK response', {
      status: res.status,
      url: res.url,
      bodyPreview: text.slice(0, 200),
    })
    throw err
  }
  if (!isJsonResponse(res)) {
    const err = new Error(text || '응답이 JSON이 아닙니다.') as Error & { status: number }
    err.status = res.status
    logger.error('parseJsonResponse: non-JSON content-type', {
      status: res.status,
      url: res.url,
      contentType: res.headers.get('content-type'),
    })
    throw err
  }
  try {
    return JSON.parse(text) as T
  } catch (parseErr) {
    logger.error('parseJsonResponse: JSON parse failed', {
      url: res.url,
      status: res.status,
      bodyPreview: text.slice(0, 200),
      parseError: parseErr instanceof Error ? parseErr.message : String(parseErr),
    })
    const err = new Error(text || 'JSON 파싱에 실패했습니다.') as Error & { status: number }
    err.status = res.status
    throw err
  }
}
