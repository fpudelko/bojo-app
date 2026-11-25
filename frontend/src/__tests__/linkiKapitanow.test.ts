import { describe, it, expect } from 'vitest';
import { tekstLinkowKapitanow, tekstLinkuKapitana } from '@/lib/turniejDruzyny';

// Linki kapitanów (181): tekst, który organizator wkleja na WhatsApp.
// Druga wersja (2026-11-22): bloki z pustą linią między drużynami zamiast
// „nazwa: link” w jednej linii, adres kanoniczny bez www.
describe('tekstLinkowKapitanow', () => {
  const tekst = tekstLinkowKapitanow('Gramy dla Marysi!', [
    { druzynaId: '1', nazwa: 'AFC Poznań', kod: '3A58E93A' },
    { druzynaId: '2', nazwa: 'KS Pyry', kapitan: 'Jan' },
    { druzynaId: '3', nazwa: 'Rossoneri', kod: '3BFA6F33' },
  ], 'https://www.bojo.pl');

  it('pogrubiony nagłówek, instrukcja, numerowane bloki oddzielone pustą linią', () => {
    expect(tekst).toBe([
      '*Gramy dla Marysi!: linki dla kapitanów*',
      '',
      'Otwórz link swojej drużyny, zaloguj się i przejmij drużynę jako kapitan.',
      'Każdy link działa tylko raz, nie przesyłaj go dalej.',
      '',
      '1. *AFC Poznań*',
      'https://bojo.pl/k/3A58E93A',
      '',
      '2. *Rossoneri*',
      'https://bojo.pl/k/3BFA6F33',
    ].join('\n'));
  });

  it('pomija drużyny z kapitanem i nie ma długiego myślnika', () => {
    expect(tekst).not.toContain('KS Pyry');
    expect(tekst).not.toContain('—');
  });
});

// Pojedynczy link (2026-11-25): sam adres w WhatsAppie nie mówił, co to za link.
describe('tekstLinkuKapitana', () => {
  it('nagłówek z nazwą drużyny, instrukcja i adres kanoniczny', () => {
    expect(tekstLinkuKapitana('Gramy dla Marysi!', { nazwa: 'KS Pyry', kod: 'ABC123' }, 'https://www.bojo.pl')).toBe([
      '*Gramy dla Marysi!: link dla kapitana drużyny KS Pyry*',
      '',
      'Otwórz link, zaloguj się i przejmij drużynę jako kapitan.',
      'Link działa tylko raz, nie przesyłaj go dalej.',
      '',
      'https://bojo.pl/k/ABC123',
    ].join('\n'));
  });
});
