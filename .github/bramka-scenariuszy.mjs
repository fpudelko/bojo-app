#!/usr/bin/env node
/**
 * Bramka dla scenariuszy za logowaniem: czerwono TYLKO za zepsute ZACHOWANIE,
 * nigdy za zmieniony WYGLĄD.
 *
 * PO CO TO POWSTAŁO. Cały workflow `wizualne.yml` był świadomie
 * niepodlegający bramce — zmiana wyglądu bywa zamierzona, a czerwona bramka
 * zmusza wtedy do „naprawiania" czegoś, co jest w porządku. Tyle że ta sama
 * osłona przykryła scenariusze FUNKCJONALNE, gdzie czerwień znaczy „coś nie
 * działa". Skutek: czternaście scenariuszy padało od dawna, zadanie świeciło
 * zielono i nikt się nie dowiedział. Wykryte 2026-08-22, przy okazji
 * dokładania nowych scenariuszy — zielony status zadania nie znaczył nic,
 * bo prawdziwy wynik siedział w zmiennej `UDANE` w środku logu.
 *
 * ROZRÓŻNIENIE. Jeden plik `scenariusze.spec.ts` miesza dwa rodzaje asercji:
 * zachowanie (`toBeVisible`, `toHaveCount`, kliknięcia) i wygląd
 * (`toHaveScreenshot`). Pojedynczy kod wyjścia Playwrighta nie odróżnia ich,
 * więc rozróżniamy je tutaj, po treści błędu.
 *
 * Test, który padł WYŁĄCZNIE na porównaniu zrzutu, jest informacją: wzorce
 * przyjmuje się etykietą `zrzuty:zaakceptuj`, nie poprawką w kodzie. Każdy
 * inny błąd to regresja i ma zapalić się na czerwono.
 *
 * Użycie: node .github/bramka-scenariuszy.mjs frontend/wynik-scenariuszy.json
 */

import { readFileSync } from 'node:fs';

const plik = process.argv[2];
if (!plik) {
  console.error('Brak ścieżki do raportu JSON.');
  process.exit(2);
}

let raport;
try {
  raport = JSON.parse(readFileSync(plik, 'utf8'));
} catch (e) {
  // Brak raportu znaczy, że przebieg wywrócił się przed pierwszym testem
  // (stos Supabase, build, przeglądarka). To NIE jest zmiana wyglądu —
  // cisza w takim wypadku byłaby najgorszą możliwą odpowiedzią.
  console.error(`Nie da się odczytać raportu (${plik}): ${e.message}`);
  process.exit(1);
}

/** Płaska lista testów z drzewa pakietów raportu. */
function zbierz(wezel, zebrane = []) {
  for (const spec of wezel.specs ?? []) {
    for (const test of spec.tests ?? []) {
      zebrane.push({ tytul: spec.title, plik: spec.file, test });
    }
  }
  for (const pod of wezel.suites ?? []) zbierz(pod, zebrane);
  return zebrane;
}

const wszystkie = zbierz({ suites: raport.suites ?? [] });

const wygladowe = [];
const zachowanie = [];

for (const { tytul, test } of wszystkie) {
  // `status` pakietu to werdykt po wszystkich ponowieniach.
  if (test.status === 'expected' || test.status === 'skipped') continue;

  const bledy = (test.results ?? [])
    .flatMap((w) => [w.error?.message ?? '', ...(w.errors ?? []).map((e) => e.message ?? '')])
    .join('\n');

  // WYŁĄCZNIE wiersze zaczynające się od „Error:". Reszta komunikatu Playwrighta
  // to `call log` i RAMKA KODU — a w ramce widać sąsiednie linijki testu.
  // Pierwsza wersja czytała cały komunikat i przez to `expect(pusto).toBeVisible()`
  // stojące dwie linijki NAD padającym `toHaveScreenshot` wystarczało, żeby
  // uznać czystą zmianę wyglądu za regresję. Zdanie „Error:" jest jedynym
  // miejscem, w którym Playwright mówi, co NAPRAWDĘ padło.
  const przyczyny = bledy.split('\n')
    .map((w) => w.trim())
    .filter((w) => w.startsWith('Error: '))
    .map((w) => w.slice('Error: '.length));

  // Dwa rodzaje błędu wolno przemilczeć i oba znaczą to samo: „obejrzyj obrazek".
  //   • różnica wobec wzorca,
  //   • BRAK wzorca — nowy widok. To też nie jest regresja: nowy zrzut nie ma
  //     z czym się różnić, a wzorzec przyjmuje ta sama etykieta. Bez tego
  //     członu pierwszy przebieg nowego scenariusza zawsze świecił czerwono,
  //     nawet gdy całe zachowanie przeszło.
  const czyZrzut = (p) => /toHaveScreenshot/.test(p) || /A snapshot doesn't exist/.test(p);
  const tylkoZrzut = przyczyny.length > 0 && przyczyny.every(czyZrzut);

  (tylkoZrzut ? wygladowe : zachowanie).push(tytul);
}

const wypisz = (naglowek, lista) => {
  if (lista.length === 0) return;
  console.log(`\n${naglowek}`);
  for (const t of [...new Set(lista)]) console.log(`  • ${t}`);
};

wypisz('Zmieniony WYGLĄD — do obejrzenia, nie do naprawienia:', wygladowe);
wypisz('Zepsute ZACHOWANIE — regresja:', zachowanie);

if (zachowanie.length > 0) {
  console.log(
    `\n✗ ${new Set(zachowanie).size} scenariuszy pada na zachowaniu.`
    + '\n  Zrzuty przyjmuje się etykietą `zrzuty:zaakceptuj` — te trzeba naprawić.',
  );
  process.exit(1);
}

console.log(
  wygladowe.length > 0
    ? '\n✓ Zachowanie bez regresji. Zmienił się wyłącznie wygląd — obejrzyj raport i, jeśli tak ma być, nadaj etykietę `zrzuty:zaakceptuj`.'
    : '\n✓ Scenariusze bez zastrzeżeń.',
);
