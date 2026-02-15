# Proposed Folder Structure (Domain-Driven Design)

**Goals:** Separate UI, domain logic, and external services; isolate AI from UI; make caching reusable and testable; use names that match PM mental models.

---

## Proposed Folder Tree

```
app/
  (auth)/                    # Auth pages (login, signup, verify, callback)
  (main)/                    # Protected layout + main app shell
    page.tsx                 # Home (search entry)
    results/
      page.tsx               # Results: composes Research + Insights + Report UI
      [id]/page.tsx          # Single report by ID (from history)
    history/
      page.tsx               # My research history
    trends/
      page.tsx               # Trends view
    settings/
      page.tsx               # Account settings, API keys
  share/
    [token]/page.tsx         # Public shared report
  api/                       # Thin HTTP layer: validate → call domain services
    research/
    reports/
    trends/
    account/
    ...
  layout.tsx
  globals.css

src/
  research/                  # Domain: "Run research" (keyword → analysis)
    domain/                  # Types, result shape, validation (no I/O)
    use-cases/               # Start research, load from cache (orchestration)
    services/                # Stream client, RSS fetch (calls shared/ai)
    components/              # Search box, stream progress, result summary blocks

  insights/                  # Domain: "Deeper analysis & Q&A" (tabs, consensus, follow-up)
    domain/                  # Tab types, consensus shape, normalize consensus
    use-cases/               # Load tab, reanalyze consensus, send follow-up question
    services/                # Tab/follow-up API clients (HTTP; AI stays in shared)
    components/              # Tab panels, consensus card, follow-up form

  reports/                   # Domain: "My reports" (save, list, share, export)
    domain/                  # Report shape, share token, list item
    use-cases/               # Save, list, get by id, share, export PDF
    services/                # Reports API client, PDF export
    components/              # Report view, share dialog, history list row

  trends/                    # Domain: "What’s trending"
    domain/                  # Trend item, country, response shape
    use-cases/               # Fetch trends, refresh
    services/                # Trends API client
    components/              # Trend list, country chips, detail panel

  account/                   # Domain: "My account" (auth, settings)
    domain/                  # User, settings, key origin
    use-cases/               # Login, signup, get/update settings, sync profile
    services/                # Auth client, settings API client
    components/              # Login form, settings form (if not in app/)

  shared/                    # Cross-cutting; no product domain
    ai/                      # All AI model calls (single entry; no AI elsewhere)
    cache/                   # Reusable cache: key, TTL, storage interface
    ui/                      # Design system (Button, Card, Input, Tabs, Theme)
    lib/                     # Pure utils (fetch-json, extract-json, error-handler)
```

---

## Responsibility per Folder

### App (routes only)

