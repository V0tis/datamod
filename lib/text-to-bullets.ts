/**
 * Split long AI-generated text into bullet points for structured UI.
 * Never display raw paragraphs - always summarize into scannable bullets.
 */
export function textToBullets(
  text: string | undefined,
  maxBullets = 5
): string[] {
  if (!text || typeof text !== 'string') return []
  const trimmed = text.trim()
  if (!trimmed) return []

  // Split by common delimiters: newlines, numbered list, bullet chars
  const parts = trimmed
    .split(/\n+|(?:\d+[\.\)]\s)|\s*[•\-–—]\s*/)
    .map((s) => s.trim())
    .filter(Boolean)

  if (parts.length > 0 && parts.length <= maxBullets) {
    return parts.slice(0, maxBullets)
  }

  // Fallback: split by sentence (., !, ?)
  const sentences = trimmed
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)

  if (sentences.length > 0) {
    return sentences.slice(0, maxBullets)
  }

  // Single chunk - truncate if too long, otherwise return as one bullet
  if (trimmed.length > 200) {
    return [trimmed.slice(0, 197).trim() + '...']
  }
  return [trimmed]
}
