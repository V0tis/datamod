/**
 * /results 청크 로딩 시 즉시 표시 — 전환 중 빈 화면 대기 체감을 줄임
 */
export default function ResultsPageLoading() {
  return (
    <div
      className="w-full min-h-[min(100dvh,960px)] bg-white  rin-doc"
      aria-busy
      aria-label="분석 페이지 불러오는 중"
    >
      <div className="mx-auto flex min-h-0 min-w-0 w-full max-w-[min(100%,1920px)] px-3 py-4 sm:px-4 sm:py-5">
        <aside className="hidden w-[220px] shrink-0 lg:block">
          <div className="sticky top-20 space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="h-3 w-24 rounded bg-muted animate-pulse" />
            <div className="h-2 w-full rounded bg-muted/80 animate-pulse" />
            <div className="h-2 w-4/5 rounded bg-muted/80 animate-pulse" />
            <div className="h-2 w-3/4 rounded bg-muted/80 animate-pulse" />
          </div>
        </aside>
        <main className="min-w-0 flex-1 space-y-4 px-1 sm:px-3">
          <div className="space-y-3 border-b border-border/60 pb-4">
            <div className="h-4 w-40 rounded bg-muted animate-pulse" />
            <div className="h-8 max-w-md rounded bg-muted/90 animate-pulse" />
            <div className="h-3 w-64 rounded bg-muted/70 animate-pulse" />
            <div className="flex flex-wrap gap-2 pt-1">
              <div className="h-9 w-24 rounded-md bg-primary/10 animate-pulse" />
              <div className="h-9 w-28 rounded-md bg-muted animate-pulse" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-28 rounded-xl border border-border/50 bg-muted/20 animate-pulse" />
            <div className="h-28 rounded-xl border border-border/50 bg-muted/20 animate-pulse" />
          </div>
          <div className="h-40 rounded-xl border border-dashed border-border/60 bg-muted/10 animate-pulse" />
        </main>
      </div>
    </div>
  )
}
