'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

export default function AuthCallbackPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-primary" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">이메일 인증 완료</h1>
            <p className="text-muted-foreground">
              이메일 인증이 완료되었습니다. 아래 버튼으로 로그인해주세요.
            </p>
          </div>
          <Button className="rounded-full" size="lg" asChild>
            <Link href="/auth/login">로그인</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
