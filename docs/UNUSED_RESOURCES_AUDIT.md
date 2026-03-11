# rin-ai 미사용 리소스 감사 리포트

> **주의**: 이 문서는 삭제 전 참고용입니다. 실제 삭제 전 기능·플로우 재검토가 필요합니다.

---

## 1. Unused React Components

| File Path | Resource Name | Why Unused | Originally Intended |
|-----------|---------------|------------|---------------------|
| `components/research/FirstFiveSecondsBanner.tsx` | `FirstFiveSecondsBanner` | No import from any file | Likely early-loading UX banner; never integrated |
| `components/research/InsightCard.tsx` | `InsightCard` | No import from any file | Replaced by `StructuredInsightCard` (used in KeyMarketInsightsCard) |
| `components/research/StreamingInsightText.tsx` | `StreamingInsightText` | Only `StreamingBulletList` is imported; parent component unused | May have been superseded by StreamingBulletList usage |

---

## 2. Unused Hooks

| File Path | Resource Name | Why Unused | Originally Intended |
|-----------|---------------|------------|---------------------|
| `lib/hooks/use-analysis-tasks.ts` | `useAnalysisTasks` | No import; `/tasks` page now redirects to `/history` | Used by old Tasks page (job-based UI) |

---

## 3. Unused Utility Functions

| File Path | Resource Name | Why Unused | Originally Intended |
|-----------|---------------|------------|---------------------|
| `lib/utils.ts` | `parseSearchVolumeNum` | Exported but never imported | Likely for trends search volume parsing |

---

## 4. Unused API Routes (No Client `fetch`)

| File Path | Resource Name | Why Unused | Originally Intended |
|-----------|---------------|------------|---------------------|
| `app/api/analyze/route.ts` | `POST /api/analyze` | No client fetch; app uses `/api/research/run` | Legacy streaming NDJSON analysis |
| `app/api/analyses/route.ts` | `GET /api/analyses` | Old `/analyses` page redirects to `/history`; `/history` uses `/api/research/history` | Served old "내 분석" page (analysis_history table) |
| `app/api/health/route.ts` | `GET /api/health` | No client fetch | Uptime/monitoring (e.g. Vercel, external checks) |
| `app/api/me/route.ts` | `GET /api/me` | No client fetch in app code | Documented for auth; possibly used by middleware or external tools |
| `app/api/research/route.ts` | `POST /api/research` | Client uses `/api/research/run` | Non-streaming initial research (grounding/OpenAI fallback) |
| `app/api/research/stream/route.ts` | `POST /api/research/stream` | Client uses `/api/research/run` | Legacy SSE stream; `vercel.json` references it |
| `app/api/trends/update/route.ts` | `POST /api/trends/update` | No client fetch | Cron/manual refresh of global trends; `refreshGlobalTrends()` |

---

## 5. Unused Imports / Modules

| File Path | Resource Name | Why Unused | Originally Intended |
|-----------|---------------|------------|---------------------|
| `lib/analysis-service.ts` | Entire module | No import anywhere | Job CRUD helpers; research-store calls fetch directly |
| `lib/ai/stream-analysis-prompt.ts` | `STREAM_ANALYSIS_SYSTEM`, `buildStreamAnalysisPrompt` | No import | Streaming section-marker format; possibly for `/api/analyze` |
| `lib/ai/pm-opportunity-prompt.ts` | `PM_OPPORTUNITY_SYSTEM` | No import | PM opportunity schema prompt |
| `lib/ai/pm-opportunity-schema.ts` | `PM_OPPORTUNITY_JSON_SCHEMA` | Only imported by pm-opportunity-prompt (which is unused) | Schema for opportunity analysis |
| `lib/ai/strategy-engine-types.ts` | Exported types | No import | Strategy engine type definitions |
| `components/country-chips.tsx` | `getCountryFlagUrl` | Exported but used only internally | Possibly for future reuse; export redundant |

---

## 6. Unused Environment Variables

| Variable | File Path | Why Unused | Originally Intended |
|----------|-----------|------------|---------------------|
| `RESEND_API_KEY` | README.md | No `resend` import in codebase | Resend OTP/email; Supabase Auth used instead |
| `EMAIL_FROM` | README.md | No usage | Resend email sender |

---

## 7. Unused npm Packages

| Package | Why Unused | Originally Intended |
|---------|------------|---------------------|
| `embla-carousel-react` | No import | Carousel UI component |
| `input-otp` | No import | OTP input (e.g. email verification) |
| `react-day-picker` | No import | Date picker |
| `vaul` | No import | Drawer/sheet component |
| `cmdk` | No import | Command palette |
| `@vercel/analytics` | Not imported in layout or app | Analytics; can be added to layout if needed |
| `resend` | No import | Email OTP (Supabase Auth used) |
| `pg` | No direct import | Possibly Supabase or migration tooling dependency |

---

## 8. Unused CSS / Tailwind Classes

- **Limitation**: Automated audit not performed. Tailwind purge typically removes unused classes at build time.
- **Recommendation**: Use tools like `tailwindcss-unused` or manual review if bundle size is a concern.

---

## 9. Unused Images / Static Assets

| Path | Status |
|------|--------|
| `public/` | Empty directory |
| Flag images | Served from `https://flagcdn.com/` CDN |
| `favicon.ico` | Referenced in proxy; standard Next.js handling |

---

## 10. Unused TypeScript Types / Interfaces

| File Path | Resource Name | Why Unused | Originally Intended |
|-----------|---------------|------------|---------------------|
| `lib/supabase.ts` | `Profile` | Exported but never imported | User profile type |
| `lib/confidence-display.ts` | `ConfidenceContext` | Used only as parameter type in same file | Internal type |
| `lib/error-handler.ts` | `ErrorDetailPayload` | Used as return type in same file; not imported externally | Internal type |
| `lib/stores/reading-mode-store.ts` | `useReadingModeStore` | No import anywhere | Reading mode UI state |

---

## Summary Table

| Category | Count |
|----------|-------|
| React components | 3 |
| Hooks | 1 |
| Utility functions | 1 |
| API routes | 7 |
| Lib modules | 5 |
| Env variables | 2 |
| npm packages | 7–8 |
| TypeScript types/stores | 4 |

---

## Notes Before Removal

1. **API routes** (`/api/health`, `/api/me`, `/api/trends/update`): May be used by external monitoring, auth flows, or cron.
2. **`/api/analyze`, `/api/research`, `/api/research/stream`**: Legacy flows; verify no external integrations.
3. **`resend`, `input-otp`, `react-day-picker`**: May be planned for OTP/email verification UI.
4. **`@vercel/analytics`**: Optional; add to layout if analytics are desired.
