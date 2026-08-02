import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [{ find: /^(\.{1,2}\/.*)\.js$/, replacement: '$1' }],
  },
  test: {
    environment: 'node',
    globals: false,
    globalSetup: ['./tests/globalSetup.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    include: ['tests/**/*.test.ts'],
  },
});
