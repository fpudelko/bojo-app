import { describe, it, expect } from 'vitest';
import {
  type DaneAlertu, doHtml, doTekstu, miejsce, szczegoly, tresc, withCount,
} from '../../../supabase/functions/notify-game-alert/tresc';

// Zgłoszone wprost: mail o alercie niósł wyłącznie datę i godzinę, bez
// lokalizacji, ceny i liczby miejsc. Ten plik pilnuje, że treść ma wszystkie
// cztery rzeczy naraz i że tytuł/HTML nie łamią się na danych z brzegu
// (brak tytułu, brak adresu, mecz za darmo).

const kontakt = { strona: 'https://bojo.pl', eventUrl: 'https://bojo.pl/wydarzenia/abc', odpowiedzNa: 'bojopolska@gmail.com' };

function dane(nadpisz: Partial<DaneAlertu> = {}): DaneAlertu {
  return {
    sport: 'piłka nożna', title: null, maxPlayers: 14, costGrosz: 1500,
    fieldName: 'Orlik Sołacz', fieldAddress: 'ul. Niestachowska 8',
    customLocationName: null, customAddress: null,
    eventDate: '2026-09-13', eventTime: '18:00:00',
    ...nadpisz,
  };
}

describe('szczegóły niosą to, czego brakowało w zgłoszeniu', () => {
  it('jest data, godzina, miejsce, liczba miejsc i cena — wszystko naraz', () => {
    const s = szczegoly(dane());
    expect(s).toContain('13.09.2026');
    expect(s).toContain('18:00');
    expect(s).toContain('Orlik Sołacz');
    expect(s).toContain('ul. Niestachowska 8');
    expect(s).toContain('14 miejsc');
    expect(s).toContain('15,00 zł od osoby');
  });

  it('mecz za darmo mówi „za darmo”, nie „0,00 zł”', () => {
    expect(szczegoly(dane({ costGrosz: 0 }))).toContain('za darmo');
    expect(szczegoly(dane({ costGrosz: null }))).toContain('za darmo');
  });

  it('14 miejsc — reguła n<5 psuje się właśnie tutaj, to domyślny skład piłkarski', () => {
    expect(withCount(14, 'miejsce', 'miejsca', 'miejsc')).toBe('14 miejsc');
    expect(withCount(1, 'miejsce', 'miejsca', 'miejsc')).toBe('1 miejsce');
    expect(withCount(3, 'miejsce', 'miejsca', 'miejsc')).toBe('3 miejsca');
  });
});

describe('miejsce — nazwa i adres bez duplikatu', () => {
  it('boisko z katalogu: nazwa + adres osobno', () => {
    const m = miejsce({ fieldName: 'Orlik Sołacz', fieldAddress: 'ul. Niestachowska 8', customLocationName: null, customAddress: null });
    expect(m.primary).toBe('Orlik Sołacz');
    expect(m.secondary).toBe('ul. Niestachowska 8');
  });

  it('brak nazwy i adresu — zapasowy opis, nie puste pole', () => {
    const m = miejsce({ fieldName: null, fieldAddress: null, customLocationName: null, customAddress: null });
    expect(m.primary).toBe('Lokalizacja na mapie');
    expect(m.secondary).toBeNull();
  });

  it('nazwa polska sama jest numerem — pułapka boisk bez nazwy własnej', () => {
    const m = miejsce({ fieldName: '42', fieldAddress: 'ul. Testowa 1', customLocationName: null, customAddress: null });
    expect(m.primary).toBe('ul. Testowa 1');
  });
});

describe('tytuł meczu bez tytułu własnego', () => {
  it('brak tytułu — sport + skład zamiast pustki', () => {
    const mail = tresc(dane({ title: null, maxPlayers: 14 }), '13.09.2026');
    expect(mail.label).toContain('Piłka nożna');
    expect(mail.label).toContain('7v7');
  });

  it('nieparzysta liczba miejsc — opis osobowy, nie ułamkowe „vN”', () => {
    const mail = tresc(dane({ title: null, maxPlayers: 11 }), '13.09.2026');
    expect(mail.label).toContain('11 os.');
  });

  it('własny tytuł wygrywa z domyślnym', () => {
    const mail = tresc(dane({ title: 'Czwartkowa ligówka' }), '13.09.2026');
    expect(mail.label).toBe('Czwartkowa ligówka');
  });
});

describe('HTML i tekst niosą tę samą treść i domenę kanoniczną', () => {
  it('HTML zawiera szczegóły i przycisk do meczu', () => {
    const mail = tresc(dane(), '13.09.2026');
    const html = doHtml(mail, kontakt);
    expect(html).toContain(mail.szczegoly);
    expect(html).toContain(kontakt.eventUrl);
    expect(html).toContain('bojo.pl');
    expect(html).not.toContain('vercel.app');
  });

  it('tekst niesie te same dane co HTML', () => {
    const mail = tresc(dane(), '13.09.2026');
    const text = doTekstu(mail, kontakt);
    expect(text).toContain(mail.label);
    expect(text).toContain(mail.szczegoly);
    expect(text).toContain(kontakt.eventUrl);
    expect(text).toContain(kontakt.odpowiedzNa);
  });

  it('tytuł meczu od organizatora nie wstrzykuje HTML-a', () => {
    const mail = tresc(dane({ title: '<script>alert(1)</script>' }), '13.09.2026');
    const html = doHtml(mail, kontakt);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
