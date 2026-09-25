import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const rpc = vi.fn();
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

import { BLIK_PHONE_REVEAL_MINUTES } from '@/lib/payments';
import { podejrzyjWpisGoscia } from '@/lib/guestClaim';

// W-4 (docs/faza1-przejscie-e2e-plan.md). Gość bez konta widzi numer BLIK na
// stronie swojego wpisu na TYCH SAMYCH warunkach co konto na stronie meczu.
// Regułę dla gościa liczy baza (`podejrzyj_wpis_goscia`, migracja 163), dla
// konta — `canSeeBlikPhone()`. Dwie kopie jednej reguły muszą się zgadzać.

const MIGRACJE = path.resolve(__dirname, '../../../supabase/migrations');

function ostatniaDefinicja(nazwa: string): string {
  const pliki = fs.readdirSync(MIGRACJE).filter((f) => f.endsWith('.sql')).sort();
  let ostatnia = '';
  for (const f of pliki) {
    const sql = fs.readFileSync(path.join(MIGRACJE, f), 'utf8');
    const i = sql.search(new RegExp(`CREATE (OR REPLACE )?FUNCTION (public\\.)?${nazwa}\\(`));
    if (i >= 0) ostatnia = sql.slice(i);
  }
  return ostatnia;
}

describe('reguła odsłonięcia numeru BLIK — baza i front mówią to samo', () => {
  const sql = ostatniaDefinicja('podejrzyj_wpis_goscia');

  it('ostatnia definicja funkcji zwraca numer BLIK i flagę „później”', () => {
    expect(sql).toMatch(/blik_telefon\s+text/);
    expect(sql).toMatch(/blik_pozniej\s+boolean/);
  });

  it(`okno odsłonięcia w SQL = BLIK_PHONE_REVEAL_MINUTES (${BLIK_PHONE_REVEAL_MINUTES} min)`, () => {
    expect(sql).toContain(`interval '${BLIK_PHONE_REVEAL_MINUTES} minutes'`);
  });

  it('numer tylko dla składu: rezerwa, poczekalnia i obserwujący odpadają', () => {
    expect(sql).toMatch(/NOT coalesce\(p\.is_reserve, false\)/);
    expect(sql).toMatch(/NOT coalesce\(p\.pending_approval, false\)/);
    expect(sql).toMatch(/<> 'maybe'/);
  });
});

describe('podejrzyjWpisGoscia — nowe pola płatności', () => {
  beforeEach(() => rpc.mockReset());

  const stary = {
    imie: 'Kuba', event_id: 'e1', tytul: 'Mecz', data_meczu: '2026-10-01', godzina: '18:00:00',
    miejsce: 'Orlik', juz_przejety: false, status_meczu: 'active', na_rezerwie: false,
    czeka_na_akceptacje: false, koszt_grosze: 2000, w_skladzie: 4, max_graczy: 14,
    mozna_zmieniac: true, oferta_do: null,
  };

  it('stary kształt funkcji (przed migracją 163): bezpieczne wartości zapasowe', async () => {
    rpc.mockResolvedValue({ data: [stary], error: null });
    const w = await podejrzyjWpisGoscia('t');
    expect(w).toMatchObject({
      metodyPlatnosci: [], metodaPlatnosci: null, kartaSportowa: false, znizkaKartyGrosze: null,
      pokazStatusPlatnosci: false, oplacone: false, blikTelefon: null, blikPozniej: false,
    });
  });

  it('nowy kształt: pola przechodzą 1:1', async () => {
    rpc.mockResolvedValue({ data: [{
      ...stary, metody_platnosci: ['gotowka', 'blik'], metoda_platnosci: 'blik', karta_sportowa: true,
      znizka_karty_grosze: 500, pokaz_status_platnosci: true, oplacone: true,
      blik_telefon: '600 123 456', blik_pozniej: false,
    }], error: null });
    const w = await podejrzyjWpisGoscia('t');
    expect(w).toMatchObject({
      metodyPlatnosci: ['gotowka', 'blik'], metodaPlatnosci: 'blik', kartaSportowa: true,
      znizkaKartyGrosze: 500, pokazStatusPlatnosci: true, oplacone: true,
      blikTelefon: '600 123 456', blikPozniej: false,
    });
  });
});
