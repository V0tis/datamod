# AI Research Streaming Architecture

이 문서는 AI 분석 결과가 프론트엔드로 **프로그레시브하게 스트리밍**되는 구조를 설명합니다.

---

## 1. 백엔드 스트리밍 응답

### NDJSON 스트림 (현재 구현)

`POST /api/research/run` 은 **NDJSON**(newline-delimited JSON) 스트림을 반환합니다.

**헤더:**
```
Content-Type: application/x-ndjson
Cache-Control: no-cache, no-store
Connection: keep-alive
```

**응답 예시 (각 줄이 하나의 이벤트):**
```
{"type":"analysis_started","analysisId":"user123|keyword|KR"}
{"type":"task","task":"signal_layer","status":"running","provider":null}
{"type":"task","task":"signal_layer","status":"completed","data":{"signals":["Google News"],"news_activity":[...]}}
{"type":"news","items":[{"title":"...","url":"...","publisher":"..."}]}
{"type":"task","task":"trend_analysis","status":"running","provider":"gemini"}
{"type":"task","task":"trend_analysis","status":"completed","data":{"trend_summary":"...","market_temperature_score":72,"growth_signals":[...]}}
{"type":"pass1","summary":"시장 성장 추세...","temperature":72,"insights":["팩트1","팩트2"]}
{"type":"task","task":"competition_analysis","status":"completed","data":{"competitive_landscape":[...],"market_structure":"..."}}
{"type":"task","task":"strategy_generation","status":"completed","data":{"opportunities":[],"risks":[],"strategy_summary":"..."}}
{"type":"pass2","structured":{"market_temperature_score":72,"summary_insights":"...","pm_actions":{...}}}
{"type":"creative","groqText":"...","geminiText":"..."}
{"type":"done","reportId":"uuid","sourceLinks":[...]}
```

### SSE 대안 (선택 구현)

EventSource 호환성을 위해 `text/event-stream` 형태로 감싸는 예:

```typescript
// app/api/research/stream-sse/route.ts 예시
const stream = new ReadableStream({
  async start(controller) {
    const encoder = new TextEncoder()
    for await (const event of runResearch(params)) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
    }
    controller.close()
  },
})
return new Response(stream, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  },
})
```

---

## 2. 프론트엔드 스트리밍 소비

### Fetch + ReadableStream (현재 구현)

```typescript
// lib/stores/research-store.ts - startStreamingResearch
const res = await fetch('/api/research/run', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ keyword, country_code, mode }),
  signal, // AbortController.signal
})

const reader = res.body?.getReader()
const decoder = new TextDecoder()
let buffer = ''

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  buffer += decoder.decode(value, { stream: true })
  const lines = buffer.split('\n')
  buffer = lines.pop() ?? ''

  for (const line of lines) {
    if (!line.trim()) continue
    const event = JSON.parse(line)
    // 이벤트별로 상태 업데이트
    if (event.type === 'task') {
      setStepProgress(stepIdx, event.task)
      if (event.status === 'completed') setTaskData(event.task, event.data)
    } else if (event.type === 'pass1') {
      applyStreamingUpdate({ summary: event.summary, temperature: event.temperature, insightLines: event.insights })
    } else if (event.type === 'pass2') {
      applyStreamingUpdate({ ... })
    } else if (event.type === 'done') {
      applyStreamingUpdate({ reportId: event.reportId })
    }
  }
}
```

### 이벤트 타입별 처리

| 이벤트        | UI 업데이트 |
|---------------|-------------|
| `task` (running) | step progress 표시 |
| `task` (completed) | taskData 저장, AnalysisResultSections에 반영 |
| `news`        | newsList 표시 |
| `pass1`       | summary, temperature, insights → result 병합 |
| `pass2`       | structured (insights, actions) → result 병합 |
| `done`        | reportId, loadFromHistory 호출 |
| `error`       | 에러 상태, 종료 |

---

## 3. UI 상태 관리

### Zustand Store 구조

```
streamingState: { status, currentStep, stepId, retryMessage }
taskData: { trend_analysis, competition_analysis, strategy_generation, execution_layer }
result: ResearchResponse | null  ← composeResultFromSections(sections)
summarySection, marketTemperatureSection, insightsSection, recommendedActionsSection
```

### 프로그레시브 렌더링

1. **타임라인**: `StrategyEnginePipeline` - task status (pending/running/completed) 즉시 표시
2. **결과 섹션**: `AnalysisResultSections` - `loading` 중에도 렌더, `taskData`로 부분 데이터 표시
   - `trend_analysis` 완료 → Market Opportunity (keyTrends, growthSignals)
   - `competition_analysis` 완료 → Competitive Landscape
   - `strategy_generation` 완료 → Key Insights, Strategy
   - `pass2` 도착 → actions, full structured data
3. **스켈레톤**: `loading && !data` 일 때 `animate-pulse` placeholder 표시

### 적용 규칙

- **블로킹 제거**: 전체 응답 대기 없이 이벤트 도착 시마다 `set()` 호출
- **부분 결과 병합**: `applyStreamingUpdate`가 sections를 갱신하고 `composeResultFromSections`로 result 재구성
- **taskData 우선**: `AnalysisResultSections`는 `result`와 `taskData`를 병합해 사용 (taskData가 먼저 도착하면 선 표시)

---

## 4. WebSocket 대안 (선택)

고부하/멀티탭 환경에서는 WebSocket을 고려할 수 있습니다.

```typescript
// 예시: WebSocket으로 스트리밍
const ws = new WebSocket(`${wsUrl}/api/research/stream?keyword=${keyword}`)
ws.onmessage = (e) => {
  const event = JSON.parse(e.data)
  applyStreamingUpdate(...)
}
```

백엔드에 WebSocket 서버 추가가 필요합니다. 현재 NDJSON fetch 방식으로도 동일한 프로그레시브 UX를 제공합니다.
