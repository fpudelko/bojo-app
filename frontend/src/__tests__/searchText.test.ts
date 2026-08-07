import { describe, it, expect } from 'vitest';
import { foldText, foldedIncludes } from '@/lib/searchText';

describe('foldText', () => {
  it('sprowadza do małych liter', () => {
    expect(foldText('Piłka Nożna')).toBe('pilka nozna');
  });

  it('składa wszystkie polskie znaki diakrytyczne', () => {
    expect(foldText('ąćęłńóśźż')).toBe('acelnoszz');
  });

  it('składa wielkie polskie znaki', () => {
    expect(foldText('ŻÓŁĆ')).toBe('zolc');
  });

  it('zachowuje spacje między słowami', () => {
    expect(foldText('Boisko Orlik Grunwaldzka')).toBe('boisko orlik grunwaldzka');
  });

  it('zwija powtórzone białe znaki i przycina brzegi', () => {
    expect(foldText('  siatkówka   plażowa  ')).toBe('siatkowka plazowa');
  });

  it('nie rusza cyfr ani znaków interpunkcyjnych', () => {
    expect(foldText('Orlik nr 3, ul. Głogowska')).toBe('orlik nr 3, ul. glogowska');
  });

  it('pusty string zostaje pusty', () => {
    expect(foldText('')).toBe('');
  });
});

describe('foldedIncludes — realny przypadek z /wydarzenia', () => {
  it('„pilka" bez ogonków znajduje „piłka nożna"', () => {
    expect(foldedIncludes('piłka nożna', foldText('pilka'))).toBe(true);
  });

  it('„PIŁKA" wielkimi też znajduje', () => {
    expect(foldedIncludes('piłka nożna', foldText('PIŁKA'))).toBe(true);
  });

  it('nie dopasowuje czegoś, czego tam nie ma', () => {
    expect(foldedIncludes('piłka nożna', foldText('kosz'))).toBe(false);
  });

  it('null i undefined nie wybuchają', () => {
    expect(foldedIncludes(null, 'x')).toBe(false);
    expect(foldedIncludes(undefined, 'x')).toBe(false);
  });
});
