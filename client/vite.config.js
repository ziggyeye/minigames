import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        circus: resolve(__dirname, 'circus/index.html'),
        'circus-discord': resolve(__dirname, 'circus-discord.html')
      },
      output: {
        // Ensure assets are properly hashed and cached
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.')
          const ext = info[info.length - 1]
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `assets/images/[name]-[hash].[ext]`
          }
          if (/mp3|wav|ogg|m4a/i.test(ext)) {
            return `assets/audio/[name]-[hash].[ext]`
          }
          return `assets/[name]-[hash].[ext]`
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js'
      }
    },
    // Copy assets to build directory
    copyPublicDir: true,
    // Minify for production
    minify: 'terser',
    // Source maps for debugging
    sourcemap: false
  },
  server: {
    port: 3000,
    host: true,
    open: true
  },
  preview: {
    port: 3000,
    host: true
  },
  // Handle static assets
  publicDir: 'public',
  // Optimize dependencies
  optimizeDeps: {
    include: ['phaser']
  }
})
