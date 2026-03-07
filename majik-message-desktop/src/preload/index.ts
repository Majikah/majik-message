// preload/index.ts from electron

/* eslint-disable @typescript-eslint/no-explicit-any */
import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  NOTIFICATION_RECEIVED,
  NOTIFICATION_SERVICE_ERROR,
  NOTIFICATION_SERVICE_STARTED,
  START_NOTIFICATION_SERVICE,
  TOKEN_UPDATED
} from 'firebase-electron/dist/electron/consts'

// Custom APIs for renderer
const api = {}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('electron', {
      ...electronAPI,
      importAccount: () => ipcRenderer.invoke('import-account'),
      importContact: () => ipcRenderer.invoke('import-contact'),
      unlockIdentity: (majikKeyJson: any, passphrase: string) =>
        ipcRenderer.invoke('unlock-identity', {
          majikKeyJson,
          passphrase
        }),
      // Add listeners for menu events
      onToggleDarkMode: (callback: any) => {
        ipcRenderer.on('trigger-toggle-dark-mode', callback)
        return () => ipcRenderer.removeListener('trigger-toggle-dark-mode', callback)
      },
      onImportAccountTriggered: (callback: any) => {
        ipcRenderer.on('trigger-import-account', callback)
        return () => ipcRenderer.removeListener('trigger-import-account', callback)
      },
      onImportContactTriggered: (callback: any) => {
        ipcRenderer.on('trigger-import-contact', callback)
        return () => ipcRenderer.removeListener('trigger-import-contact', callback)
      },
      onClearTriggered: (callback: any) => {
        ipcRenderer.on('trigger-clear', callback)
        return () => ipcRenderer.removeListener('trigger-clear', callback)
      },
      onCreateAccountTriggered: (callback: any) => {
        ipcRenderer.on('trigger-create-account', callback)
        return () => ipcRenderer.removeListener('trigger-create-account', callback)
      },
      onSignInTriggered: (callback: any) => {
        ipcRenderer.on('trigger-auth-sign-in', callback)
        return () => ipcRenderer.removeListener('trigger-auth-sign-in', callback)
      },
      onSignOutTriggered: (callback: any) => {
        ipcRenderer.on('trigger-auth-sign-out', callback)
        return () => ipcRenderer.removeListener('trigger-auth-sign-out', callback)
      },
      onAuthChanged: (value: boolean) => {
        ipcRenderer.send('auth-state-changed', value)
      },

      startNotificationService: (config: {
        apiKey: string
        appId: string
        projectId: string
        vapidKey?: string
      }) => ipcRenderer.send(START_NOTIFICATION_SERVICE, config), // ← was 'start-notification-service'

      onTokenUpdated: (callback: (event: any, token: string) => void) => {
        ipcRenderer.on(TOKEN_UPDATED, callback) // ← was 'TOKEN_UPDATED' string
        return () => ipcRenderer.removeListener(TOKEN_UPDATED, callback)
      },

      onNotificationReceived: (callback: (event: any, notification: any) => void) => {
        ipcRenderer.on(NOTIFICATION_RECEIVED, callback) // ← was 'NOTIFICATION_RECEIVED' string
        return () => ipcRenderer.removeListener(NOTIFICATION_RECEIVED, callback)
      },

      onNotificationServiceStarted: (callback: (event: any, token: string) => void) => {
        ipcRenderer.on(NOTIFICATION_SERVICE_STARTED, callback)
        return () => ipcRenderer.removeListener(NOTIFICATION_SERVICE_STARTED, callback)
      },

      onNotificationServiceError: (callback: (event: any, error: any) => void) => {
        ipcRenderer.on(NOTIFICATION_SERVICE_ERROR, callback)
        return () => ipcRenderer.removeListener(NOTIFICATION_SERVICE_ERROR, callback)
      },

      sendPushToken: (token: string) => ipcRenderer.send('send-push-token', token),

      onOpenMJKB: (callback: (filePath: string) => void) => {
        const listener = (_: any, path: string): void => callback(path)

        ipcRenderer.on('mjkb-open', listener)

        return () => ipcRenderer.removeListener('mjkb-open', listener)
      },

      notify: (title: string, body: string) =>
        ipcRenderer.send('show-notification', { title, body })
    })
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
