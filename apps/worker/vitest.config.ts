import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    // Les tests d'intégration touchent une vraie base : ils doivent s'exécuter en série.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
