'use client'

import React from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 bg-[#F8F9FA]">
          <div className="rounded-2xl border border-border bg-white shadow-lg p-8 max-w-md w-full text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-100 text-amber-600 mb-6">
              <AlertCircle className="w-10 h-10" aria-hidden />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-2">
              앗, 뭔가 흐트러졌어요!
            </h1>
            <p className="text-muted-foreground text-sm mb-6">
              린이 당황한 사이에 오류가 발생했어요. 아래 버튼으로 다시 시도해 주세요.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={this.handleRetry} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                다시 시도
              </Button>
              <Button variant="outline" onClick={this.handleReload} className="gap-2">
                새로고침
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
