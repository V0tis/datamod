/**
 * API helpers – re-exports from lib/api for clean imports.
 * Use: import { requireAuth, RATE_LIMIT_GRACEFUL_MESSAGE } from '@/api'
 */
export { requireAuth } from '@/lib/api/require-auth'
export {
  RATE_LIMIT_GRACEFUL_MESSAGE,
  isRateLimitResponse,
  getRateLimitGracefulMessage,
} from '@/lib/api/rate-limit'
export { RESEARCH_RUN_DEADLINE_MS } from '@/lib/api/route-timeouts'
