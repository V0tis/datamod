'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { PageTransition } from '@/components/common/PageTransition'
import { ErrorBoundary } from '@/components/error-boundary'
import { AnalysisJobCenter } from '@/components/research/analysis-job-center'
import { AnalysisJobSync } from '@/components/research/analysis-job-sync'

const isAuthOnlyPath = (path: string) =>
  path === '/login' ||
  path.startsWith('/login/') ||
  path === '/auth/signup' ||
  path.startsWith('/auth/signup/')

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuthPage = isAuthOnlyPath(pathname ?? '')

  if (isAuthPage) {
    return (
      <main className="min-h-screen overflow-auto bg-gradient-to-br from-background via-[#15181c] to-background text-foreground">
        <ErrorBoundary>
          <PageTransition>{children}</PageTransition>
        </ErrorBoundary>
      </main>
    )
  }

  return (
    <>
      <Sidebar />
      <main className="min-h-screen bg-background pl-0 lg:pl-[240px] overflow-auto transition-[padding] transition-colors duration-300">
        <ErrorBoundary>
          <PageTransition>{children}</PageTransition>
        </ErrorBoundary>
      </main>
      <AnalysisJobSync />
      <AnalysisJobCenter />
    </>
  )
}
