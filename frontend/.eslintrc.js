// Konfiguracja ESLint. Plik `.js`, nie `.json`, żeby dało się zapisać POWODY —
// a każda wyłączona reguła bez powodu wraca po miesiącu jako pytanie „czemu to
// jest wyłączone?".
//
// Do niedawna w AGENTS.md stało, że `npm run lint` „nie działa bez interaktywnej
// konfiguracji". Działa — brakowało wyłącznie tego pliku i wtyczki
// `@typescript-eslint`, do której odwoływały się komentarze `eslint-disable`
// rozsiane po repo.
module.exports = {
  root: true,
  extends: ['next/core-web-vitals', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  ignorePatterns: ['.next/', 'node_modules/', 'scripts/', 'public/'],
  rules: {
    // Martwy import to najtańszy sygnał, że coś zostało po przenosinach.
    // Prefiks `_` jako świadome „wiem, że nieużywane".
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],

    // `any` jest w tym repo świadomie używane przy mapowaniu wierszy z Supabase
    // (kształt zwracany przez PostgREST nie ma typów). Ostrzeżenie, nie błąd:
    // ma kłuć w oczy przy nowym kodzie, nie blokować CI za istniejący.
    '@typescript-eslint/no-explicit-any': 'warn',

    // Ostrzeżenie, nie błąd — kilka efektów w repo ma świadomie zawężone
    // zależności (opisane komentarzem w miejscu użycia). Ale to właśnie ta
    // reguła wyłapałaby trzęsącą się mapę: `fields` w tablicy zależności
    // efektu przelatującego mapę.
    'react-hooks/exhaustive-deps': 'warn',

    // Interfejs jest po polsku, a polski cudzysłów „…" to poprawna typografia,
    // nie ucieczka do zrobienia. Reguła zgłaszała 16 miejsc, wszystkie
    // prawidłowe — czyli 16 fałszywych alarmów i zero prawdziwych.
    'react/no-unescaped-entities': 'off',
  },
};
