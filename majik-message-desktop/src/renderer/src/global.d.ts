// globals.d.ts

// Global window extensions
export {}

export interface ElectronAPI {
  importAccount: () => Promise<{ base64Content: string; fileName: string } | null>
  importContact: () => Promise<{ base64Content: string; fileName: string } | null>
  onToggleDarkMode: (callback: () => void) => () => void
  onImportAccountTriggered: (callback: () => void) => () => void
  onImportContactTriggered: (callback: () => void) => () => void
  onClearTriggered: (callback: () => void) => () => void
  onCreateAccountTriggered: (callback: () => void) => () => void
  notify: (title: string, body: string) => void
  onAuthChanged: (value: boolean) => void
  onSignInTriggered: (callback: () => void) => () => void
  onSignOutTriggered: (callback: () => void) => () => void
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gtag?: (...args: any[]) => void

    // Crisp chat
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $crisp?: any[]
    CRISP_WEBSITE_ID?: string
    CRISP_READY_TRIGGER?: () => void

    PinUtils?: {
      build: () => void
    }

    electron: ElectronAPI

    // Cloudflare
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    turnstile: any
  }
}

// Audio modules
declare module '*.mp3' {
  const src: string
  export default src
}

declare module '*.wav' {
  const src: string
  export default src
}

// CSS modules (for Swiper, etc.)
declare module '*.css'
declare module '*.scss'
declare module '*.sass'
