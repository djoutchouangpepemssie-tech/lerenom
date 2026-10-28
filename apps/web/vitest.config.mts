import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Le même alias que `tsconfig.json` : les tests importent les modules de l'application
  // exactement comme l'application les importe.
  resolve: { alias: { '@': path.resolve(import.meta.dirname, '.') } },
  test: {
    globals: true,
    environment: 'node',
    include: ['app/**/*.test.ts', 'lib/**/*.test.ts'],
    // Les tests touchent la même base : on les sérialise plutôt que de les voir se marcher dessus.
    fileParallelism: false,
  },
});
