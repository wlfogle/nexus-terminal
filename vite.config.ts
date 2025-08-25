import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [vue()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  // prevent vite from obscuring rust errors
  clearScreen: false,
  
  // Tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '~': resolve(__dirname, 'src'),
    },
  },

  define: {
    // Enable Vue devtools in development
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_OPTIONS_API__: false,
  },

  build: {
    // Tauri supports es2021
    target: process.env.TAURI_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
    // Don't minify for debug builds
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    // Produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,

    rollupOptions: {
      // Optimize chunks
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          'terminal': ['xterm', 'xterm-addon-fit', 'xterm-addon-web-links', 'xterm-addon-search', 'xterm-addon-canvas'],
          'ai-vendor': ['axios', 'marked', 'highlight.js'],
          'ui-vendor': ['@headlessui/vue', '@heroicons/vue'],
        },
      },
    },

    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
  },

  // CSS configuration
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@import "@/styles/variables.scss";`
      }
    }
  },

  // Development options
  esbuild: {
    // Remove console logs in production
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },

  // Environment variables
  envPrefix: ['VITE_', 'TAURI_'],

  // Optimizations
  optimizeDeps: {
    include: [
      'vue',
      'vue-router', 
      'pinia',
      'xterm',
      'xterm-addon-fit',
      'xterm-addon-web-links',
      'xterm-addon-search',
      'xterm-addon-canvas',
      '@tauri-apps/api/tauri',
      '@tauri-apps/api/event',
      '@tauri-apps/api/window',
    ],
    exclude: ['@tauri-apps/api'],
  },
}))
