import { describe, it, expect } from 'vitest';
import { posortujPoKolejnosci, normalizujLinkSponsora, bezpiecznyLinkSponsora } from '@/lib/turniejGaleria';

describe('normalizujLinkSponsora', () => {
  it('puste pole znaczy brak linku', () => {
    expect(normalizujLinkSponsora('   ')).toBeNull();
  });

  it('dopisuje https:// do gołej domeny', () => {
    expect(normalizujLinkSponsora('piekarnia.pl')).toBe('https://piekarnia.pl/');
  });

  it('zostawia http i https bez zmian', () => {
    expect(normalizujLinkSponsora('http://a.pl/x')).toBe('http://a.pl/x');
    expect(normalizujLinkSponsora('https://a.pl/x?y=1')).toBe('https://a.pl/x?y=1');
  });

  it('odrzuca javascript: — link widzi każdy odwiedzający turnieju', () => {
    expect(() => normalizujLinkSponsora('javascript:alert(1)')).toThrow();
    expect(() => normalizujLinkSponsora('JaVaScRiPt:alert(1)')).toThrow();
    expect(() => normalizujLinkSponsora('data:text/html,<script>')).toThrow();
  });
});

describe('bezpiecznyLinkSponsora', () => {
  it('zły link z bazy znika, zamiast trafić do href', () => {
    expect(bezpiecznyLinkSponsora('javascript:alert(1)')).toBeUndefined();
    expect(bezpiecznyLinkSponsora(undefined)).toBeUndefined();
    expect(bezpiecznyLinkSponsora('https://a.pl')).toBe('https://a.pl/');
  });
});

describe('posortujPoKolejnosci', () => {
  it('sortuje po kolejnosc rosnąco', () => {
    const lista = [
      { id: 'b', kolejnosc: 2, createdAt: '2026-01-01' },
      { id: 'a', kolejnosc: 1, createdAt: '2026-01-01' },
    ];
    expect(posortujPoKolejnosci(lista).map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('przy remisie kolejnosc sortuje po createdAt (starsze pierwsze)', () => {
    const lista = [
      { id: 'nowszy', kolejnosc: 0, createdAt: '2026-02-01' },
      { id: 'starszy', kolejnosc: 0, createdAt: '2026-01-01' },
    ];
    expect(posortujPoKolejnosci(lista).map((x) => x.id)).toEqual(['starszy', 'nowszy']);
  });

  it('nie modyfikuje oryginalnej tablicy', () => {
    const lista = [
      { id: 'b', kolejnosc: 2, createdAt: '2026-01-01' },
      { id: 'a', kolejnosc: 1, createdAt: '2026-01-01' },
    ];
    posortujPoKolejnosci(lista);
    expect(lista.map((x) => x.id)).toEqual(['b', 'a']);
  });
});
