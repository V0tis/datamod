'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Mail, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { RinLogo } from '@/components/rin-logo'
import { DatamodWordmark } from '@/components/datamod-wordmark'

export default function VerifyPage() {
  return (
    <main className="min-h-screen flex flex-col bg-background">
      <div className="p-6">
        <Link href="/auth/login">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            로그인
          </Button>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-3">
            <div className="flex justify-center items-center gap-2">
              <RinLogo className="h-8 w-8 shrink-0 text-foreground" />
              <DatamodWordmark className="text-3xl sm:text-4xl" textClassName="text-foreground text-3xl sm:text-4xl" />
            </div>
            <h1 className="sr-only">Datamod</h1>
          </div>

          <div className="bg-card rounded-3xl shadow-lg border border-border p-8 space-y-6">
            <div className="text-center space-y-3">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="w-8 h-8 text-primary" />
                </div>
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-foreground">이메일 인증</h2>
                <p className="text-sm text-muted-foreground">
                  가입한 이메일 주소로 <strong>확인 링크</strong>가 발송되었습니다.
                  <br />
                  메일함에서 링크를 클릭해 인증을 완료한 뒤, 아래에서 로그인해주세요.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-muted-foreground text-center">
                메일이 오지 않았다면 스팸함을 확인해보세요.
              </p>
              <Button
                className="w-full h-12 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-base shadow-md gap-2"
                asChild
              >
                <Link href="/auth/login">
                  로그인 하러 가기
                  <ArrowRight className="w-4 h-4 inline" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
