import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    // `e2e/` należy do Playwrighta. Vitest domyślnie zbiera każdy `*.spec.ts`
    // w projekcie i wywracał się na `test.describe()` z innego frameworka —
    // czerwone CI z powodu, który nie ma nic wspólnego z kodem.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**', 'e2e/**', '.next/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
