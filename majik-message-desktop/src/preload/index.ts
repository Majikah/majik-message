/* eslint-disable @typescript-eslint/no-explicit-any */
import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

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
