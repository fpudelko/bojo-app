import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataWygasniecia, opisAlertu } from '@/lib/alerts';

/**
 * ALERT NIE MA JUŻ WYMIARU CZASU — od 2026-09-15.
 *
 * Z okna zeszła sekcja „Jak długo powiadamiać" (zgłoszone: „większa prostota
 * plus słabe do zrozumienia"), a razem z nią cztery przeliczniki między
 * przyciskami „Kiedy" a kolumną `expires_at`. Ten plik pilnuje DWÓCH rzeczy,
 * które po tym cięciu zostały:
 *
 *  1. stary wiersz z ustawioną datą dalej daje się PRZECZYTAĆ — kolumna żyje
 *     w bazie i funkcja brzegowa ją honoruje, więc `opisAlertu()` musi mówić
 *     o nim prawdę, a nie „bezterminowo",
 *  2. okno nigdy nie ustawia daty od nowa — gdyby wróciło do tego bocznymi
 *     drzwiami, powstałby termin, którego nie widać i nie da się zmienić.
 */

describe('data wygaśnięcia — odczyt starych wierszy', () => {
  it('puste wygaśnięcie znaczy bezterminowo, nie „dziś"', () => {
    expect(dataWygasniecia(null)).toBe('');
    expect(dataWygasniecia(undefined)).toBe('');
    expect(dataWygasniecia('')).toBe('');
  });

  it('śmieć w kolumnie nie przewraca opisu', () => {
    expect(dataWygasniecia('nie-data')).toBe('');
  });

  it('wiersz sprzed cięcia dalej mówi, do kiedy działa', () => {
    // `expires_at` zostaje w bazie i funkcja brzegowa dalej go honoruje.
    // Gdyby opis mówił „bezterminowo", człowiek zobaczyłby w profilu coś
    // innego, niż robi serwer — i dowiedziałby się o tym, gdy maile ustaną.
    const koniec = new Date(2026, 11, 24, 23, 59, 59).toISOString();
    expect(opisAlertu({ expiresAt: koniec, kanalEmail: true })).toContain('24.12.2026');
  });

  it('bez daty mówi wprost „bezterminowo"', () => {
    expect(opisAlertu({ expiresAt: undefined, kanalEmail: true })).toContain('bezterminowo');
  });
});

describe('okno alertu nie ustawia już terminu', () => {
  // Skan źródła, nie render — ta sama metoda co `typyPowiadomien.test.ts`
  // i `maskiZrzutow.test.ts`. Chodzi o klasę błędu, której render nie złapie:
  // wystarczy, że ktoś przywróci przelicznik, i alerty zaczną cicho gasnąć.
  const zrodlo = readFileSync(
    join(process.cwd(), 'src/components/home/AlertSetupDialog.tsx'), 'utf8');

  it('zapisuje `expiresAt: null`, a nie wyliczoną datę', () => {
    expect(zrodlo).toContain('expiresAt:  null');
  });

  it('nie woła żadnego przelicznika czasu życia', () => {
    // Te cztery funkcje zostały usunięte z `lib/alerts.ts`; nazwa, która tu
    // wraca, znaczy, że ktoś odtworzył wymiar czasu bez dopisania go do okna.
    for (const nazwa of ['wygasaZKiedy', 'kiedyZWygasniecia', 'koniecDnia', 'najwczesniejszyKoniec']) {
      expect(zrodlo).not.toContain(nazwa);
    }
  });

  it('nie renderuje już `WyborKiedy`', () => {
    // Komponent ŻYJE — stoi w arkuszu filtrów listy i mapy. Chodzi wyłącznie
    // o to, żeby nie wrócił do okna alertu, gdzie ten sam rząd przycisków
    // znaczył co innego niż piętro wyżej.
    expect(zrodlo).not.toContain('<WyborKiedy');
  });
});
