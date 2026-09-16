import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

// Żadne zapytanie nie może wbudowywać `profiles(...)` przez PostgREST.
//
// SKĄD TEN PLIK. `turnieje.ts` pobierało osoby z uprawnieniami zapytaniem
// `.select('*, profiles(display_name, avatar_url)')`. Panel turnieju wywracał
// się w przeglądarce na `PGRST200`: „Could not find a relationship between
// 'turniej_osoby' and 'profiles' in the schema cache". Powód jest w schemacie,
// nie w kodzie: KAŻDA kolumna z użytkownikiem w tym repo wskazuje na
// `auth.users`, żadna tabela nie ma klucza obcego do `profiles` — więc
// PostgREST nie ma po czym złożyć joinu.
//
// Nic w repo tego nie łapało. Treść `select()` to zwykły łańcuch: `tsc` jej
// nie czyta, Vitest nie ma bazy, a Playwright chodzi tylko po tych ekranach,
// które ktoś opisał scenariuszem. Błąd wychodzi wyłącznie na żywej bazie,
// czyli u użytkownika.
//
// Wzorzec zastępczy to dwa zapytania i sklejenie po `id` w JS — patrz
// `getEventInvitesWithNames()` (`lib/playerInvites.ts`) i `getEventDelegates()`
// (`lib/eventDelegates.ts`). `profiles` jest publicznie czytelne (migracja
// `005`), więc drugie zapytanie nie wymaga dodatkowych uprawnień.

const KATALOG = process.cwd();
const KATALOG_SRC = path.join(KATALOG, 'src');
const KATALOG_MIGRACJI = path.join(KATALOG, '..', 'supabase', 'migrations');

/** Wszystkie pliki źródłowe aplikacji (bez testów) jako pary ścieżka → treść. */
function zrodlaAplikacji(): Array<[string, string]> {
  const pliki: Array<[string, string]> = [];
  const obejdz = (katalog: string) => {
    for (const wpis of readdirSync(katalog, { withFileTypes: true })) {
      const sciezka = path.join(katalog, wpis.name);
      if (wpis.isDirectory()) {
        if (wpis.name === '__tests__' || wpis.name === 'node_modules') continue;
        obejdz(sciezka);
        continue;
      }
      if (/\.(tsx?|jsx?)$/.test(wpis.name)) pliki.push([sciezka, readFileSync(sciezka, 'utf8')]);
    }
  };
  obejdz(KATALOG_SRC);
  return pliki;
}

/**
 * Zagnieżdżenia `profiles(...)` wyłącznie WEWNĄTRZ łańcucha — komentarz
 * wymieniający `profiles` (choćby ten wyżej) nie jest zapytaniem.
 */
function wbudowaneProfile(kod: string): string[] {
  const znalezione: string[] = [];
  for (const trafienie of kod.match(/(['"`])[^'"`\n]*\bprofiles\s*\([^'"`\n]*\1/g) ?? []) {
    znalezione.push(trafienie);
  }
  return znalezione;
}

describe('join do profiles', () => {
  const zrodla = zrodlaAplikacji();

  it('pliki źródłowe w ogóle się znajdują — inaczej ten test przechodzi na pusto', () => {
    expect(zrodla.length).toBeGreaterThan(0);
  });

  it('żadne zapytanie nie wbudowuje `profiles(...)`', () => {
    const winne: string[] = [];
    for (const [sciezka, kod] of zrodla) {
      for (const fragment of wbudowaneProfile(kod)) {
        winne.push(`${path.relative(KATALOG, sciezka)}: ${fragment}`);
      }
    }
    expect(
      winne,
      'PostgREST nie zbuduje joinu do `profiles` — żadna tabela nie ma do niej klucza ' +
        'obcego (użytkownik wskazuje zawsze na `auth.users`), więc takie zapytanie ' +
        'wraca z PGRST200 dopiero na żywej bazie. Pobierz profile osobnym zapytaniem ' +
        'i sklej po `id` w JS, jak `getEventDelegates()` w `lib/eventDelegates.ts`.',
    ).toEqual([]);
  });

  it('nadal żadna migracja nie zakłada klucza obcego do `profiles`', () => {
    // Asercja na POWÓD, nie na objaw. Gdyby ktoś kiedyś dołożył
    // `REFERENCES profiles`, zagnieżdżenie stałoby się poprawne dla tej jednej
    // tabeli — i wtedy zmienia się ten test, a nie cofa zapytanie.
    const zKluczem = readdirSync(KATALOG_MIGRACJI)
      .filter((n) => n.endsWith('.sql'))
      .filter((n) => /REFERENCES\s+(public\.)?profiles\b/i.test(
        readFileSync(path.join(KATALOG_MIGRACJI, n), 'utf8'),
      ));
    expect(zKluczem).toEqual([]);
  });
});
