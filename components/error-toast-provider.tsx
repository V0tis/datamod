'use client'

import { Toaster } from 'sonner'
import { ErrorDetailModal } from '@/components/error-detail-modal'

export function ErrorToastProvider() {
  return (
    <>
      <Toaster
        theme="light"
        position="bottom-right"
        closeButton
        richColors
        toastOptions={{
          className: 'shadow-lg rounded-xl border border-border bg-card text-foreground',
        }}
      />
      <ErrorDetailModal />
    </>
  )
}
