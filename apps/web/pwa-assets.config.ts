import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

/**
 * Genera favicon, íconos PWA (64/192/512, maskable) y apple-touch-icon desde public/logo.svg.
 * Se ejecuta a mano (`pnpm pwa:icons`) y los PNG se versionan: el build no depende de sharp.
 */
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#171717' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#171717' } },
  },
  images: ['public/logo.svg'],
});
