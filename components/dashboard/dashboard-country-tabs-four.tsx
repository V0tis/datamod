'use client'

import { cn } from '@/lib/utils'
import { CountryFlagIcon } from '@/components/country-chips'
import type { CountryChipCode } from '@/components/country-chips'

/** 대시보드 하단 전용: 한국·미국·일본·대만 (데이터 출처와 동일 코드) */
export const DASHBOARD_TREND_REGIONS: readonly CountryChipCode[] = ['KR', 'US', 'JP', 'TW']

const LABELS: Record<string, string> = {
  KR: '한국',
  US: '미국',
  JP: '일본',
  TW: '대만',
}

export function DashboardCountryTabsFour({
  value,
  onChange,
  className,
}: {
  value: CountryChipCode
  onChange: (code: CountryChipCode) => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)} role="tablist" aria-label="트렌드 지역">
      {DASHBOARD_TREND_REGIONS.map((code) => {
        const active = value === code
        return (
          <button
            key={code}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(code)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[13px] font-medium transition-colors',
              active
                ? 'border-sky-500 bg-sky-50 text-sky-900   '
                : 'border-[#E5E9F2] bg-white text-[#374151] hover:bg-slate-50    '
            )}
          >
            <CountryFlagIcon code={code} size="chip" />
            {LABELS[code] ?? code}
          </button>
        )
      })}
    </div>
  )
}
