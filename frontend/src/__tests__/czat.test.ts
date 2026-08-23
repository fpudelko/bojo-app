import { describe, it, expect } from 'vitest';
import { taSamaGrupaWiadomosci, koniecGrupyWiadomosci, OKNO_GRUPOWANIA_MS } from '@/lib/czat';

const w = (userId: string, iso: string) => ({ userId, createdAt: iso });

describe('grupowanie bąbelków', () => {
  it('dwie wiadomości tej samej osoby w ciągu pięciu minut to jedna grupa', () => {
    expect(taSamaGrupaWiadomosci(w('a', '2026-08-22T18:00:00Z'), w('a', '2026-08-22T18:03:00Z'))).toBe(true);
  });

  it('ta sama osoba po dłuższej przerwie zaczyna NOWĄ grupę', () => {
    // Bez progu czasowego wiadomość z rana i odpowiedź z wieczora zlewały się
    // w jeden blok, jakby były jedną myślą wypowiedzianą ciągiem.
    expect(taSamaGrupaWiadomosci(w('a', '2026-08-22T08:00:00Z'), w('a', '2026-08-22T20:00:00Z'))).toBe(false);
  });

  it('inna osoba to zawsze nowa grupa, choćby sekundę później', () => {
    expect(taSamaGrupaWiadomosci(w('a', '2026-08-22T18:00:00Z'), w('b', '2026-08-22T18:00:01Z'))).toBe(false);
  });

  it('pierwsza wiadomość w rozmowie nie kontynuuje niczego', () => {
    expect(taSamaGrupaWiadomosci(undefined, w('a', '2026-08-22T18:00:00Z'))).toBe(false);
  });

  it('zepsuty znacznik czasu rozbija grupę świadomie, nie przez NaN', () => {
    expect(taSamaGrupaWiadomosci(w('a', 'nie-data'), w('a', '2026-08-22T18:00:00Z'))).toBe(false);
  });

  it('próg to dokładnie pięć minut', () => {
    expect(OKNO_GRUPOWANIA_MS).toBe(5 * 60 * 1000);
  });
});

describe('koniec grupy — tam stoi awatar', () => {
  it('ostatnia wiadomość rozmowy zawsze kończy grupę', () => {
    expect(koniecGrupyWiadomosci(w('a', '2026-08-22T18:00:00Z'), undefined)).toBe(true);
  });

  it('wiadomość, po której pisze ktoś inny, kończy grupę', () => {
    expect(koniecGrupyWiadomosci(w('a', '2026-08-22T18:00:00Z'), w('b', '2026-08-22T18:00:30Z'))).toBe(true);
  });

  it('wiadomość w środku serii tej samej osoby NIE kończy grupy', () => {
    expect(koniecGrupyWiadomosci(w('a', '2026-08-22T18:00:00Z'), w('a', '2026-08-22T18:01:00Z'))).toBe(false);
  });

  it('granica dnia kończy grupę, choćby dzieliła je minuta', () => {
    // 23:59 i 00:01 to dwa różne dni na ekranie — separator dnia rozdziela je
    // wizualnie, więc sklejona grupa przeskakiwałaby przez niego.
    const wieczor = new Date(2026, 7, 22, 23, 59).toISOString();
    const noc = new Date(2026, 7, 23, 0, 1).toISOString();
    expect(koniecGrupyWiadomosci(w('a', wieczor), w('a', noc))).toBe(true);
  });
});
