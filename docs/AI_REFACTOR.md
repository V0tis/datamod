# AI Layer Refactor

## Constraints Applied

1. **No React component calls an AI model**  
   All AI usage is in API routes (and the unified service they call). Components only call `fetch('/api/...')` or use stores that trigger those APIs.

2. **Unified AI service layer**  
   Single entry: `@/lib/ai`. All operations use clear input/output schemas (`lib/ai/schemas.ts`).

3. **Single responsibility per function**  
   - `generateText` – prompt → text  
   - `generateResearchWithGrounding` – prompt → text + source links  
   - `completeChat` – messages → text (or quota error)  
   - `runTabAnalysis` – tab prompts → Groq + Gemini texts and quota flags  
   - `synthesizeConsensus` – two analyses → one Consensus  
   - `normalizeConsensus` – raw payload → Consensus (pure; no AI)

4. **Swappable providers**  
   Gemini and Groq are behind interfaces in `lib/ai/providers/types.ts`. Default implementations live in `lib/ai/providers/gemini-provider.ts` and `lib/ai/providers/groq-provider.ts`. For tests, call `setAiProviders(mockSet)` so UI and routes never need to change when swapping providers.

## Layout

- **`lib/ai/schemas.ts`** – Input/output types for every AI operation (no I/O).
- **`lib/ai/providers/types.ts`** – Provider interfaces (`ITextGenerationProvider`, etc.).
- **`lib/ai/providers/gemini-provider.ts`** – Gemini implementation (delegates to `services/ai/geminiClient`).
- **`lib/ai/providers/groq-provider.ts`** – Groq implementation (delegates to `services/ai/groqClient`).
- **`lib/ai/unified-ai-service.ts`** – Public API: uses default providers, exposes `generateText`, `generateResearchWithGrounding`, `completeChat`, `runTabAnalysis`, `synthesizeConsensus`, and pure helpers.
- **`lib/ai/index.ts`** – Re-exports for `import { ... } from '@/lib/ai'`.
- **`services/aiClient.ts`** – Re-exports from `@/lib/ai` (deprecated; use `@/lib/ai`).

## API Routes Using AI

| Route | Uses |
|-------|------|
| `POST /api/research/stream` | `generateText` |
| `POST /api/research` | `generateResearchWithGrounding` |
| `POST /api/research/insights/tab` | `runTabAnalysis`, `synthesizeConsensus`, `normalizeConsensus` |
| `POST /api/research/insights/follow-up` | `generateText` |

All of these import from `@/lib/ai` only.

## Major Changes (Incremental)

1. **Schemas and provider types**  
   Added `lib/ai/schemas.ts` and `lib/ai/providers/types.ts` so every AI operation has a defined input and output. No ad-hoc shapes in routes.

2. **Gemini and Groq providers**  
   Implemented `lib/ai/providers/gemini-provider.ts` and `lib/ai/providers/groq-provider.ts` that implement the interfaces and delegate to existing `services/ai/geminiClient` and `services/ai/groqClient`. No behavior change; same calls, same retries.

3. **Unified service**  
   Added `lib/ai/unified-ai-service.ts`: holds default `ProviderSet`, exposes `generateText`, `generateResearchWithGrounding`, `completeChat`, `runTabAnalysis`, `synthesizeConsensus`. `runTabAnalysis` and `synthesizeConsensus` use the providers instead of calling Gemini/Groq directly. Consensus prompt/parse helpers remain in `services/ai/consensusService.ts` and are used by the unified service.

4. **API routes wired to `@/lib/ai`**  
   - `follow-up/route.ts`: `generateText` from `@/lib/ai`.  
   - `tab/route.ts`: `runTabAnalysis`, `synthesizeConsensus`, `normalizeConsensus`, `FALLBACK_CONSENSUS` from `@/lib/ai`; `synthesizeConsensus` now called with a single input object `{ apiKey, geminiAnalysis, groqAnalysis }`.  
   - `stream/route.ts`: `generateText` from `@/lib/ai`.  
   - `research/route.ts`: `generateResearchWithGrounding` from `@/lib/ai` with a single input object.

5. **Backward compatibility**  
   `services/aiClient.ts` re-exports from `@/lib/ai` and is marked deprecated so existing or accidental imports still work.

6. **Verification**  
   No React component (`.tsx`) imports `@/lib/ai` or `@/services/ai`; only API routes and the AI layer do.
