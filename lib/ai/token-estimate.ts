/**
 * Rough token estimate for routing (not billing). Mixed KR/EN: chars/3.5 as middle ground.
 */
export function estimateTokensFromText(text: string): number {
  if (!text) return 0
  const len = text.length
  return Math.ceil(len / 3.5)
}
