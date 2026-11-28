import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const mockRpc = vi.fn();
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));

import {
  BLAD_BRAK_TELEFONU, czyBladBrakuTelefonu, linkTelefonu, mojTelefon,
  przygotujTelefon, telefonySkladu, zapiszMojTelefon,
} from '@/lib/telefon';

const MIGRACJA = readFileSync(
  join(__dirname, '../../../supabase/migrations/197_wymagany_telefon.sql'), 'utf8',
);

beforeEach(() => mockRpc.mockReset());

describe('wymagany numer telefonu (migracja 197)', () => {
  // Frontend rozpoznaje odmowę po fragmencie komunikatu z wyzwalacza. Zmiana
  // treści w SQL bez zmiany tutaj zamieniłaby przekierowanie do okna z polem
  // na numer w gołym czerwonym dymku — po cichu, bez błędu w żadnym teście.
  it('fragment komunikatu jest w komunikacie wyzwalacza', () => {
    expect(MIGRACJA).toContain(`Ten mecz ${BLAD_BRAK_TELEFONU}`);
  });

  it('rozpoznaje odmowę bazy po komunikacie', () => {
    expect(czyBladBrakuTelefonu(new Error('Ten mecz wymaga numeru telefonu. Dodaj go, żeby się zapisać.'))).toBe(true);
    expect(czyBladBrakuTelefonu(new Error('Zapisy na ten mecz są zamknięte'))).toBe(false);
    expect(czyBladBrakuTelefonu(null)).toBe(false);
  });

  it('normalizuje polski numer, pusty zamienia na null, śmieci odrzuca', () => {
    expect(przygotujTelefon(' 501 234 567 ')).toBe('+48501234567');
    expect(przygotujTelefon('+48501234567')).toBe('+48501234567');
    expect(przygotujTelefon('   ')).toBeNull();
    expect(() => przygotujTelefon('abc')).toThrow(/9-cyfrowym/);
    expect(() => przygotujTelefon('12345')).toThrow();
  });

  it('link tel: bez spacji i nawiasów', () => {
    expect(linkTelefonu('+48 501-234 567')).toBe('tel:+48501234567');
  });

  it('własny numer czyta i zapisuje przez funkcje bazy, nie przez tabelę', async () => {
    mockRpc.mockResolvedValueOnce({ data: [{ phone: '+48501234567', phone_consent: true }], error: null });
    expect(await mojTelefon()).toEqual({ phone: '+48501234567', phoneConsent: true });
    expect(mockRpc).toHaveBeenCalledWith('moj_telefon');

    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await mojTelefon()).toEqual({ phone: null, phoneConsent: false });

    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    await zapiszMojTelefon('+48501234567', true);
    expect(mockRpc).toHaveBeenLastCalledWith('zapisz_moj_telefon', { p_telefon: '+48501234567', p_zgoda: true });
  });

  it('numery składu wracają jako mapa id wpisu → numer', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ uczestnik: 'a', telefon: '+48500100200' }, { uczestnik: 'b', telefon: '600700800' }],
      error: null,
    });
    expect(await telefonySkladu('mecz-1')).toEqual({ a: '+48500100200', b: '600700800' });
    expect(mockRpc).toHaveBeenCalledWith('telefony_skladu', { p_event_id: 'mecz-1' });
  });

  it('błąd bazy przy numerach składu nie jest połykany', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'permission denied' } });
    await expect(telefonySkladu('mecz-1')).rejects.toThrow('permission denied');
  });
});
