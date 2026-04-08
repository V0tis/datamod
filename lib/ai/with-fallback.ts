/**
 * Generic primary → secondary fallback when primary fails with retryable errors.
 * 파이프라인 전용 로직은 `pipeline-text-completion.ts`에 두고, 여기서는 재사용 가능한 최소 래퍼만 제공합니다.
 */
export type WithFallbackResult<T> = {
  value: T
  usedFallback: boolean
  /** 보조 경로를 탄 경우에만 의미 있는 1차 실패 사유 */
  primaryError?: string
}

export async function withFallback<T>(options: {
  tryPrimary: () => Promise<T>
  tryFallback: () => Promise<T>
  /** true이면 보조 시도로 넘어감 */
  shouldFallback: (primaryError: unknown) => boolean
}): Promise<WithFallbackResult<T>> {
  try {
    const value = await options.tryPrimary()
    return { value, usedFallback: false }
  } catch (primaryError) {
    if (!options.shouldFallback(primaryError)) throw primaryError
    const value = await options.tryFallback()
    const msg =
      primaryError instanceof Error
        ? primaryError.message
        : typeof primaryError === 'string'
          ? primaryError
          : String(primaryError)
    return { value, usedFallback: true, primaryError: msg }
  }
}
