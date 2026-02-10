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
export function getCountryFlagUrl(countryCode: string, size: 'w80' | 'w160' = 'w80'): string {
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
    <img
      src={src}
      alt=""
      role="presentation"
      className={cn('shrink-0 object-cover rounded-sm', className)}
      width={displayW}
      height={displayH}
      style={{ width: displayW, height: displayH, minWidth: displayW, minHeight: displayH }}
    />
  )
}

export interface CountryChipsProps {
  value: string
  onChange: (code: CountryChipCode) => void
  updatedAt?: string | null
  rightElement?: React.ReactNode
  className?: string
}

export function CountryChips({ value, onChange, updatedAt, rightElement, className }: CountryChipsProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div className="flex flex-wrap gap-1.5">
        {COUNTRY_CHIP_CODES.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => onChange(code)}
            className={cn(
              'rounded-full pl-3 pr-4 py-2 text-sm font-medium transition-colors inline-flex items-center gap-2',
              value === code
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            )}
          >
            <CountryFlagIcon code={code} size="chip" />
            <span>{COUNTRY_LABELS[code] ?? code}</span>
          </button>
        ))}
      </div>
      {rightElement != null && <div className="flex items-center gap-2">{rightElement}</div>}
      {updatedAt != null && (
        <p className="text-muted-foreground text-xs w-full sm:w-auto mt-1 sm:mt-0 flex items-center gap-1.5">
          데이터 기준: {formatDataTimestamp(updatedAt)}
          <span className="inline-flex items-center gap-1 text-primary" aria-label="실시간">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" aria-hidden />
            실시간
          </span>
        </p>
      )}
    </div>
  )
}
