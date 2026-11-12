import { defineConfig } from 'vitest/config';

// Pruebas de la API contra el Supabase local real (`pnpm db:start`). Corren con `pnpm test:db`.
export default defineConfig({
  test: {
    include: ['test/integration/**/*.int-spec.ts'],
    globalSetup: ['./test/integration/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
