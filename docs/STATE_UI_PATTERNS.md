# Loading, Empty, and Error State Patterns

Standardized UI for loading, empty, and error states across the app. Use these components so intent and recovery are clear.

## Components (`components/ui/`)

### LoadingState
- **Purpose:** Communicate what is happening, not just a spinner.
- **Props:** `message` (required), `detail` (optional), `size`, `icon`, `className`, `live`.
- **Usage:** Always provide a short `message` that describes the intent (e.g. "리서치 기록을 불러오고 있어요"). Add `detail` for a second line (e.g. "잠시만 기다려 주세요.").
- **Example:** History page initial load, results tab content loading, auth callback, share/report load.

### EmptyState
- **Purpose:** Explain what’s missing and how to get a meaningful result.
- **Props:** `title`, `description`, `action` (optional CTA), `icon`, `className`.
- **Usage:** `title` = what’s empty; `description` = how to get content (e.g. "키워드를 검색하면 리서치 결과가 여기에 쌓여요."). Use `action` for a primary button/link.
- **Example:** No keyword on results, no history records, no trend data for country, tab analysis not yet run.

### ErrorState
- **Purpose:** Explain what went wrong and suggest recovery.
- **Props:** `title`, `description`, `recoveryLabel`, `onRecovery`, `detail` (optional technical message), `secondaryAction`, `variant` ('default' | 'warning').
- **Usage:** `title` = short headline; `description` = what happened and why (user-friendly); `recoveryLabel` + `onRecovery` = primary recovery button. Use `variant="warning"` for quota/rate-limit.
- **Example:** Analysis failed, quota exceeded, auth failed, share/report load failed.

## Rules

1. **Loading:** Use LoadingState with an intent message (and optional detail). Avoid standalone spinners without text.
2. **Error:** Use ErrorState with a recovery action (button or link). Always suggest a next step.
3. **Empty:** Use EmptyState with a description that explains how to get a result (e.g. search, change country, retry).

## Where They’re Used

| Location | Loading | Empty | Error |
|----------|---------|--------|-------|
| Results page | History check, Suspense fallback | No keyword | Analysis failed, Quota |
| History page | Initial fetch | No records | List/delete fail |
| Trends page | — | No country data | — |
| Auth callback | Login in progress | — | Auth failed |
| Share [token] | Fetching report | — | Invalid/expired link |
| Results [id] | Fetching report | — | Report load fail |
| GroqAnalysis / GeminiAnalysis | Tab content load | No tab result | Retry after error |
| ConsensusInsight | Consensus building | No data yet | Both engines failed |
