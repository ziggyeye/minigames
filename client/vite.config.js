import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html')
        },
        output: {
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name.split('.');
            const ext = info[info.length - 1];
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
              return `assets/images/[name]-[hash][extname]`;
            }
            if (/mp3|wav|ogg|m4a/i.test(ext)) {
              return `assets/audio/[name]-[hash][extname]`;
            }
            return `assets/[name]-[hash][extname]`;
          }
        }
      },
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: false,
          drop_debugger: true
        }
      }
    },
    server: {
      port: 3000,
      host: true,
      open: true
    },
    preview: {
      port: 3000,
      host: true,
      open: true
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'js')
      }
    },
    optimizeDeps: {
      include: ['phaser']
    },
    define: {
      'process.env.GOOGLE_GENAI_API_KEY': JSON.stringify(env.GOOGLE_GENAI_API_KEY),
      'process.env.DISCORD_CLIENT_ID': JSON.stringify(env.DISCORD_CLIENT_ID),
      'process.env.NODE_ENV': JSON.stringify(env.NODE_ENV || mode)
    }
  };
});
