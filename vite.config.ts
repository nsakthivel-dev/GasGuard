import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Populate process.env for local API handler executions
  Object.assign(process.env, env);

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'masked-icon.svg', 'gas-icon-192.png', 'gas-icon-512.png'],
        manifest: {
          name: 'GasGuard - Smart Gas Leak Safety Monitor',
          short_name: 'GasGuard',
          description: 'Real-time Arduino & ESP32 Gas Leak Detection and Safety Monitoring System',
          theme_color: '#0f172a',
          background_color: '#0b0f19',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/gas-icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: '/gas-icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
        }
      }),
      {
        name: 'local-api-middleware',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url && req.url.startsWith('/api/device/data')) {
              try {
                const mod = await server.ssrLoadModule('./api/device/data.ts');
                return mod.default(req, res);
              } catch (err) {
                console.error('[Vite Local API Middleware Error]:', err);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Local API Execution Error', details: String(err) }));
                return;
              }
            }
            next();
          });
        }
      }
    ],
  };
});
