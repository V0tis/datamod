'use client'

import { useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
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
    <div className="border-t border-border pt-6">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="mt-2">{body}</div>
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

  return (
    <div className="border-t border-border pt-6">
      <h3 className="text-sm font-semibold text-foreground">비밀번호 변경</h3>
      <p className="mt-1 text-sm text-muted-foreground">보안을 위해 현재 비밀번호 확인 후 새 비밀번호로 갱신합니다.</p>
      <form onSubmit={handleSubmit} className="mt-4 max-w-md space-y-4">
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
              className="bg-muted/50 pr-10 focus:bg-background"
              disabled={submitting}
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
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
          비밀번호 변경
        </Button>
      </form>
    </div>
  )
}
