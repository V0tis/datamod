/**
 * Datamod B2B analytics design tokens.
 * Mirrors `app/globals.css` `:root` variables `--dm-*` for charts and inline styles.
 */
export const dmColors = {
  primary: '#1B64DA',
  primaryLight: '#EEF3FD',
  success: '#0D9F6E',
  successLight: '#ECFDF5',
  warning: '#D97706',
  warningLight: '#FFFBEB',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  neutral: '#6B7280',
  bg: '#F7F8FA',
  surface: '#FFFFFF',
  border: '#E5E8EF',
  borderStrong: '#CDD2DC',
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textMuted: '#9CA3AF',
} as const

/** Score band colors (0–100 or normalized tiers) */
export const dmScoreColors = {
  high: '#0D9F6E',
  mid: '#1B64DA',
  low: '#D97706',
  risk: '#DC2626',
} as const

/**
 * Use in Recharts, Canvas, etc. Resolves at runtime from CSS when wrapped in `.dm-analytics-page` / light theme.
 */
export const dmColorVars = {
  primary: 'var(--dm-color-primary)',
  primaryLight: 'var(--dm-color-primary-light)',
  success: 'var(--dm-color-success)',
  successLight: 'var(--dm-color-success-light)',
  warning: 'var(--dm-color-warning)',
  warningLight: 'var(--dm-color-warning-light)',
  danger: 'var(--dm-color-danger)',
  dangerLight: 'var(--dm-color-danger-light)',
  neutral: 'var(--dm-color-neutral)',
  bg: 'var(--dm-color-bg)',
  surface: 'var(--dm-color-surface)',
  border: 'var(--dm-color-border)',
  borderStrong: 'var(--dm-color-border-strong)',
  textPrimary: 'var(--dm-color-text-primary)',
  textSecondary: 'var(--dm-color-text-secondary)',
  textMuted: 'var(--dm-color-text-muted)',
  scoreHigh: 'var(--dm-score-high)',
  scoreMid: 'var(--dm-score-mid)',
  scoreLow: 'var(--dm-score-low)',
  scoreRisk: 'var(--dm-score-risk)',
} as const

export type DmColorKey = keyof typeof dmColors
