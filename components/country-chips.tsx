'use client'

import { cn, formatDataTimestamp } from '@/lib/utils'

/** 칩에서 사용하는 국가 코드 (KR, US, JP, TW, HK, GB, DE) */
export const COUNTRY_CHIP_CODES = ['KR', 'US', 'JP', 'TW', 'HK', 'GB', 'DE'] as const
export type CountryChipCode = (typeof COUNTRY_CHIP_CODES)[number]

export const COUNTRY_LABELS: Record<string, string> = {
  KR: '한국',
  US: '미국',
  JP: '일본',
  TW: '대만',
  HK: '홍콩',
  GB: '영국',
  DE: '독일',
}

/** 국기 이미지 CDN (flagcdn.com). 코드는 소문자 ISO 3166-1 alpha-2 */
const FLAG_CDN_BASE = 'https://flagcdn.com'

/** 고해상도 로드 후 작게 표시해 레티나에서 선명하게 (w80→20px, w160→32px) */
function getCountryFlagUrl(countryCode: string, size: 'w80' | 'w160' = 'w80'): string {
  const code = countryCode.toLowerCase()
  return `${FLAG_CDN_BASE}/${size}/${code}.png`
}

/** 국가 코드 → 국기 아이콘. chip=칩용(작게), header=헤더용(조금 크게) */
export function CountryFlagIcon({
  code,
  size = 'chip',
  className,
}: {
  code: string
  size?: 'chip' | 'header'
  className?: string
}) {
  const src = getCountryFlagUrl(code, size === 'header' ? 'w160' : 'w80')
  const displayW = size === 'header' ? 32 : 20
  const displayH = size === 'header' ? 24 : 15
  return (
    <span
      className={cn(
        'inline-flex shrink-0 rounded-sm overflow-hidden',
        'dark:ring-1 dark:ring-white/20 dark:shadow-sm dark:bg-white/5',
        className
      )}
      style={{ width: displayW, height: displayH, minWidth: displayW, minHeight: displayH }}
    >
      <img
        src={src}
        alt=""
        role="presentation"
        className="w-full h-full object-cover"
        width={displayW}
        height={displayH}
      />
    </span>
  )
}

export interface CountryChipsProps {
  value: string
  onChange: (code: CountryChipCode) => void
  updatedAt?: string | null
  rightElement?: React.ReactNode
  className?: string
  /** Compact mode: flag-only chips, no timestamp, smaller sizing */
  compact?: boolean
}

export function CountryChips({ value, onChange, updatedAt, rightElement, className, compact }: CountryChipsProps) {
  if (compact) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        {COUNTRY_CHIP_CODES.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => onChange(code)}
            title={COUNTRY_LABELS[code] ?? code}
            aria-pressed={value === code}
            aria-label={`${COUNTRY_LABELS[code] ?? code} 선택`}
            className={cn(
              'shrink-0 rounded-lg p-1.5 transition-all duration-200 inline-flex items-center justify-center outline-none',
              'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              value === code
                ? 'bg-primary/15 shadow-md ring-2 ring-primary ring-offset-2 ring-offset-background scale-[1.06] dark:bg-primary/25 dark:ring-primary/90'
                : 'hover:bg-muted/80 opacity-85 hover:opacity-100 hover:scale-[1.02]'
            )}
          >
            <CountryFlagIcon
              code={code}
              size="chip"
              className={cn(
                'transition-opacity',
                value === code ? 'opacity-100' : 'opacity-55 hover:opacity-90'
              )}
            />
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div className="flex gap-2.5 overflow-x-auto overflow-y-hidden pb-1 -mx-1 px-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:rounded [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20">
        {COUNTRY_CHIP_CODES.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => onChange(code)}
            className={cn(
              'shrink-0 rounded-full pl-3 pr-4 py-2 text-sm font-medium transition-all duration-200 ease-out inline-flex items-center gap-2',
              'hover:scale-[1.03] active:scale-[0.98]',
              value === code
                ? 'bg-primary text-primary-foreground shadow-sm dark:bg-blue-950/60 dark:text-blue-400 dark:font-semibold dark:border dark:border-blue-500/30'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground hover:ring-2 hover:ring-primary/20 dark:bg-[#202226] dark:text-[#9ca3af] dark:border dark:border-[#2d2f34] dark:hover:bg-[#2a2d32] dark:hover:text-[#e1e3e6] dark:hover:ring-primary/30'
            )}
          >
            <CountryFlagIcon code={code} size="chip" />
            <span>{COUNTRY_LABELS[code] ?? code}</span>
          </button>
        ))}
      </div>
      {rightElement != null && <div className="flex items-center gap-2">{rightElement}</div>}
      {updatedAt != null && (
        <p className="text-muted-foreground dark:text-slate-400 text-xs w-full sm:w-auto mt-1 sm:mt-0 flex items-center gap-1.5">
          데이터 기준: {formatDataTimestamp(updatedAt)}
          <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-primary dark:bg-[#00d19a]/20 dark:text-[#00d19a] dark:border dark:border-[#00d19a]/50" aria-label="실시간">
            <span className="h-1.5 w-1.5 rounded-full bg-primary dark:bg-[#00d19a] animate-pulse" aria-hidden />
            실시간
          </span>
        </p>
      )}
    </div>
  )
}
