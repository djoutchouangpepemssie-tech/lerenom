import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['app/**/*.test.ts', 'lib/**/*.test.ts'],
    // Les tests touchent la même base : on les sérialise plutôt que de les voir se marcher dessus.
    fileParallelism: false,
  },
});
