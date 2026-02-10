'use client'

import { Toaster } from 'sonner'
import { ErrorDetailModal } from '@/components/error-detail-modal'

export function ErrorToastProvider() {
  return (
    <>
      <Toaster
        position="bottom-right"
        closeButton
        richColors
        toastOptions={{
          className: 'shadow-lg rounded-xl border',
        }}
      />
      <ErrorDetailModal />
    </>
  )
}
