# Repository Analysis: Datamod

**Scope:** Full codebase review from a PM and engineering perspective.  
**Deliverable:** Analysis summary + proposed refactoring plan. No refactoring performed.

---

## 1. Current User Flow (PM Perspective)

### Entry points
- **Home (`/`):** Search box (keyword + country chip). User submits → optional `POST /api/reports` (record keyword) → navigate to `/results?keyword=...&country=...`.
- **Results (`/results`):** Primary flow. Tries to load from cache first (`loadFromHistory` → `GET /api/research/history?keyword=&country=`). If not cached → `startResearch()` → **SSE stream** (`POST /api/research/stream`): RSS news fetch → Gemini analysis → parse JSON → upsert `reports` + `research_history` → client shows summary, charts, key findings. Then **tab analysis** (시장 분석 / 인사이트 / 종합 리포트) via `POST /api/research/insights/tab` (Groq + Gemini + optional consensus). Optional **follow-up Q&A** via `POST /api/research/insights/follow-up`.
- **History (`/history`):** Intended to list past research and delete items. **Frontend expects `GET /api/research/history` (no query) to return `{ list: [...] }` and `DELETE /api/research/history` with `{ id }` — these are not implemented in the current history route**, which only supports `GET ?keyword=&country=` and returns a single cached report. So the history list and delete actions are effectively broken or unimplemented.
- **Result by ID (`/results/[id]):** Fetches a single report by ID via `GET /api/reports/[id]` for “히스토리에서 항목 클릭” flow. Uses `reports` table only (no tab/consensus data).
- **Trends (`/trends`):** Read-only trends UI; data from `GET /api/trends` (and optional refresh).
- **Share (`/share/[token]):** Public, unauthenticated view of a report via `GET /api/share/[token]` (lookup by `reports.share_token`).
- **Auth:** Login/signup/verify/callback; middleware protects all non-public routes (including `/api/*` is not protected; only page routes redirect to `/login`).

### Decision / data flow (simplified)
1. User enters keyword (and country) on home → results page.
2. Results: **cache-first** (research_history by user_id, keyword, country_code). If cache hit and within TTL → show cached report + tab data from `research_history`. If miss or expired → run stream (RSS + Gemini), write to `reports` + `research_history`, then run tab analysis and write back to `research_history`.
3. Tab analysis is keyed by same (user_id, keyword, country_code); 24h TTL; reanalyze only re-runs consensus when creative tab is refreshed.
4. Report content lives in `reports`; cache metadata and tab/consensus live in `research_history` (linked by `report_id`).

---

## 2. Core Domains

| Domain | Purpose | Key files / tables |
|--------|--------|---------------------|
| **Research** | Initial market research: RSS news + AI analysis, JSON report | `app/api/research/route.ts`, `app/api/research/stream/route.ts`, `lib/research-parser.ts`, `lib/research-types.ts` |
| **Insight** | Tab-level AI (logic/creative/fact), consensus synthesis, follow-up Q&A | `app/api/research/insights/tab/route.ts`, `app/api/research/insights/follow-up/route.ts`, `services/ai/tabAnalysis.ts`, `services/ai/consensusService.ts` |
| **Report** | Stored report content and sharing | `reports` table, `app/api/reports/route.ts`, `app/api/reports/[id]/route.ts`, `app/api/reports/[id]/share/route.ts`, `app/api/share/[token]/route.ts`, `lib/pdf-export.ts` |
| **AI** | Single entry for Gemini/Groq/consensus/tab calls; key resolution | `services/aiClient.ts`, `services/ai/*`, `lib/research-keys.ts`, `lib/license.ts` |
| **Cache** | TTL, key strategy, logging for research/tab reuse | `lib/research-cache.ts`; storage = `research_history` table |
| **Auth** | Supabase auth, session, protected routes, user settings | `middleware.ts`, `lib/supabase/*`, `app/auth/*`, `app/api/auth/*`, `app/api/settings/route.ts`, `app/api/me/route.ts` |
| **Trends** | Read-only trends data and refresh | `app/api/trends/route.ts`, `lib/trends-cache.ts`, `lib/trends-types.ts` |
| **Usage / cost** | Gemini usage and quota display | `lib/usage.ts`, `app/api/usage/route.ts` |

---

## 3. Files Where Responsibilities Are Mixed or Unclear

