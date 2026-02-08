import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** ISO 날짜 문자열을 "방금 전" / "N분 전" / "N시간 전" 등으로 표시 */
export function formatTimeAgo(isoString: string | null | undefined): string {
  if (!isoString) return '—'
  const t = new Date(isoString).getTime()
  const now = Date.now()
  const diffMs = now - t
  const diffM = Math.floor(diffMs / 60_000)
  const diffH = Math.floor(diffMs / 3_600_000)
  const diffD = Math.floor(diffMs / 86_400_000)
  if (diffMs < 60_000) return '방금 전'
  if (diffM < 60) return `${diffM}분 전`
  if (diffH < 24) return `${diffH}시간 전`
  if (diffD < 7) return `${diffD}일 전`
  return new Date(isoString).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}
