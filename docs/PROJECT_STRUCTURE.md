# Project Structure

프로젝트 폴더 구조 및 아키텍처 가이드.

## Directory Overview

```
datamod/
├── app/                    # Next.js App Router (pages, layouts, API routes)
├── components/             # React UI components
├── hooks/                  # React hooks (useCurrentTask, useResultPageState, etc.)
├── lib/                    # Core logic, AI, stores, parsers
├── types/                  # Type exports (re-exports from lib)
├── utils/                  # Utility exports (re-exports from lib)
├── api/                    # API helpers (re-exports from lib/api)
├── services/               # External service clients (AI, trends, etc.)
└── docs/                   # Documentation
```

## Layer Responsibilities

### `/app`
- **Routes only** – pages and API handlers
- Thin layer: validate → delegate to lib/services
- No business logic in route files

### `/components`
- **UI only** – presentation components
- Receive data via props/hooks
- Subfolders: `ui/` (design system), `research/`, `common/`, `insights/`, `landing/`, `pdf/`

### `/hooks`
- React hooks for shared state and side effects
- `useCurrentTask`, `useResultPageState`, `useAnalysisTasksPoll`
- Import from `@/hooks` or `@/hooks/use-current-task`

### `/lib`
- **Core domain logic**
- `ai/` – AI/LLM orchestration (runResearch, providers, prompts)
- `stores/` – Zustand stores (research-store, error-detail-store)
- `supabase/` – DB client (client, server, admin)
- `api/` – rate-limit, require-auth, route-timeouts
- Parsers, caches, config (research-parser, trends-cache, gemini-config)

### `/types`
- Type definitions – re-exports from lib
- Use: `import type { AnalysisMode, TrendItem } from '@/types'`

### `/utils`
- Utility functions – re-exports from lib
- Use: `import { cn, formatTimeAgo } from '@/utils'`

### `/api`
- API helper exports – re-exports from lib/api
- Use: `import { requireAuth } from '@/api'`

### `/services`
- External service clients
- `ai/` – Gemini client, tab analysis

## Import Conventions

| Category   | Preferred Import       | Fallback (legacy)     |
|------------|------------------------|------------------------|
| Hooks      | `@/hooks`              | `@/lib/hooks`         |
| Utils      | `@/utils`              | `@/lib/utils`         |
| Types      | `@/types`              | `@/lib/types`, etc.   |
| API helpers| `@/api`                | `@/lib/api/*`         |
| Stores     | `@/lib/stores/*`       | —                     |
| AI         | `@/lib/ai/*`           | —                     |
| Components | `@/components/*`       | —                     |

## Migration Notes

- `lib/hooks/` – Deprecated. Use `@/hooks` instead. `lib/hooks/index.ts` re-exports for backward compatibility.
- New code should use `@/hooks`, `@/utils`, `@/types`, `@/api` for cleaner imports.