- **`app/results/page.tsx`**  
  Very large component. Owns: URL/sync, history check, stream outcome, **all tab state** (Groq/Gemini per tab, errors, retries, loading), consensus state, follow-up Q&A, trends fetch, PDF export, sidebar/evidence/implication collapse, and rendering of summary, key findings, charts, tabs, modals. Mix of orchestration, API calls, and UI. Hard to test and to change one concern without touching others.

- **`lib/stores/research-store.ts`**  
  Combines: global research state (keyword, status, result, newsList, error, insights), **stream consumption** (SSE parsing, toasts, retry scheduling), `loadFromHistory`, `loadReportByKeyword`, and `fetchGeminiQuota`. Store both holds UI state and implements fetch/stream logic; moving stream to a dedicated service would clarify boundaries.

- **`app/api/research/route.ts`**  
  Initial research using **Gemini with grounding**. Separate from the main **stream** flow (which uses RSS + Gemini without grounding). Two “initial research” paths exist; when each is used from the product is unclear from the route alone (stream is the one used by the current home → results flow).

- **`app/api/research/history/route.ts`**  
  Single responsibility: return one cached report by (keyword, country). Does **not** implement the **list** or **delete** semantics that `app/history/page.tsx` and home “recent reports” expect (`GET` without params → `list`, `DELETE` with body `{ id }`). Responsibility is clear for “get by keyword”, but the **API contract** assumed by the frontend is not implemented here.

- **Consensus normalization in two places**  
  - **`services/ai/consensusService.ts`:** `normalizeConsensus(raw)` → `Consensus` (used by tab API).  
  - **`components/research/ConsensusInsight.tsx`:** `normalizeConsensusData(raw)` → `ConsensusData` (used by results page).  
  Both handle “legacy” vs “new” shape; logic is duplicated and types differ slightly, which can drift.

- **`app/api/research/insights/follow-up/route.ts`**  
  Uses **system Gemini key only** (`getSystemGeminiKey()`), unlike stream/tab which use user or mixed keys. That policy is not obvious from the file name and could be centralized in a small “which key for which route” doc or helper.

---

## 4. Duplicated or Tightly Coupled Logic

### Duplication
- **Consensus normalization:** Two normalizers (Consensus vs ConsensusData) with overlapping legacy/new handling. Unifying on one type and one normalizer (e.g. in `lib/` or `services/ai`) and mapping to component props would remove duplication and keep behavior in sync.
- **JSON “ensure object”:** `ensureObject` in `app/api/research/history/route.ts` parses string/object from DB. Similar needs exist elsewhere; could live in `lib/` (e.g. `lib/json-utils.ts`) and be reused.
- **Key resolution:** Helpers like `getGeminiKeyForRequest` are centralized in `lib/research-keys.ts` and `lib/license.ts`; the only duplication is “tab uses env-only” vs “stream uses user+env”, which is a product choice, not logic duplication.

### Tight coupling
- **Results page ↔ store ↔ APIs:** Results page knows store shape, history vs stream, tab API payload (keyword, reportId, tab, provider, isReanalyze, countryCode), and response shape (groq/gemini/consensus, errors). Changing API or store shape forces broad edits in one large file.
- **research_history ↔ reports:** Stream and tab routes write to both; history route reads both. Key is (user_id, keyword, country_code) in research_history; report_id links to reports. Any schema or key change touches stream, tab, and history routes.
- **Tab analysis and cache:** Tab route embeds cache read/write, TTL checks, and “reanalyze vs full” logic. Cache module is separate but usage is tightly bound to this route; extracting a small “research cache service” (read/write by key) could reduce coupling and make reuse easier.

### Other
- **`parseInitialResearchResponse`** is correctly shared between `app/api/research/route.ts` and `app/api/research/stream/route.ts` via `lib/research-parser.ts` — good.
- **`extract-json`** and **`fetch-json`** are used for different purposes (AI response vs HTTP response); no unnecessary duplication.

---

## 5. Proposed Refactoring Plan

Do **not** implement yet; this is the recommended order and scope of changes.

### Phase 1: Fix API contract and data flow
1. **History API**  
   - In `app/api/research/history/route.ts`:  
     - **GET** without `keyword`: return `list` of research_history rows (e.g. id, keyword, country_code, report_id, updated_at) for the current user, ordered by updated_at.  
     - **DELETE** with body `{ id }`: delete the research_history row (and optionally the linked report if no other history references it).  
   - Align `app/history/page.tsx` and home “recent reports” with this contract (they already expect `list` and delete by id).

