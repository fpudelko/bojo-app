import { describe, it, expect } from 'vitest';
import { paraRozmowy, kluczDmWidziano } from '@/lib/dm';

const A = '11111111-1111-4111-8111-111111111111';
const B = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('para rozmowy prywatnej', () => {
  it('jest KANONICZNA — kolejność argumentów nic nie zmienia', () => {
    // To jest cały powód istnienia tej funkcji: bez wspólnego porządku
    // rozmowa A→B i B→A byłyby dwoma osobnymi wierszami, czyli dwiema
    // równoległymi rozmowami tych samych osób.
    expect(paraRozmowy(A, B)).toEqual(paraRozmowy(B, A));
  });

  it('mniejszy identyfikator jest zawsze `low`', () => {
    // CHECK w migracji 124 pilnuje tego samego po stronie bazy.
    expect(paraRozmowy(B, A)).toEqual({ low: A, high: B });
  });

  it('klucz „widziano" też jest wspólny dla obu stron', () => {
    expect(kluczDmWidziano(A, B)).toBe(kluczDmWidziano(B, A));
  });

  it('klucz nie zderza się z kluczem rozmowy meczu', () => {
    // Oba idą do tego samego `localStorage`; identyfikator meczu i pary to
    // różne rzeczy, więc przedrostek `dm:` musi je rozdzielić.
    expect(kluczDmWidziano(A, B)).toContain('dm:');
    expect(kluczDmWidziano(A, B)).not.toBe(kluczDmWidziano(A, A.replace('1111-1111', '1111-2222')));
  });
});
