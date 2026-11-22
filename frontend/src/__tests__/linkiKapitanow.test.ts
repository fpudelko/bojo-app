import { describe, it, expect } from 'vitest';
import { tekstLinkowKapitanow } from '@/lib/turniejDruzyny';

// Linki kapitanów (181): tekst, który organizator wkleja na WhatsApp.
describe('tekstLinkowKapitanow', () => {
  it('jedna drużyna na linię, tylko drużyny z kodem, z instrukcją na górze', () => {
    const tekst = tekstLinkowKapitanow('Gramy dla Marysi', [
      { druzynaId: '1', nazwa: 'Ekipa Marysi', kod: 'AB12CD34' },
      { druzynaId: '2', nazwa: 'KS Pyry', kapitan: 'Jan' },
      { druzynaId: '3', nazwa: 'Rossoneri', kod: 'ZZ99YY88' },
    ], 'https://bojo.pl');
    const linie = tekst.split('\n');
    expect(linie[0]).toContain('Gramy dla Marysi');
    expect(linie[0]).toContain('działa raz');
    expect(linie.slice(2)).toEqual([
      'Ekipa Marysi: https://bojo.pl/k/AB12CD34',
      'Rossoneri: https://bojo.pl/k/ZZ99YY88',
    ]);
    expect(tekst).not.toContain('—');
  });
});