### Phase 2: Consolidate consensus and small utils
2. **Single consensus normalizer**  
   - Choose one canonical shape (e.g. `Consensus` in `services/ai/consensusService.ts` or a shared type in `lib/research-types.ts`).  
   - Implement a single normalizer (e.g. in `lib/` or `services/ai`) that accepts raw API/DB payload and returns that shape.  
   - Use it in both the tab API and the frontend; `ConsensusInsight` receives the same type (or a thin mapping in the component).  
   - Deprecate `normalizeConsensusData` in the component once the single normalizer is used everywhere.

3. **Shared JSON/DB helpers**  
   - Move `ensureObject` (and any similar “parse JSON from string or object”) to e.g. `lib/json-utils.ts` and use it from the history route and any other route that normalizes DB JSON.

### Phase 3: Reduce results page and store complexity
4. **Results page**  
   - Split into smaller pieces: e.g. **ResultsLayout** (URL, history check, stream trigger), **ResultsSummary** (summary + key findings + charts), **ResultsTabs** (tab UI + tab API calls + consensus/fact payload), **ResultsFollowUp**, **ResultsEvidence** (news, modals), **ResultsSidebar** (momentum, trends, metrics).  
   - Prefer custom hooks (e.g. `useTabAnalysis`, `useConsensus`, `useFollowUp`) to hold API calls and local state; the page composes them and renders presentational components.

5. **Research store**  
   - Keep in store: keyword, status, result, newsList, error, insights, and high-level actions `startResearch`, `loadFromHistory`, `loadReportByKeyword`, `reset`, `setInsights`, `fetchGeminiQuota`.  
   - Move **stream consumption** (SSE parsing, step handling, retry scheduling) into a dedicated module (e.g. `lib/research-stream.ts` or `services/researchStreamClient.ts`) that the store calls. Store only updates state from parsed events; no raw stream logic inside the store.

### Phase 4: Clarify research entry points and docs
6. **Research routes**  
   - Document when to use `POST /api/research` (initial with grounding) vs `POST /api/research/stream` (current main flow: RSS + Gemini). If the non-stream route is unused by the app, consider deprecating or removing it to avoid confusion.  
   - Optionally add a one-line comment in each route: “Used by: …” so that product flow is obvious.

7. **Keys and follow-up**  
   - Document in one place (e.g. `lib/research-keys.ts` or a short `docs/API_KEYS.md`) which routes use user keys vs system keys (e.g. follow-up = system Gemini only; stream = user Gemini or system; tab = env Groq + Gemini).  
   - No need to change behavior yet; clarity first.

### Phase 5: Optional structural improvements
8. **Cache abstraction**  
   - Introduce a thin “research cache service” (e.g. `lib/research-cache-service.ts`) that uses `research_history` and `research-cache` (TTL, key parts) to implement `get(keyword, countryCode)`, `set(...)`, `invalidate(...)`.  
   - Stream and tab routes call this instead of inlining Supabase + TTL logic. Keeps cache ownership and key strategy in one place.

9. **Types**  
   - Extend `lib/research-types.ts` with shared request/response types for history (list item, get-by-keyword response) and tab API (payload and response shapes) so that routes and frontend share the same contracts and reduce ad-hoc casts.

---

## Summary Table

| Area | Issue | Proposed action |
|------|--------|------------------|
| History API | List and DELETE not implemented; frontend expects them | Implement GET (no params) → list, DELETE with body `{ id }` |
| Consensus | Two normalizers, two types | Single normalizer + single type; component uses it |
| Utils | ensureObject only in history route | Move to lib, reuse |
| Results page | Too large, mixed concerns | Split into layout, sections, and hooks |
| Research store | Contains stream parsing logic | Move stream handling to dedicated module |
| Research routes | Two “initial” research paths | Document or remove unused one |
| Keys / follow-up | Policy (system vs user) not obvious | Document in one place |
| Cache | TTL/key logic spread in route | Optional: thin cache service |
| Types | Ad-hoc casts in routes/frontend | Shared types in lib/research-types |

This plan addresses user flow correctness (history), reduces duplication and coupling (consensus, utils, stream), and improves maintainability (results page, store, docs) without changing product behavior except for fixing the history list/delete contract.
