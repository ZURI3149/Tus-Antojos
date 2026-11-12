import { defineConfig } from 'vitest/config';

// Vite 8 (oxc) ya emite los metadatos de decoradores que usa la inyección de
// dependencias de NestJS; test/dependency-injection.e2e-spec.ts lo vigila.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.e2e-spec.ts'],
  },
});
