#!/usr/bin/env node
// Dzieli migracje na te, które wolno puścić automatem, i te, które wymagają
// świadomego kliknięcia.
//
// ─────────────────────────────────────────────────────────────────────────────
// SKĄD SIĘ BIERZE PODZIAŁ
//
// Nie z deklaracji autora. Migrację, która kasuje kolumnę, pisze się tak samo
// beztrosko jak każdą inną — a autor, który zapomni ją oznaczyć, jest dokładnie
// tym, którego migracja jest groźna. Dlatego domyślnie decyduje SKANER, a ręczny
// znacznik potrafi wyłącznie ZAOSTRZYĆ wynik, nigdy go poluzować.
//
// `-- RECZNA: powód` w pierwszych liniach pliku robi z bezpiecznej migracji
// ręczną (np. backfill, który blokuje tabelę na minuty). Nie istnieje znacznik
// odwrotny i nie powstanie: byłby furtką, przez którą wyjdzie każdy DROP.
//
// ─────────────────────────────────────────────────────────────────────────────
// CO JEST GROŹNE, A CO TYLKO WYGLĄDA
//
// Rozróżnienie jest tu całą trudnością. To repo stawia politykę wzorcem
// `DROP POLICY IF EXISTS … ; CREATE POLICY …`, bo migracja ma dać się puścić
// drugi raz (AGENTS.md). Gdyby skaner liczył każdy DROP, ręczna byłaby
// praktycznie każda migracja i znacznik nie znaczyłby nic.
//
// GROŹNE to wyłącznie to, czego nie odwróci ponowne uruchomienie:
// zniknięte dane i zmienione w miejscu typy.
const GROZNE = [
  [/\bDROP\s+TABLE\b/i,                      'DROP TABLE'],
  [/\bDROP\s+SCHEMA\b/i,                     'DROP SCHEMA'],
  [/\bDROP\s+COLUMN\b/i,                     'DROP COLUMN'],
  [/\bDROP\s+TYPE\b/i,                       'DROP TYPE'],
  [/\bTRUNCATE\b/i,                          'TRUNCATE'],
  [/\bDELETE\s+FROM\b/i,                     'DELETE FROM'],
  [/\bALTER\s+COLUMN\s+\S+\s+TYPE\b/i,       'ALTER COLUMN … TYPE'],
  [/\bRENAME\s+COLUMN\b/i,                   'RENAME COLUMN'],
  [/\bRENAME\s+TO\b/i,                       'RENAME TO'],
  [/\bSET\s+NOT\s+NULL\b/i,                  'SET NOT NULL'],
];

// Odwracalne ponownym uruchomieniem, więc nie blokują automatu. Wypisujemy je
// w raporcie, żeby człowiek czytający log widział, co poszło, a nie tylko że
// poszło.
const ODWRACALNE = [
  [/\bDROP\s+POLICY\b/i,   'DROP POLICY (wzorzec idempotentny)'],
  [/\bDROP\s+TRIGGER\b/i,  'DROP TRIGGER (wzorzec idempotentny)'],
  [/\bDROP\s+CONSTRAINT\b/i, 'DROP CONSTRAINT (wzorzec idempotentny)'],
  [/\bDROP\s+INDEX\b/i,    'DROP INDEX'],
  [/\bDROP\s+FUNCTION\b/i, 'DROP FUNCTION'],
];

/** Usuwa komentarze SQL, żeby słowo „DROP" w wyjaśnieniu nie robiło z migracji
 *  ręcznej. To nie jest teoretyczne: nagłówki w tym repo opisują WPROST, czego
 *  migracja nie robi („nie kasuje kolumny, bo…"). */
export function bezKomentarzy(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n');
}

