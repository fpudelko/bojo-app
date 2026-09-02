// Wspólne przygotowanie środowiska testowego dla testów KOMPONENTÓW.
//
// Repo miało dotąd wyłącznie testy logiki (`.ts`), więc `vitest.config.ts` nie
// potrzebowało ani JSX, ani matcherów DOM — mimo że paczki
// (`@testing-library/react`, `@testing-library/jest-dom`, `@vitejs/plugin-react`)
// siedziały w `devDependencies` od dawna. Pierwszy test komponentu
// (`oknoPotwierdzenia.test.tsx`) je uruchamia.
//
// `jest-dom` dokłada matchery czytające się jak zdanie o interfejsie
// (`toBeDisabled`, `toBeInTheDocument`) zamiast grzebania w atrybutach.
import '@testing-library/jest-dom/vitest';
