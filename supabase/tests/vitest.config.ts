import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['*.test.ts'],
    globalSetup: ['./global-setup.ts'],
    // Las pruebas comparten una sola base de datos local: se ejecutan en serie.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
