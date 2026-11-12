import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  // En modo watch (pnpm dev) no se borra dist: si se borrara, la API compilaría
  // en el instante en que aún no existen los .d.ts y se quedaría en error.
  // `pnpm dev` ya compila shared completo antes de arrancar.
  clean: !options.watch,
  target: 'es2023',
}));
