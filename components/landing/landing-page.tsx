'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { BarChart3, Users, ClipboardList, ArrowRight, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-16 pb-20 sm:px-6 lg:px-8">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,var(--primary)/12%,transparent)]" />
        <motion.div
          className="mx-auto max-w-3xl text-center"
          initial="initial"
          animate="animate"
          variants={{
            animate: { transition: { staggerChildren: 0.08 } },
          }}
        >
          <motion.p
            variants={fadeIn}
            className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary"
          >
            <Sparkles className="h-4 w-4" />
            Product Managers
          </motion.p>
          <motion.h1
            variants={fadeIn}
            className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl"
          >
            AI Product Strategy Copilot for PMs
          </motion.h1>
          <motion.p
            variants={fadeIn}
            className="mt-6 text-lg text-muted-foreground sm:text-xl max-w-2xl mx-auto"
          >
            시장 키워드만 입력하면 웹·뉴스 기반 트렌드 분석, 경쟁 구도, 전략 요약, PM 액션 플랜까지 한 번에 생성합니다.
          </motion.p>
          <motion.div variants={fadeIn} className="mt-10">
            <Button asChild size="lg" className="h-12 px-8 text-base font-semibold">
              <Link href="/login?callbackUrl=/">Start Analysis</Link>
            </Button>
          </motion.div>
        </motion.div>
      </section>

      {/* How It Works */}
      <section className="border-t border-border bg-muted/20 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold text-foreground sm:text-3xl">
            How It Works
          </h2>
          <p className="mt-2 text-center text-base text-muted-foreground">
            세 단계로 전략 리포트를 받아보세요.
          </p>
          <div className="mt-14 grid gap-10 sm:grid-cols-3">
            {[
              {
                step: 1,
                title: 'Input market',
                description: '분석할 시장·키워드를 입력하고 국가를 선택합니다.',
                icon: BarChart3,
              },
              {
                step: 2,
                title: 'AI analysis',
                description: '웹 검색·뉴스 수집 후 트렌드·경쟁·인사이트·전략을 자동 분석합니다.',
                icon: Sparkles,
              },
              {
                step: 3,
                title: 'Strategy report',
                description: '시장 개요, 경쟁사, PM 액션 플랜이 담긴 리포트를 확인합니다.',
                icon: ClipboardList,
              },
            ].map(({ step, title, description, icon: Icon }) => (
              <div
                key={step}
                className="relative flex flex-col items-center text-center"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-primary/40 bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <span className="mt-4 text-sm font-semibold text-primary">
                  Step {step}
                </span>
                <h3 className="mt-1 text-lg font-semibold text-foreground">
                  {title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold text-foreground sm:text-3xl">
            Features
          </h2>
          <p className="mt-2 text-center text-base text-muted-foreground">
            PM이 필요한 핵심 결과만 구조화해서 제공합니다.
          </p>
          <div className="mt-14 grid gap-8 sm:grid-cols-3">
            {[
              {
                title: 'Market Analysis',
                description: '시장 규모·성장성·트렌드 요약과 뉴스 기반 시장 온도까지 한눈에 파악합니다.',
                icon: BarChart3,
              },
              {
                title: 'Competitor Insight',
                description: '경쟁사 포지셔닝, 강점·약점, 시장 구조를 정리해 경쟁 환경을 이해합니다.',
                icon: Users,
              },
              {
                title: 'PM Action Plan',
                description: '우선순위별 제품 액션, 기능 아이디어, GTM 단계를 실행 가능한 플랜으로 제시합니다.',
                icon: ClipboardList,
              },
            ].map(({ title, description, icon: Icon }) => (
              <div
                key={title}
                className="rounded-xl border border-border bg-card p-6 shadow-sm transition-colors hover:border-primary/30 hover:bg-card"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                  {title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-muted/20 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
            지금 바로 시장 분석을 시작하세요
          </h2>
          <p className="mt-3 text-muted-foreground">
            로그인 후 키워드만 입력하면 AI가 전략 리포트를 만들어 드립니다.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="h-12 px-8 text-base font-semibold">
              <Link href="/login?callbackUrl=/">
                Start Analysis
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-8">
              <Link href="/auth/signup">회원가입</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
