import { describe, it, expect } from 'vitest';
import {
  czyPokazacZachete,
  korzysciInstalacji,
  powodInstalacji,
  SYGNATURY_WBUDOWANEJ,
  type StanPrzegladarki,
} from '@/lib/instalacja';

const telefonAndroid: StanPrzegladarki = {
  zainstalowane: false, system: 'android', wbudowana: false, telefon: true,
};
const telefoniPhone: StanPrzegladarki = {
  zainstalowane: false, system: 'ios', wbudowana: false, telefon: true,
};

describe('kogo pytamy o instalację', () => {
  it('Androida pytamy, gdy przeglądarka dała sygnał instalacji', () => {
    expect(czyPokazacZachete(telefonAndroid, false, true)).toBe(true);
  });

  it('Androida NIE pytamy bez sygnału — nie mielibyśmy czym zainstalować', () => {
    expect(czyPokazacZachete(telefonAndroid, false, false)).toBe(false);
  });

  it('iPhone pytamy zawsze — sygnału tam nie ma i nigdy nie będzie', () => {
    // Na iOS `beforeinstallprompt` nie istnieje. Gdyby zachęta czekała na ten
    // sygnał tak jak na Androidzie, nie pokazałaby się nigdy — czyli dokładnie
    // tam, gdzie instalacja jest warunkiem powiadomień.
    expect(czyPokazacZachete(telefoniPhone, false, false)).toBe(true);
  });

  it('nie pytamy kogoś, kto już zainstalował', () => {
    const zainstalowany = { ...telefoniPhone, zainstalowane: true };
    expect(czyPokazacZachete(zainstalowany, false, true)).toBe(false);
  });

  it('nie pytamy drugi raz po zamknięciu', () => {
    expect(czyPokazacZachete(telefonAndroid, true, true)).toBe(false);
    expect(czyPokazacZachete(telefoniPhone, true, true)).toBe(false);
  });

  it('nie pytamy na komputerze', () => {
    const komputer = { ...telefonAndroid, telefon: false };
    expect(czyPokazacZachete(komputer, false, true)).toBe(false);
  });

  it('nie pytamy w przeglądarce wbudowanej w Messengera', () => {
    // Instalacja stamtąd nie zadziała, a instrukcja tylko zmyli — ten sam
    // powód, dla którego blokujemy tam logowanie Google.
    const wMessengerze = { ...telefoniPhone, wbudowana: true };
    expect(czyPokazacZachete(wMessengerze, false, true)).toBe(false);
  });

  it('nie pytamy na systemie, którego nie rozpoznajemy', () => {
    const dziwny = { ...telefonAndroid, system: 'inny' as const };
    expect(czyPokazacZachete(dziwny, false, true)).toBe(false);
  });
});

describe('sygnatury przeglądarek wbudowanych', () => {
  const przyklady = [
    ['Facebook na iOS', 'Mozilla/5.0 (iPhone) [FBAN/FBIOS;FBAV/450.0.0.0]'],
    ['Instagram', 'Mozilla/5.0 (iPhone) Instagram 250.0.0.0'],
    ['Messenger Lite', 'Mozilla/5.0 (Linux; Android) MessengerLite/1.0'],
  ] as const;

  for (const [nazwa, ua] of przyklady) {
    it(`rozpoznaje ${nazwa}`, () => {
      expect(SYGNATURY_WBUDOWANEJ.test(ua)).toBe(true);
    });
  }

  it('zwykłe Safari przepuszcza', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Safari/605.1.15';
    expect(SYGNATURY_WBUDOWANEJ.test(ua)).toBe(false);
  });
});

describe('powód instalacji', () => {
  it('na iOS mówi wprost, że bez tego nie ma powiadomień', () => {
    // Na iPhonie to nie jest zachęta, tylko fakt — obiecywanie push bez
    // instalacji byłoby po prostu nieprawdą.
    expect(powodInstalacji('ios')).toMatch(/tylko z ekranu głównego/i);
  });

  it('na Androidzie sprzedaje korzyść, nie czynność', () => {
    const tekst = powodInstalacji('android');
    expect(tekst).toMatch(/przypomnienie/i);
    expect(tekst).not.toMatch(/zainstaluj/i);
  });
});

describe('korzyści z instalacji', () => {
  it('trzy zdania, każde o zdarzeniu — nie o właściwości technicznej', () => {
    const korzysci = korzysciInstalacji();
    expect(korzysci).toHaveLength(3);
    expect(korzysci.every((k) => k.tekst.length > 0)).toBe(true);
  });

  it('zwolnione miejsce jest pierwsze — to jedyna rzecz, która boli natychmiast', () => {
    // Zwolnione miejsce znika w kilka minut. Przypomnienie o meczu i rozmowa
    // ekipy poczekają; ta jedna rzecz nie, więc stoi na górze listy.
    expect(korzysciInstalacji()[0].ikona).toBe('miejsce');
  });

  it('każda korzyść ma inną ikonę — inaczej lista wygląda jak trzy razy to samo', () => {
    const ikony = korzysciInstalacji().map((k) => k.ikona);
    expect(new Set(ikony).size).toBe(ikony.length);
  });

  it('zero języka marketingowego', () => {
    const tekst = korzysciInstalacji().map((k) => k.tekst).join(' ').toLowerCase();
    for (const fraza of ['najlepsz', 'rewolucyj', 'wygodniej niż', 'błyskawicz']) {
      expect(tekst).not.toContain(fraza);
    }
  });
});
