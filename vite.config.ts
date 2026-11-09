/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }

const ACCENT = '#284a91'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // ホーム画面に追加して、アプリとして使えるようにする(PWA。仕様書 §3、§9)
    VitePWA({
      // 新しい版を見つけても勝手に再読み込みしない。会計の途中で画面が変わらないように、
      // 「更新する」を押してもらってから入れ替える(src/components/UpdatePrompt.tsx)
      registerType: 'prompt',
      // 登録は UpdatePrompt から行う
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'レジ帳簿',
        short_name: 'レジ帳簿',
        description: '洋服店のレジと帳簿。データはこの端末の中だけに保存します。',
        lang: 'ja',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: ACCENT,
        background_color: '#f2f4f8',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 画面と Excel の部品は最初に端末に保存し、電波がなくても開けるようにする
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // /ledger などをオフラインで開いても、アプリの画面を返す
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // フォントは文字の範囲ごとに 240 個(約 6MB)に分かれているので、最初に全部は保存しない。
        // 表示に使った分だけ保存し、2回目からはネットにつながなくても使う
        runtimeCaching: [
          {
            urlPattern: /\/assets\/.+\.woff2$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 300 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  // 設定画面に表示するアプリのバージョン
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
