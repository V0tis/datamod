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
              'rounded-full px-4 py-2 text-sm font-medium transition-colors',
              value === code
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            )}
          >
            {COUNTRY_LABELS[code] ?? code}
          </button>
        ))}
      </div>
      {rightElement != null && <div className="flex items-center gap-2">{rightElement}</div>}
      {updatedAt != null && (
        <p className="text-muted-foreground text-xs w-full sm:w-auto mt-1 sm:mt-0">
          데이터 기준: {formatDataTimestamp(updatedAt)}
        </p>
      )}
    </div>
  )
}
