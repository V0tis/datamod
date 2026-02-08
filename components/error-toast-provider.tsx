'use client'

import { Toaster } from 'sonner'
import { ErrorDetailModal } from '@/components/error-detail-modal'

export function ErrorToastProvider() {
  return (
    <>
      <Toaster
        position="bottom-right"
        closeButton
        toastOptions={{
          className: 'shadow-lg border border-border rounded-xl bg-white text-foreground',
        }}
      />
      <ErrorDetailModal />
    </>
  )
}
