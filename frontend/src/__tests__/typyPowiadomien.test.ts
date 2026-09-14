import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { RODZAJE_POWIADOMIEN } from '@/lib/ustawieniaPowiadomien';
import { IKONY } from '@/lib/ikonyPowiadomien';

// Trzy listy typów powiadomień muszą się zgadzać z tym, co REALNIE wstawia
// baza — i między sobą.
//
// SKĄD TEN PLIK. Audyt 2026-09-12 (ustalenie `S-7`) znalazł jedenaście typów
// bez wiersza w `RODZAJE_POWIADOMIEN` (nie dało się ich wyłączyć na
// telefonie) i siedem bez ikony w `NotificationBell.tsx` (lądowały pod
// szarym dzwonkiem z podpisem „Powiadomienie"). To wróciło trzeci raz —
// piąta runda audytu naprawiła sześć brakujących ikon naraz. Ta sama klasa
// błędu co maski Playwrighta (`maskiZrzutow.test.ts`): ochrona, która wygląda
// jak ochrona, dopóki nikt nie sprawdzi, czy naprawdę coś pilnuje.
//
// DOPISUJĄC TYP POWIADOMIENIA W MIGRACJI, DOPISZ GO W OBU MIEJSCACH —
// `lib/ikonyPowiadomien.ts` i `lib/ustawieniaPowiadomien.ts` — ten test
// inaczej wskaże dokładnie ten brak.
//
// JAK ZNAJDUJEMY TYPY W MIGRACJACH. `INSERT INTO notifications (user_id,
// type, …)` jest jedynym wejściem do tabeli w całym repo, a kolejność
// pierwszych dwóch kolumn (`user_id, type`) jest niezmienna od migracji `025`
// — sprawdzone na wszystkich istniejących plikach. Wartość typu to zawsze
// pierwszy literał snake_case (same małe litery i podkreślenia — ludzki
// tytuł/treść ma spacje, wielkie litery i polskie znaki, więc regex go nie
// złapie) po nagłówku INSERT-u.

const KATALOG = process.cwd();
const KATALOG_MIGRACJI = path.join(KATALOG, '..', 'supabase', 'migrations');
const KATALOG_FUNKCJI = path.join(KATALOG, '..', 'supabase', 'functions');

const WZORZEC_INSERTU =
  /INSERT INTO notifications\s*\(\s*user_id\s*,\s*type\s*,[\s\S]{0,600}?'([a-z][a-z_]*)'/gi;

// DRUGIE WEJŚCIE DO TABELI: funkcje brzegowe (Deno) piszą do `notifications`
// przez supabase-js, a nie SQL-em. Dopisane 2026-09-14, bo ten test przez rok
// przepuszczał `game_alert` — typ wstawiany WYŁĄCZNIE przez
// `notify-game-alert/index.ts`. Skutek był dokładnie taki, przed jakim ten
// plik miał chronić: powiadomienie bez ikony i bez możliwości wyłączenia
// na telefonie. Ochrona, która wygląda jak ochrona, dopóki nikt nie sprawdzi,
// czy patrzy we wszystkie miejsca.
const WZORZEC_FUNKCJI =
  /from\(\s*['"]notifications['"]\s*\)[\s\S]{0,800}?\btype\s*:\s*['"]([a-z][a-z_]*)['"]/g;

function plikiRekurencyjnie(katalog: string, rozszerzenie: string): string[] {
  const wynik: string[] = [];
  for (const wpis of readdirSync(katalog, { withFileTypes: true })) {
    const pelna = path.join(katalog, wpis.name);
    if (wpis.isDirectory()) wynik.push(...plikiRekurencyjnie(pelna, rozszerzenie));
    else if (wpis.name.endsWith(rozszerzenie)) wynik.push(pelna);
  }
  return wynik;
}

/** Wszystkie typy powiadomień, które realnie wstawia migracja ALBO funkcja brzegowa. */
function typyZBazy(): Set<string> {
  const typy = new Set<string>();

  for (const plik of plikiRekurencyjnie(KATALOG_MIGRACJI, '.sql')) {
    const tresc = readFileSync(plik, 'utf8');
    let m: RegExpExecArray | null;
    // Świeży `lastIndex` per plik — `WZORZEC_INSERTU` ma flagę `g` i jest
    // dzielony między iteracjami `for`, więc bez resetu drugi plik zaczynałby
    // szukanie od miejsca, w którym skończył się poprzedni.
    WZORZEC_INSERTU.lastIndex = 0;
    while ((m = WZORZEC_INSERTU.exec(tresc))) {
      typy.add(m[1]);
    }
  }

  for (const plik of plikiRekurencyjnie(KATALOG_FUNKCJI, '.ts')) {
    const tresc = readFileSync(plik, 'utf8');
    let m: RegExpExecArray | null;
    WZORZEC_FUNKCJI.lastIndex = 0;
    while ((m = WZORZEC_FUNKCJI.exec(tresc))) {
      typy.add(m[1]);
    }
  }

  return typy;
}

describe('typy powiadomień — baza vs ustawienia vs ikony (S-7)', () => {
  const zBazy = typyZBazy();
  const wUstawieniach = new Set(RODZAJE_POWIADOMIEN.map((r) => r.typ));
  const zIkona = new Set(Object.keys(IKONY));

  it('sanity: widzimy też typy wstawiane przez FUNKCJE BRZEGOWE, nie tylko migracje', () => {
    // `game_alert` nie pada w żadnej migracji — wstawia go wyłącznie
    // `notify-game-alert/index.ts`. Ten test pilnuje samego skanera: gdyby
    // ktoś zawęził go z powrotem do `supabase/migrations`, luka wróciłaby
    // w milczeniu, a powiadomienie znowu straciłoby ikonę i wyłącznik.
    expect(Array.from(zBazy)).toContain('game_alert');
  });

  it('sanity: ekstrakcja z migracji faktycznie coś znalazła', () => {
    // Gdyby regex przestał trafiać (np. po zmianie konwencji SQL), test
    // niżej przechodziłby fałszywie — bo zbiór pusty jest podzbiorem
    // wszystkiego. Twarda dolna granica pilnuje, że ekstrakcja działa.
    expect(zBazy.size).toBeGreaterThanOrEqual(25);
  });

  it('każdy typ wstawiany przez bazę ma wiersz w RODZAJE_POWIADOMIEN (da się wyłączyć push)', () => {
    const brakujace = Array.from(zBazy).filter((t) => !wUstawieniach.has(t)).sort();
    expect(brakujace).toEqual([]);
  });

  it('każdy typ wstawiany przez bazę ma ikonę w IKONY (nie ląduje pod szarym dzwonkiem)', () => {
    const brakujace = Array.from(zBazy).filter((t) => !zIkona.has(t)).sort();
    expect(brakujace).toEqual([]);
  });

  it('IKONY nie trzyma martwych kluczy — każdy odpowiada typowi realnie wstawianemu przez bazę', () => {
    // `event_cancelled` było tu przykładem: typem `activityLog`, nigdy
    // powiadomienia — komponent wyglądał na obsłużony, a klucz nie robił nic.
    const martwe = Array.from(zIkona).filter((t) => !zBazy.has(t)).sort();
    expect(martwe).toEqual([]);
  });

  it('RODZAJE_POWIADOMIEN nie ma wpisów bez pokrycia w bazie (literówka albo usunięty typ)', () => {
    const bezPokrycia = Array.from(wUstawieniach).filter((t) => !zBazy.has(t)).sort();
    expect(bezPokrycia).toEqual([]);
  });
});