/**
 * Wycina ciała funkcji i wyzwalaczy (`$$ … $$`, `$tag$ … $tag$`).
 *
 * BEZ TEGO KLASYFIKATOR KŁAMIE, i to w najgorszą stronę: `DELETE FROM` w ciele
 * funkcji niczego przy migracji nie kasuje, tylko DEFINIUJE zachowanie na
 * później. Pierwszy pomiar na tym repo uznał za ręczne cztery migracje
 * (`016`, `128`, `137`, `146`) wyłącznie z tego powodu — a `146` to zwykły
 * generator terminarza, który czyści mecze turnieju przy ponownym ułożeniu.
 *
 * Gdyby te fałszywe trafienia zostały, ręcznych byłoby więcej niż prawdziwie
 * groźnych i podział przestałby cokolwiek znaczyć.
 *
 * Parowanie znaczników, nie wyrażenie regularne z odwołaniem wstecznym:
 * `$$ … $$` i `$tag$ … $tag$` muszą się zamykać tym SAMYM znacznikiem,
 * a zagnieżdżenia (funkcja tworząca funkcję) mają różne znaczniki właśnie
 * po to, żeby dało się je sparować.
 */
export function bezCialFunkcji(sql) {
  const znacznik = /\$([A-Za-z_][A-Za-z0-9_]*)?\$/g;
  let wynik = '';
  let od = 0;
  let m;
  while ((m = znacznik.exec(sql)) !== null) {
    const otwierajacy = m[0];
    const zamykajacy = sql.indexOf(otwierajacy, m.index + otwierajacy.length);
    if (zamykajacy === -1) break; // niesparowany: zostawiamy resztę jak jest
    wynik += sql.slice(od, m.index) + ' ';
    od = zamykajacy + otwierajacy.length;
    znacznik.lastIndex = od;
  }
  return wynik + sql.slice(od);
}

export function oceń(nazwa, tresc) {
  const kod = bezCialFunkcji(bezKomentarzy(tresc));
  const powody = [];
  for (const [re, etykieta] of GROZNE) if (re.test(kod)) powody.push(etykieta);

  const naglowek = tresc.split('\n').slice(0, 15).join('\n');
  const reczna = /^--\s*RECZNA:\s*(.+)$/im.exec(naglowek);
  if (reczna) powody.push(`znacznik RECZNA: ${reczna[1].trim()}`);

  const uwagi = [];
  for (const [re, etykieta] of ODWRACALNE) if (re.test(kod)) uwagi.push(etykieta);

  return { nazwa, reczna: powody.length > 0, powody, uwagi };
}

// ── Wywołanie z wiersza poleceń ─────────────────────────────────────────────
// `node scripts/ryzyko-migracji.mjs plik.sql` → kod 0 gdy bezpieczna, 1 gdy
// ręczna. Powody na standardowe wyjście. Tak woła to `migruj.sh`, który jest
// w bashu i nie zaimportuje modułu.
//
// Bez argumentów wypisuje klasyfikację CAŁEGO katalogu — przydatne, żeby
// zobaczyć, czy reguła nie zaczęła nagle łapać wszystkiego.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync, readdirSync } = await import('node:fs');
  const { dirname, join, basename } = await import('node:path');
  const { fileURLToPath } = await import('node:url');

  const argumenty = process.argv.slice(2);

  if (argumenty.length === 0) {
    const katalog = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
    const pliki = readdirSync(katalog).filter((f) => f.endsWith('.sql')).sort();
    const oceny = pliki.map((f) => oceń(f, readFileSync(join(katalog, f), 'utf8')));
    const reczne = oceny.filter((o) => o.reczna);
    console.log(`Migracji: ${pliki.length}, ręcznych: ${reczne.length}, automatycznych: ${pliki.length - reczne.length}`);
    for (const o of reczne) console.log(`  RĘCZNA  ${o.nazwa}  (${o.powody.join(', ')})`);
    process.exit(0);
  }

  const plik = argumenty[0];
  const ocena = oceń(basename(plik), readFileSync(plik, 'utf8'));
  if (ocena.reczna) {
    console.log(ocena.powody.join(', '));
    process.exit(1);
  }
  process.exit(0);
}
