import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Load environment variables from .env.local
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

// API proxy plugin for development
const apiProxyPlugin = () => ({
  name: 'api-proxy',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url === '/api/events') {
        try {
          // Import and execute the handler function
          const handler = (await import('./api/events.js')).default;
          
          // Create mock req/res objects
          const mockReq = { 
            method: 'GET', 
            url: '/api/events',
            headers: req.headers
          };
          
          const mockRes = {
            statusCode: 200,
            headers: {},
            setHeader(key, value) {
              this.headers[key] = value;
            },
            status(code) {
              this.statusCode = code;
              return this;
            },
            json(data) {
              this.data = data;
              Object.entries(this.headers).forEach(([k, v]) => res.setHeader(k, v));
              res.statusCode = this.statusCode;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
            },
            end() {
              Object.entries(this.headers).forEach(([k, v]) => res.setHeader(k, v));
              res.statusCode = this.statusCode;
              res.end();
            }
          };
          
          await handler(mockReq, mockRes);
          return;
        } catch (error) {
          console.error('API proxy error:', error);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: false,
            error: 'Development API error',
            message: error.message
          }));
          return;
        }
      }
      next();
    });
  }
});

export default defineConfig({
  plugins: [
    react({ fastRefresh: true }),
    apiProxyPlugin()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@services': path.resolve(__dirname, './src/services'),
      '@utils': path.resolve(__dirname, './src/utils')
    }
  },
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'map-vendor': ['leaflet', 'react-leaflet'],
          'supabase-vendor': ['@supabase/supabase-js']
        },
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `assets/images/[name]-[hash][extname]`;
          }
          if (/woff2?|eot|ttf|otf/i.test(ext)) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js'
      }
    },
    chunkSizeWarningLimit: 600,
    assetsInlineLimit: 4096
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'leaflet', 'react-leaflet', '@supabase/supabase-js'],
    exclude: ['cheerio']
  },
  esbuild: {
    drop: ['console', 'debugger']
  }
});
