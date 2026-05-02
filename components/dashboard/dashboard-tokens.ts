import { cn } from '@/lib/utils'

/** 배민형 대시보드 포인트 (민트 + 블루 보조) */
export const dashboardMint = '#2AC1BC'
export const dashboardMintSoft = 'rgba(42, 193, 188, 0.14)'

/** Datamod 대시보드 카드: 흰 배경, 1px #E5E7EB, 12px radius */
export const dashboardCardClass = cn(
  'rounded-xl border border-[#E5E7EB] bg-white text-neutral-900 shadow-sm',
  '  '
)

export const dashboardCardPadding = 'p-5 sm:p-6'

/** 페이지 배경: 카드(화이트)와 대비 — 앱 쉘과 동일 (#F7F8FA) */
export const dashboardPageBg = 'bg-[#F7F8FA] '
export const dashboardHeroBg =
  'rounded-2xl border border-[#E5E7EB] bg-white bg-gradient-to-br from-white via-[#FAFFFE] to-[#F0FDFC] shadow-sm    '