| Path | Responsibility |
|------|----------------|
| **app/(auth)/** | Auth pages: login, signup, verify, callback. No business logic; call account use-cases or API. |
| **app/(main)/** | Protected app: home, results, history, trends, settings. Pages only compose domain components and hooks; no direct AI or DB. |
| **app/share/[token]/** | Public shared report. Renders report using shared data from API. |
| **app/api/** | HTTP entry: parse body/query, auth, then delegate to domain use-cases or services. No business rules; no AI calls in route files (call shared/ai or use-case that uses it). |

---

### Research (PM: “Run research”)

| Folder | Responsibility |
|--------|----------------|
| **research/domain** | Types (ResearchResult, StreamEvent), validation, parsing (e.g. parseInitialResearchResponse). Pure functions; no fetch, no AI. |
| **research/use-cases** | “Start research” (stream or load from cache), “Load from history by keyword/country”. Orchestrates shared/ai and shared/cache; testable with mocks. |
| **research/services** | Stream client (SSE consume, emit events), RSS/news fetch. Calls shared/ai for Gemini; does not contain prompt or model logic. |
| **research/components** | Search box, stream progress, summary block, key findings, charts. Receive data via props/hooks; never import shared/ai. |

---

### Insights (PM: “Deeper analysis & Q&A”)

| Folder | Responsibility |
|--------|----------------|
| **insights/domain** | Tab id (logic/creative/fact), Consensus type, single normalizer (raw → Consensus). Pure; no I/O. |
| **insights/use-cases** | “Load tab analysis”, “Reanalyze consensus”, “Send follow-up question”. Call shared/ai and shared/cache; return data to UI. |
| **insights/services** | HTTP clients for tab and follow-up APIs. No AI; just request/response. |
| **insights/components** | Tab panels, consensus card, follow-up Q&A form. Data from hooks/context only; no AI. |

---

### Reports (PM: “My reports”)

| Folder | Responsibility |
|--------|----------------|
| **reports/domain** | Report and list-item types, share token. No I/O. |
| **reports/use-cases** | “Save report”, “List my reports”, “Get by id”, “Create share link”, “Export PDF”. Use reports services and shared/cache if needed. |
| **reports/services** | API client for reports CRUD and share; PDF export helper. No AI. |
| **reports/components** | Report view, history list row, share dialog. Presentation only. |

---

### Trends (PM: “What’s trending”)

| Folder | Responsibility |
|--------|----------------|
| **trends/domain** | Trend item, country code, response shape, normalizers. Pure. |
| **trends/use-cases** | “Fetch trends”, “Refresh trends”. Call trends service; service may use shared/cache. |
| **trends/services** | Trends API client (or direct Supabase if API is thin). No AI. |
| **trends/components** | Trend list, country chips, detail panel. Data via props/hooks. |

---

### Account (PM: “My account”)

| Folder | Responsibility |
|--------|----------------|
| **account/domain** | User, settings, key origin (user vs system). No I/O. |
| **account/use-cases** | “Login”, “Signup”, “Get/update settings”, “Sync profile”. Use account services. |
| **account/services** | Supabase auth client, settings API client. No AI. |
| **account/components** | Login/signup/settings forms. No direct auth calls in components; use hooks. |

---

### Shared (cross-cutting)

| Folder | Responsibility |
|--------|----------------|
| **shared/ai** | **Only place that talks to AI models.** Gemini, Groq, consensus synthesis, tab analysis, key resolution (user vs env). All prompts and model calls live here. UI and use-cases never import model SDKs directly; they call shared/ai. Makes AI swappable and testable. |
| **shared/cache** | Reusable cache: key builder (e.g. userId, keyword, country), TTL check, storage interface. Implementations (e.g. research-history via Supabase, trends in-memory) are injectable for tests. No domain types; generic key/value + TTL. |
| **shared/ui** | Design system: Button, Card, Input, Tabs, Badge, Theme. No domain logic, no API or AI. |
| **shared/lib** | Pure utilities: parseJsonResponse, extractJsonFromText, error-handler, etc. No domain, no I/O beyond what’s needed for the util. |

---

## Rules in Practice

| Rule | How it’s reflected |
|------|--------------------|
| **UI vs domain vs services** | Each domain has `components/` (UI), `domain/` (types + pure logic), `use-cases/` (orchestration), `services/` (I/O: HTTP, stream, PDF). App pages only compose these. |
| **AI isolated from UI** | All model calls live in `shared/ai`. Components and pages never import it; use-cases or API handlers call it. |
| **Caching reusable and testable** | `shared/cache` defines key + TTL + storage interface. Research and trends (and future domains) use it with different key shapes and backends; tests inject a fake storage. |
| **PM-friendly naming** | Top-level folders are product concepts: **research**, **insights**, **reports**, **trends**, **account**. No “api”, “lib”, “hooks” at the domain level. |

---

## Optional: API Route Mapping

Keep route URLs for compatibility; implementation delegates into domains:

- `POST /api/research/stream` → research use-case “Start research (stream)” (uses shared/ai, shared/cache, research/services).
- `GET /api/research/history` → reports (or research) use-case “Get history list” or “Get cached by keyword”.
- `POST /api/research/insights/tab` → insights use-case “Run tab analysis” (uses shared/ai, shared/cache).
- `POST /api/research/insights/follow-up` → insights use-case “Answer follow-up” (uses shared/ai).
- `GET/POST /api/reports*`, `GET /api/share/[token]` → reports use-cases.
- `GET /api/trends` → trends use-case.
- `GET/POST /api/settings`, auth routes → account use-cases.

This keeps the refactor incremental: move logic into domains and shared/ai + shared/cache first, then point API handlers at the new use-cases.
