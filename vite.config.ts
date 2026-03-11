import { defineConfig } from 'vite';

export default defineConfig({
  // 指示書1: セキュリティヘッダー設定 (開発/プレビュー用)
  server: {
    headers: {
      'Content-Security-Policy': "frame-ancestors 'self'",
      'X-Frame-Options': 'SAMEORIGIN',
      'X-Content-Type-Options': 'nosniff',
    }
  },
  preview: {
    headers: {
      'Content-Security-Policy': "frame-ancestors 'self'",
      'X-Frame-Options': 'SAMEORIGIN',
    }
  },
  // ビルド設定
  build: {
    outDir: 'dist',
    sourcemap: true,
  }
});
