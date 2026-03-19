import React, { useState, useEffect, type ReactNode } from 'react'
import * as AlertDialog from '@radix-ui/react-alert-dialog'

import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogTitle
} from '@/globals/styled-dialogs'
import DuoButton from '../foundations/DuoButton'

interface ConnectionDetectorProps {
  children: ReactNode
}

const ConnectionDetector: React.FC<ConnectionDetectorProps> = ({ children }) => {
  const [isOffline, setIsOffline] = useState(false)
  const [isSlow, setIsSlow] = useState(false)
  const [open, setOpen] = useState(false)
  const [forceOffline, setForceOffline] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOffline = (): void => {
      if (forceOffline) return
      setIsOffline(true)
      setOpen(true)
    }

    const handleOnline = (): void => {
      if (forceOffline) return
      setIsOffline(false)
      setIsSlow(false)
      setOpen(false)
    }

    const handleConnectionChange = (): void => {
      if (forceOffline) return
      if ('connection' in navigator) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const connection = navigator.connection as any
        if (connection && (connection.downlink < 0.35 || connection.rtt > 2000)) {
          setIsSlow(true)
          setOpen(true)
        } else {
          setIsSlow(false)
          setOpen(false)
        }
      }
    }

    // Add event listeners
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    if ('connection' in navigator) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const connection = navigator.connection as any
      connection.addEventListener('change', handleConnectionChange)
    }

    // Cleanup
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      if ('connection' in navigator) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const connection = navigator.connection as any
        connection.removeEventListener('change', handleConnectionChange)
      }
    }
  }, [forceOffline]) // ← re-run if offline mode flag changes

  const handleRefreshClick = (): void => {
    if (typeof window === 'undefined') return
    if (navigator.onLine) {
      if ('connection' in navigator) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const connection = navigator.connection as any
        if (connection.downlink >= 0.5 && connection.rtt <= 3000) {
          window.location.reload()
        } else {
          setIsSlow(true)
          setOpen(true)
        }
      } else {
        window.location.reload()
      }
    } else {
      setIsOffline(true)
      setOpen(true)
    }
  }

  const handleForceOfflineMode = (): void => {
    setForceOffline(true) // ← stop all future updates
    setIsOffline(true)
    setIsSlow(false)
    setOpen(false)
  }

  return (
    <>
      <AlertDialog.Root open={open} onOpenChange={setOpen}>
        <AlertDialog.Portal>
          <DialogOverlay>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Connection Issue</DialogTitle>
                <DialogDescription>
                  {isOffline
                    ? 'You are currently offline. Please check your internet connection.'
                    : isSlow
                      ? 'Your connection seems really slow. You might experience some delays.'
                      : ''}
                </DialogDescription>
              </DialogHeader>
              <DuoButton
                textButtonA="Use Offline Mode"
                textButtonB="Refresh"
                onClickButtonA={handleForceOfflineMode}
                onClickButtonB={handleRefreshClick}
              />
            </DialogContent>
          </DialogOverlay>
        </AlertDialog.Portal>
      </AlertDialog.Root>
      {children}
    </>
  )
}

export default ConnectionDetector
