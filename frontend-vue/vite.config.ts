import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    server: {
      port: 3001,
      host: true,
      watch: {
        usePolling: true
      },
      // Proxy configuration for development
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://localhost:4000',
          changeOrigin: true,
          secure: false,
          ws: false, // Disable WebSocket proxying for API routes
        },
        '/ws': {
          target: env.VITE_WS_BASE_URL || 'ws://localhost:4000',
          changeOrigin: true,
          secure: false,
          ws: true, // Enable WebSocket proxying
        }
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: true
    },
    define: {
      __VUE_OPTIONS_API__: true,
      __VUE_PROD_DEVTOOLS__: false
    },
    // Environment variables configuration
    envPrefix: 'VITE_',
    envDir: './',
  }
})
