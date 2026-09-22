import { describe, it, expect } from 'vitest';
import { posortujPoKolejnosci } from '@/lib/turniejGaleria';

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
