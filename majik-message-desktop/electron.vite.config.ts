import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production'

  return {
    main: {},
    preload: {},
    renderer: {
      optimizeDeps: {
        exclude: ['@majikah/majik-message'] // Force Vite to not pre-bundle it
      },
      publicDir: resolve(__dirname, 'src/renderer/public'),
      build: {
        outDir: resolve(__dirname, 'out/renderer'),
        emptyOutDir: true,
        rollupOptions: {
          input: resolve(__dirname, 'src/renderer/index.html')
        }
      },
      base: './',
      plugins: [react(), tailwindcss()],
      resolve: {
        alias: {
          '@renderer': resolve('src/renderer/src'),
          '@majikah/majik-message': isProd
            ? '@majikah/majik-message'
            : resolve(__dirname, '../majik-message-sdk/src'),
          '@': resolve(__dirname, 'src/renderer/src')
        }
      }
    }
  }
})
