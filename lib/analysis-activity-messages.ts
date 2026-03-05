/**
 * Progressive AI activity messages for analysis loading states.
 * Replaces generic spinners with informative step-specific messages.
 */

const STREAM_TO_INDEX: Record<string, number> = {
  signal_layer: 0,
  news: 0,
  trend_analysis: 1,
  pass1: 1,
  competition_analysis: 2,
  strategy_generation: 3,
  execution_layer: 4,
  pass2: 4,
  creative: 4,
  done: 4,
}

/** Activity messages per analysis step - shown during loading */
export const ANALYSIS_ACTIVITY_MESSAGES: readonly string[] = [
  'Analyzing Market Signals...',
  'Collecting community discussions...',
  'Detecting growth signals...',
  'Mapping competition landscape...',
  'Evaluating risks & opportunities...',
  'Generating strategic insights...',
]

/** Alternative shorter messages for compact UI */
export const ANALYSIS_ACTIVITY_SHORT: readonly string[] = [
  'Collecting signals...',
  'Analyzing trends...',
  'Mapping competition...',
  'Evaluating risks...',
  'Generating insights...',
]

/**
 * Returns the current activity message based on step ID or step index.
 */
export function getAnalysisActivityMessage(
  stepId?: string | null,
  currentStep?: number,
  options?: { short?: boolean }
): string {
  const messages = options?.short ? ANALYSIS_ACTIVITY_SHORT : ANALYSIS_ACTIVITY_MESSAGES
  const stepIdx =
    stepId && STREAM_TO_INDEX[stepId] != null
      ? STREAM_TO_INDEX[stepId]
      : typeof currentStep === 'number' && currentStep >= 0
        ? currentStep
        : 0
  const idx = Math.min(Math.max(0, stepIdx), messages.length - 1)
  return messages[idx] ?? messages[0]
}
