import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const VENDOR_CHUNKS = [
  {
    name: 'firebase-runtime',
    packages: ['firebase', '@firebase/firestore', '@firebase/webchannel-wrapper', '@firebase/auth', '@firebase/app', '@firebase/component', '@firebase/logger', '@firebase/util', 're2js', 'idb'],
  },
  {
    name: 'react-runtime',
    packages: ['react', 'react-dom', 'react-router', 'react-router-dom', 'scheduler', 'use-sync-external-store'],
  },
  {
    name: 'ui-runtime',
    packages: ['@base-ui/react', '@base-ui/utils', '@floating-ui/core', '@floating-ui/dom', '@floating-ui/react-dom', '@floating-ui/utils', 'sonner', 'next-themes', 'tailwind-merge', 'class-variance-authority', 'clsx'],
  },
] as const;

export function getVendorChunk(moduleId: string): string | undefined {
  const normalizedId = moduleId.replace(/\\/g, '/');
  if (!normalizedId.includes('/node_modules/')) return undefined;

  return VENDOR_CHUNKS.find(group =>
    group.packages.some(packageName => normalizedId.includes(`/node_modules/${packageName}/`))
  )?.name;
}

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'icon-192x192.png', 'icon-512x512.png'],
        manifest: {
          name: 'Fiducia Assistente de Finanças pessoais',
          short_name: 'Fiducia',
          description: 'Seu assistente financeiro pessoal inteligente, descomplicado e totalmente sob o seu controle.',
          theme_color: '#ffffff',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          id: '/',
          share_target: {
            action: '/importar/compartilhar',
            method: 'GET',
            params: {
              title: 'title',
              text: 'text',
              url: 'url',
            },
          },
          icons: [
            {
              src: 'icon.svg',
              sizes: '192x192 512x512',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            },
            {
              src: 'icon-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 4000000 // 4MB
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: getVendorChunk,
        },
      },
    },
  };
});
