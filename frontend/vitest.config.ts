import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // Wtyczka React jest tu wyłącznie po to, żeby dało się pisać testy
  // KOMPONENTÓW (JSX w plikach `.tsx`). Bez niej Vitest wywraca się na
  // pierwszym `<Komponent />` błędem parsera „Unexpected JSX expression".
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
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
