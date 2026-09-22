import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { QUORUM_POTWIERDZEN } from '@/lib/potwierdzeniaObiektu';

// Próg kworum potwierdzeń żyje dziś w DWÓCH miejscach i musi być w nich równy:
//
//   1. `QUORUM_POTWIERDZEN` (lib/potwierdzeniaObiektu.ts) — decyduje, czy
//      człowiek widzi na stronie „potwierdzone przez graczy" i czy fakt trafia
//      do JSON-LD,
//   2. `HAVING count(*) >= N` w migracji 158 — decyduje, czy obiekt awansuje
//      do Tier 1, czyli czy strona w ogóle wchodzi do indeksu Google.
//
// Rozjazd tych dwóch jest cichy i dotkliwy w obie strony. Gdyby próg w SQL był
// NIŻSZY, do indeksu wchodziłyby obiekty, na których człowiek nie widzi żadnego
// potwierdzonego faktu — czyli robot wyprzedzałby treść, dokładnie wbrew
// zasadzie, dla której `QUORUM_POTWIERDZEN` jest współdzielone między
// `AnkietyObiektu.tsx` a `lib/structuredData.ts`. Gdyby był WYŻSZY, strona
// pokazywałaby potwierdzony fakt i zostawała poza indeksem, czyli pętla
// „indeks rośnie, gdy rośnie produkt" po cichu przestałaby działać.
//
// Ta sama klasa ochrony co `typyPowiadomien.test.ts` i `maskiZrzutow.test.ts`:
// stała w SQL-u nie ma odpowiednika w interfejsie, więc jej zmiany nie zobaczy
// ani `tsc`, ani Playwright, ani zrzut ekranu.

const KATALOG_MIGRACJI = path.join(process.cwd(), '..', 'supabase', 'migrations');

function migracjaPromocji(): string {
  const plik = readdirSync(KATALOG_MIGRACJI)
    .find((f) => /^158_.*\.sql$/.test(f));
  if (!plik) throw new Error('Nie znaleziono migracji 158 (promocja po potwierdzeniach)');
  return readFileSync(path.join(KATALOG_MIGRACJI, plik), 'utf8');
}

describe('kworum potwierdzeń: SQL zgodny z interfejsem', () => {
  it('próg w migracji 158 jest równy QUORUM_POTWIERDZEN', () => {
    const sql = migracjaPromocji();
    // `Array.from`, nie spread: `tsconfig` celuje w ES5, więc iterator z
    // `matchAll()` nie rozwija się bez `downlevelIteration` (ta sama pułapka,
    // co opisana przy `rozbicieWgZrodla()` w lib/analytics.ts).
    const progi = Array.from(sql.matchAll(/HAVING\s+count\(\*\)\s*>=\s*(\d+)/gi), (m) => Number(m[1]));

    // Dwa wystąpienia: wyzwalacz i backfill. Oba muszą mówić to samo — backfill
    // z innym progiem wpuściłby do indeksu inny zbiór niż ten, który wyzwalacz
    // wpuszcza na bieżąco, a różnicy nie widać nigdzie poza sitemapem.
    expect(progi.length).toBeGreaterThanOrEqual(2);
    for (const prog of progi) expect(prog).toBe(QUORUM_POTWIERDZEN);
  });

  it('promocja jest jednokierunkowa: migracja nigdy nie degraduje tieru', () => {
    const sql = migracjaPromocji();
    // Awans zawsze do 1. Jakikolwiek zapis ustawiający 2 albo 3 znaczyłby, że
    // wycofany głos potrafi wyrzucić stronę z indeksu — a wejście i wyjście
    // z indeksu Google kosztuje tygodnie w obie strony.
    const przypisania = Array.from(sql.matchAll(/SET\s+seo_tier\s*=\s*(\d+)/gi), (m) => Number(m[1]));
    expect(przypisania.length).toBeGreaterThanOrEqual(2);
    for (const wartosc of przypisania) expect(wartosc).toBe(1);
  });

  it('wyzwalacz łapie też UPDATE, nie tylko INSERT', () => {
    // `zapiszPotwierdzenie()` robi UPSERT (onConflict na field_id,user_id,fakt),
    // więc zmiana zdania przychodzi jako UPDATE i może właśnie nią dopchnąć
    // parę (fakt, wartość) do kworum. Sam INSERT przegapiłby ten przypadek.
    expect(migracjaPromocji()).toMatch(/AFTER\s+INSERT\s+OR\s+UPDATE\s+ON\s+potwierdzenia_obiektu/i);
  });
});
