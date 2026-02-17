'use client'

import React from 'react'
import { AlertCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  showDetails: boolean
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, showDetails: false }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Dev] ErrorBoundary caught:', error, errorInfo)
    }
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, showDetails: false })
  }

  handleReload = () => {
    window.location.reload()
  }

  toggleDetails = () => {
    this.setState((s) => ({ showDetails: !s.showDetails }))
  }

  render() {
    if (this.state.hasError) {
      const { error, showDetails } = this.state
      const message = error?.message
      const stack = error?.stack

      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 bg-background">
          <div className="rounded-2xl border border-border bg-card shadow-lg p-8 max-w-md w-full text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-warning/10 text-warning mb-6">
              <AlertCircle className="w-10 h-10" aria-hidden />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-2">
              오류가 발생했습니다
            </h1>
            <p className="text-muted-foreground text-sm mb-6">
              일시적인 오류가 발생했습니다. 아래 버튼으로 다시 시도하거나 새로고침해 주세요.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
              <Button onClick={this.handleRetry} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                다시 시도
              </Button>
              <Button variant="outline" onClick={this.handleReload} className="gap-2">
                새로고침
              </Button>
            </div>
            {(message || (process.env.NODE_ENV === 'development' && stack)) && (
              <div className="text-left border-t border-border dark:border-[#2d2f34] pt-4 mt-4">
                <button
                  type="button"
                  onClick={this.toggleDetails}
                  className="text-xs text-muted-foreground dark:text-slate-400 hover:text-foreground dark:hover:text-slate-200 flex items-center gap-1"
                >
                  {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  오류 내용 보기
                </button>
                {showDetails && (
                  <pre className="mt-2 p-3 rounded-lg bg-muted/50 dark:bg-[#1a1c20] text-muted-foreground dark:text-slate-400 text-xs overflow-auto max-h-40 whitespace-pre-wrap break-words">
                    {message}
                    {process.env.NODE_ENV === 'development' && stack && `\n\n${stack}`}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
