import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // The source uses explicit .js specifiers on relative imports; map them
    // back to the .ts files so Vite can resolve them.
    alias: [{ find: /^(\.{1,2}\/.*)\.js$/, replacement: '$1' }],
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
