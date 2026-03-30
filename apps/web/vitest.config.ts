import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/__tests__/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@repo/shared': '../../packages/shared/src/index.ts',
      '@/*': './src/*',
    },
  },
})
