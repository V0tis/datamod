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

/** 검색량 문자열에서 숫자 추출 (100+, 1000+ 등). 1000+ 이상이면 네온 로즈 강조용 */
export function parseSearchVolumeNum(s: string | null | undefined): number {
  if (s == null) return 0
  const n = parseInt(String(s).replace(/\D/g, ''), 10)
  return Number.isNaN(n) ? 0 : n
}

/** 데이터 기준 타임스탬프: "2026. 02. 10 08:14 (실시간)" */
export function formatDataTimestamp(isoString: string | null | undefined): string {
  if (!isoString) return '—'
  const d = new Date(isoString)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}. ${m}. ${day} ${h}:${min}`
}
