import path, { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production'

  return {
    main: {},
    preload: {},
    renderer: {
      server: {
        fs: {
          // When you set `allow` explicitly it REPLACES Vite's defaults,
          // so you must include the project root and source dir yourself.
          //
          // We also allow the SDK sibling package (../majik-message-sdk)
          // because the dev alias points @majikah/majik-message there, and
          // its node_modules may hold the zstd-wasm package if it isn't
          // hoisted to the workspace root.
          allow: [
            path.resolve(__dirname), // app root (replaces Vite default)
            path.resolve(__dirname, 'src'), // renderer source
            path.resolve(__dirname, 'node_modules'), // app-level node_modules
            path.resolve(__dirname, '../majik-message-sdk'), // SDK source (dev alias target)
            path.resolve(__dirname, '../majik-message-sdk/node_modules') // SDK node_modules
          ]
        }
      },

      optimizeDeps: {
        exclude: ['@majikah/majik-message', '@bokuweb/zstd-wasm'] // Force Vite to not pre-bundle it
      },
      esbuildOptions: {
        target: 'es2020'
      },
      assetsInclude: ['**/*.wasm'],
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
