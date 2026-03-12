/**
 * Analysis error → user-friendly message mapping.
 * Supports: idle, loading, success, error, timeout (and quota/network variants).
 */

export type AnalysisErrorVariant = 'error' | 'timeout' | 'quota' | 'network' | 'invalid_input' | 'generic'

export interface AnalysisErrorMessage {
  title: string
  description: string
  variant: AnalysisErrorVariant
  recoveryHint?: string
  /** Possible causes for user guidance */
  possibleCauses?: string[]
}

const TIMEOUT_PATTERNS = /timeout|timed ?out|deadline|econnreset|etimedout|504|요청 시간 초과|타임아웃/i
const QUOTA_PATTERNS = /429|quota|rate ?limit|한도|초과|exhausted|resource ?exhausted/i
const NETWORK_PATTERNS = /network|econnrefused|enotfound|fetch failed|net::|load failed/i
const INVALID_INPUT_PATTERNS = /400|invalid|bad ?request|malformed|잘못된 입력|유효하지 않은/i

/**
 * Maps raw error string/object to user-friendly analysis error message.
 */
export function getAnalysisErrorMessage(raw: unknown): AnalysisErrorMessage {
  const msg = typeof raw === 'string' ? raw : (raw as { message?: string; error?: string })?.message ?? (raw as { error?: string })?.error ?? ''
  const s = String(msg || '').trim()

  if (TIMEOUT_PATTERNS.test(s)) {
    return {
      title: '분석 시간이 초과되었습니다',
      description: 'AI 응답이 예상보다 오래 걸렸습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
      variant: 'timeout',
      recoveryHint: '잠시 후 다시 분석을 실행해 보세요.',
      possibleCauses: [
        'API 응답 시간 초과',
        '서버 부하로 인한 지연',
        '네트워크 불안정',
      ],
    }
  }

  if (QUOTA_PATTERNS.test(s)) {
    return {
      title: 'API 사용 한도 초과',
      description: '설정에서 API 키 사용량을 확인해 주세요. 키를 추가하거나 사용 한도가 늘어난 후 다시 시도할 수 있습니다.',
      variant: 'quota',
      recoveryHint: '설정 페이지에서 키를 확인하세요.',
      possibleCauses: [
        'API 키 일일/월간 사용량 한도 초과',
        '무료 쿼터 소진',
        '유효하지 않거나 만료된 API 키',
      ],
    }
  }

  if (NETWORK_PATTERNS.test(s)) {
    return {
      title: '네트워크 연결 오류',
      description: '인터넷 연결을 확인하고 다시 시도해 주세요.',
      variant: 'network',
      recoveryHint: '연결이 안정되면 다시 분석을 실행해 보세요.',
      possibleCauses: [
        '인터넷 연결 불안정',
        '방화벽 또는 VPN 차단',
        '서버 응답 불가',
      ],
    }
  }

  if (INVALID_INPUT_PATTERNS.test(s)) {
    return {
      title: '입력값 오류',
      description: '검색 키워드가 올바른지 확인해 주세요. 2~5단어의 시장 키워드를 입력해 보세요.',
      variant: 'invalid_input',
      recoveryHint: '다른 키워드로 시도해 보세요.',
      possibleCauses: [
        '지원하지 않는 문자 또는 형식',
        '키워드가 너무 짧거나 길음',
        '잘못된 입력 형식',
      ],
    }
  }

  if (s.length > 0 && s.length < 200) {
    return {
      title: '분석을 완료하지 못했습니다',
      description: s,
      variant: 'error',
      recoveryHint: '다시 시도해 보시거나, 문제가 계속되면 다른 키워드로 시도해 보세요.',
      possibleCauses: ['API 타임아웃', '네트워크 오류', '입력값 오류'],
    }
  }

  return {
    title: '분석 중 오류가 발생했습니다',
    description: '일시적인 문제일 수 있습니다. 잠시 후 다시 시도해 주세요.',
    variant: 'generic',
    recoveryHint: '다시 분석을 실행해 보세요.',
    possibleCauses: ['API 타임아웃', '네트워크 오류', '서버 일시 장애'],
  }
}
