export type RiskSeverity = 'high' | 'medium' | 'low'

/**
 * 리스크 문장에서 위험도를 휴리스틱으로 추정 (한·영 키워드).
 */
export function inferRiskSeverity(text: string): RiskSeverity {
  const t = text.toLowerCase()
  const high =
    /치명|심각|크리티컬|critical|high\s*risk|규제\s*위반|법적|소송|파산|단종|봉쇄|제재|매우\s*높|상당한\s*리스크|불가역|대규모\s*손실/.test(t) ||
    /fatal|severe|breach|bankruptcy|shutdown/.test(t)
  if (high) return 'high'
  const low =
    /낮은?\s*리스크|low\s*risk|미미|경미|완화\s*가능|통제\s*가능|모니터링|주의\s*수준/.test(t) ||
    /minor|negligible|mitigated/.test(t)
  if (low) return 'low'
  const medium =
    /중간|중대|moderate|medium|불확실|변동|경쟁\s*심화|의존|집중\s*리스크/.test(t) || t.length > 100
  if (medium) return 'medium'
  return 'low'
}
