'use client'

import { useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle } from 'lucide-react'
const MIN_LEN = 8

function validatePasswords(current: string, next: string, confirm: string): string | null {
  if (!current.trim()) return '현재 비밀번호를 입력해 주세요.'
  if (!next.trim()) return '새 비밀번호를 입력해 주세요.'
  if (next.length < MIN_LEN) return `새 비밀번호는 ${MIN_LEN}자 이상이어야 합니다.`
  if (next !== confirm) return '새 비밀번호와 확인이 일치하지 않습니다.'
  if (next === current) return '새 비밀번호는 현재 비밀번호와 달라야 합니다.'
  return null
}

/** 설정 > 내 정보 카드 안에 포함. 카드 래퍼는 부모에서 제공합니다. */
export function ChangePasswordForm({ user, userEmail }: { user: User; userEmail: string }) {
  const email = userEmail.trim()
  const hasEmailIdentity = user.identities?.some((i) => i.provider === 'email') ?? false

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)

  const sectionShell = (title: string, body: ReactNode) => (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="mt-3 rounded-xl border border-border/80 bg-muted/30 p-4 sm:p-5">{body}</div>
    </div>
  )

  if (!email) {
    return sectionShell(
      '비밀번호',
      <p className="text-sm text-muted-foreground">
        이메일을 확인할 수 없어 비밀번호를 변경할 수 없습니다. 다시 로그인한 뒤 시도해 주세요.
      </p>
    )
  }

  if (!hasEmailIdentity) {
    return sectionShell(
      '비밀번호',
      <p className="text-sm text-muted-foreground">
        소셜 로그인으로만 연결된 계정은 각 서비스(Google 등)에서 비밀번호를 관리합니다. 이메일·비밀번호로 가입한 계정에서만 여기서 변경할 수 있습니다.
      </p>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = validatePasswords(currentPassword, newPassword, confirmPassword)
    if (err) {
      setFieldError(err)
      return
    }
    setFieldError(null)
    setSubmitting(true)
    try {
      const supabase = createClient()
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      })
      if (signErr) {
        setFieldError('현재 비밀번호가 올바르지 않습니다.')
        return
      }
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword })
      if (updateErr) {
        const msg = updateErr.message?.includes('Password')
          ? '비밀번호 정책을 만족하지 않습니다. 더 길고 복잡한 비밀번호를 사용해 보세요.'
          : updateErr.message || '비밀번호 변경에 실패했습니다.'
        setFieldError(msg)
        return
      }
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast.success('비밀번호가 변경되었습니다.')
    } catch {
      setFieldError('요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  const confirmTouched = confirmPassword.length > 0
  const bothNewFilled = newPassword.length > 0 && confirmPassword.length > 0
  const passwordsMatch = newPassword === confirmPassword

  return (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-foreground">비밀번호 변경</h3>
      <div className="mt-3 rounded-xl border border-border/80 bg-muted/30 p-4 sm:p-5 max-w-lg">
        <p className="text-sm text-muted-foreground">보안을 위해 현재 비밀번호 확인 후 새 비밀번호로 갱신합니다.</p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {fieldError && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {fieldError}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="current-password">현재 비밀번호</Label>
          <div className="relative">
            <Input
              id="current-password"
              type={showCurrent ? 'text' : 'password'}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => { setCurrentPassword(e.target.value); setFieldError(null) }}
              className="bg-muted/50 pr-10 focus:bg-background"
              disabled={submitting}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              onClick={() => setShowCurrent((v) => !v)}
              aria-label={showCurrent ? '비밀번호 숨기기' : '비밀번호 보기'}
            >
              {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password">새 비밀번호</Label>
          <div className="relative">
            <Input
              id="new-password"
              type={showNew ? 'text' : 'password'}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setFieldError(null) }}
              className="bg-muted/50 pr-10 focus:bg-background"
              disabled={submitting}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              onClick={() => setShowNew((v) => !v)}
              aria-label={showNew ? '비밀번호 숨기기' : '비밀번호 보기'}
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">{MIN_LEN}자 이상, 현재 비밀번호와 달라야 합니다.</p>
          {newPassword.length > 0 && newPassword.length < MIN_LEN && (
            <p className="text-xs text-amber-600  flex items-center gap-1">
              <XCircle className="h-3 w-3 shrink-0" aria-hidden />
              {MIN_LEN}자 이상 입력해 주세요.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">새 비밀번호 확인</Label>
          <div className="relative">
            <Input
              id="confirm-password"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setFieldError(null) }}
              className={cn(
                'bg-muted/50 pr-10 focus:bg-background',
                confirmTouched && bothNewFilled && !passwordsMatch && 'border-destructive/60 focus-visible:ring-destructive/30',
                confirmTouched && bothNewFilled && passwordsMatch && 'border-emerald-600/50 focus-visible:ring-emerald-500/30'
              )}
              disabled={submitting}
              aria-invalid={confirmTouched && bothNewFilled ? !passwordsMatch : undefined}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? '비밀번호 숨기기' : '비밀번호 보기'}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {confirmTouched && (
            <div
              role="status"
              className={cn(
                'text-xs flex items-center gap-1.5',
                !bothNewFilled && 'text-muted-foreground',
                bothNewFilled && passwordsMatch && 'text-emerald-600 ',
                bothNewFilled && !passwordsMatch && 'text-destructive'
              )}
            >
              {!bothNewFilled && <span>새 비밀번호를 위와 동일하게 다시 입력해 주세요.</span>}
              {bothNewFilled && passwordsMatch && (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  새 비밀번호가 일치합니다.
                </>
              )}
              {bothNewFilled && !passwordsMatch && (
                <>
                  <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  새 비밀번호가 일치하지 않습니다.
                </>
              )}
            </div>
          )}
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
          비밀번호 변경
        </Button>
      </form>
      </div>
    </div>
  )
}
