import fs from 'node:fs';
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const injectServiceWorkerBuildId = () => ({
  name: 'inject-service-worker-build-id',
  apply: 'build' as const,
  closeBundle() {
    const serviceWorkerPath = path.resolve(__dirname, 'dist/sw.js');
    if (!fs.existsSync(serviceWorkerPath)) return;

    const buildId = process.env.VITE_BUILD_ID || 'local';
    const assetDirectory = path.resolve(__dirname, 'dist/assets');
    const buildAssets = fs.existsSync(assetDirectory)
      ? fs.readdirSync(assetDirectory).map(file => `assets/${file}`)
      : [];
    const source = fs.readFileSync(serviceWorkerPath, 'utf8');
    const withBuildId = source.replace('__FAKEMS_BUILD_ID__', () => buildId);
    fs.writeFileSync(
      serviceWorkerPath,
      withBuildId.replace('/* __FAKEMS_BUILD_ASSETS__ */ []', JSON.stringify(buildAssets)),
    );
  },
});

export default defineConfig({
  base: '/FakeMS/',
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react(), injectServiceWorkerBuildId()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
