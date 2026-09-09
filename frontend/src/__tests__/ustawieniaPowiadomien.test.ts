import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn() } }));

import {
  RODZAJE_POWIADOMIEN, RODZAJE_MAILOWE, rodzajeMailowe, przelacz,
} from '@/lib/ustawieniaPowiadomien';

describe('przelacz', () => {
  it('wyłączenie dopisuje typ do listy wyłączonych', () => {
    expect(przelacz([], 'wiadomosc_w_meczu', false)).toEqual(['wiadomosc_w_meczu']);
  });

  it('włączenie usuwa typ z listy', () => {
    expect(przelacz(['wiadomosc_w_meczu', 'nowy_mecz_w_grupie'], 'wiadomosc_w_meczu', true))
      .toEqual(['nowy_mecz_w_grupie']);
  });

  it('dwukrotne wyłączenie nie dubluje wpisu', () => {
    // Bez tego dwa szybkie stuknięcia zostawiały ten sam typ dwa razy,
    // a licznik „N wyłączonych" pokazywał więcej, niż jest rodzajów.
    const raz = przelacz([], 'mecz_odwolany', false);
    expect(przelacz(raz, 'mecz_odwolany', false)).toEqual(['mecz_odwolany']);
  });

  it('włączenie czegoś, co nie było wyłączone, niczego nie psuje', () => {
    expect(przelacz(['mecz_odwolany'], 'wiadomosc_w_grupie', true)).toEqual(['mecz_odwolany']);
  });

  it('nie modyfikuje wejścia — stan Reacta zmienia się przez nową tablicę', () => {
    const przed = ['mecz_odwolany'];
    przelacz(przed, 'wiadomosc_w_meczu', false);
    expect(przed).toEqual(['mecz_odwolany']);
  });
});

describe('katalog rodzajów', () => {
  it('typy się nie powtarzają', () => {
    const typy = RODZAJE_POWIADOMIEN.map((r) => r.typ);
    expect(new Set(typy).size).toBe(typy.length);
  });

  it('rzeczy wymagające reakcji stoją na górze listy', () => {
    // Kolejność jest treścią: kto przewinie do połowy i przestanie czytać,
    // ma zobaczyć to, czego wyłączenie naprawdę boli.
    const pierwszeWazne = RODZAJE_POWIADOMIEN.findIndex((r) => r.wazne);
    const pierwszeZwykle = RODZAJE_POWIADOMIEN.findIndex((r) => !r.wazne);
    expect(pierwszeWazne).toBeLessThan(pierwszeZwykle);
  });

  it('każdy rodzaj ma opis — sama nazwa nie mówi, co się traci', () => {
    for (const r of RODZAJE_POWIADOMIEN) {
      expect(r.opis.length, r.typ).toBeGreaterThan(10);
    }
  });
});

// ---------------------------------------------------------------------------
// Kanał pocztowy (migracja `140`) — lista w aplikacji MUSI zgadzać się z listą
// w wyzwalaczu.
//
// Rozjazd jest tu szczególnie kosztowny w obie strony: ekran obiecujący
// wyłączenie maila, który i tak przyjdzie, uczy człowieka, że ustawienia
// w Bojo nie działają — a ekran BEZ przełącznika dla rodzaju, który realnie
// wychodzi, zostawia jedyną dostępną reakcję w postaci „Zgłoś spam", co psuje
// doręczalność wszystkich maili z domeny, łącznie z tymi o odwołanym meczu.
// ---------------------------------------------------------------------------
describe('rodzaje mailowe zgodne z migracją 140', () => {
  const migracja = readFileSync(
    join(process.cwd(), '..', 'supabase/migrations/140_poczta_do_kont.sql'),
    'utf8',
  );

  it('warunek w wyzwalaczu wymienia dokładnie te same typy', () => {
    const linia = migracja.match(/IF NEW\.type IN \(([^)]+)\)/);
    expect(linia, 'nie znalazłem warunku IF NEW.type IN (...) w migracji 140').toBeTruthy();

    // `match` zamiast `matchAll`: cel kompilacji nie ma iteratora regexpów.
    const zMigracji = (linia![1].match(/'[a-z_]+'/g) ?? []).map((t) => t.slice(1, -1)).sort();
    expect(zMigracji).toEqual([...RODZAJE_MAILOWE].sort());
  });

  it('każdy rodzaj mailowy ma nazwę i opis na liście ustawień', () => {
    // Bez tego `rodzajeMailowe()` po cichu gubi pozycję: typ jest w migracji,
    // wychodzi pocztą, a na ekranie ustawień go nie ma.
    expect(rodzajeMailowe().map((r) => r.typ).sort()).toEqual([...RODZAJE_MAILOWE].sort());
  });

  it('wszystkie rodzaje mailowe są oznaczone jako ważne', () => {
    // Poczta idzie wyłącznie tam, gdzie niedoręczenie kosztuje wyjazd na
    // boisko — czyli z definicji są to rzeczy, których wyłączenie ma być
    // świadome.
    expect(rodzajeMailowe().every((r) => r.wazne)).toBe(true);
  });

  it('typy z wyzwalaczy 065 i 114 są w ogóle na liście ustawień', () => {
    // Do 2026-09-09 nie było ich tam wcale — czyli nie dało się ich wyłączyć
    // nawet dla pusha, mimo że realnie przychodzą od migracji `065` i `114`.
    const typy = RODZAJE_POWIADOMIEN.map((r) => r.typ);
    expect(typy).toContain('zmiana_terminu');
    expect(typy).toContain('zmiana_warunkow_meczu');
    expect(typy).toContain('mecz_przywrocony');
  });
});
