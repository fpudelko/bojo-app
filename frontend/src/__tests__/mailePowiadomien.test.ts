import { describe, it, expect } from 'vitest';
import {
  type Dane, type Powod, doHtml, doTekstu, tresc,
} from '../../../supabase/functions/powiadom-goscia/tresc';

// Maile Bojo wychodzą w DWÓCH wersjach z jednego opisu treści (`tresc.ts`).
// Ten plik pilnuje trzech rzeczy, których nie widać po wysyłce testowej na
// jeden adres: że żaden powód nie zgubił wersji graficznej, że cudzy tytuł
// meczu nie wstrzyknie się do HTML-a i że obie wersje niosą tę samą treść.

const cfg = { strona: 'https://bojo.pl' };

const POWODY: Powod[] = [
  'zapis', 'zaakceptowano', 'odrzucono', 'oferta', 'odwolanie', 'zmiana',
  'jutro_grasz', 'zaloz_konto', 'powitanie',
  'mecz_odwolany', 'zmiana_terminu', 'zmiana_warunkow_meczu', 'mecz_przywrocony',
];

function dane(powod: Powod, nadpisz: Partial<Dane> = {}): Dane {
  return {
    powod,
    email: 'gracz@example.com',
    imie: 'Jan',
    event_id: 'aaaaaaaa-0000-4000-8000-00000000000a',
    tytul: 'Czwartkowa ligówka 7v7',
    data: '11.09.2026',
    godzina: '20:00',
    miejsce: 'Orlik Sołacz, ul. Niestachowska 8',
    koszt_grosz: 1500,
    na_rezerwie: false,
    token: '00000000-0000-4000-8000-0000000000ff',
    ...nadpisz,
  };
}

describe('maile — każdy powód ma obie wersje', () => {
  it.each(POWODY)('%s: temat, tekst i HTML nie są puste', (powod) => {
    const mail = tresc(dane(powod), cfg);
    expect(mail, `brak treści dla powodu ${powod}`).not.toBeNull();
    expect(mail!.temat.length).toBeGreaterThan(5);
    expect(doTekstu(mail!).length).toBeGreaterThan(80);
    expect(doHtml(mail!, cfg)).toContain('<!doctype html>');
  });

  it.each(POWODY)('%s: HTML niesie każdą linijkę tekstu', (powod) => {
    const mail = tresc(dane(powod), cfg)!;
    const html = doHtml(mail, cfg);
    // Zdania z wersji tekstowej muszą być w HTML-u — inaczej jedna wersja
    // mówi coś, czego druga nie mówi, a odbiorca dostaje losowo jedną z nich.
    for (const b of mail.bloki) {
      if (b.typ === 'akapit' || b.typ === 'drobne') expect(html).toContain(b.tekst.slice(0, 40));
      if (b.typ === 'przycisk' || b.typ === 'link') expect(html).toContain(b.url);
    }
  });

  it('nieznany powód zwraca null, a nie pusty mail', () => {
    expect(tresc(dane('cos_nowego' as Powod), cfg)).toBeNull();
  });
});

describe('maile — bezpieczeństwo i domena', () => {
  it('tytuł meczu od użytkownika nie wstrzykuje HTML-a', () => {
    const mail = tresc(dane('zapis', { tytul: '<script>alert(1)</script> & "ligówka"' }), cfg)!;
    const html = doHtml(mail, cfg);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('miejsce od użytkownika też przechodzi przez escape', () => {
    const mail = tresc(dane('zapis', { miejsce: 'Orlik <b>Sołacz</b>' }), cfg)!;
    expect(doHtml(mail, cfg)).not.toContain('<b>Sołacz</b>');
  });

  it('stopka prowadzi na domenę kanoniczną, nigdy na vercel.app', () => {
    const html = doHtml(tresc(dane('powitanie'), cfg)!, cfg);
    expect(html).toContain('bojo.pl');
    expect(html).not.toContain('vercel.app');
  });

  it('rok w stopce jest bieżący — nie zapisany na sztywno', () => {
    const html = doHtml(tresc(dane('powitanie'), cfg)!, cfg);
    expect(html).toContain(`© ${new Date().getFullYear()} Bojo`);
  });
});

describe('maile — treść mówi prawdę o stanie zapisu', () => {
  it('zapis czekający na akceptację NIE mówi „masz miejsce w składzie”', () => {
    const t = doTekstu(tresc(dane('zapis', { czeka_na_akceptacje: true }), cfg)!);
    expect(t).toContain('czeka na akceptację');
    expect(t).not.toContain('Masz miejsce w składzie');
  });

  it('zapis na rezerwę mówi o rezerwie, nie o składzie', () => {
    const mail = tresc(dane('zapis', { na_rezerwie: true }), cfg)!;
    expect(mail.temat).toContain('rezerw');
    expect(doTekstu(mail)).not.toContain('Masz miejsce w składzie');
  });

  it('mecz bez kosztu nie pokazuje ceny', () => {
    const t = doTekstu(tresc(dane('zapis', { koszt_grosz: null }), cfg)!);
    expect(t).not.toContain('zł od osoby');
  });

  it('konto bez imienia dostaje „Cześć!”, nigdy „Cześć null!”', () => {
    expect(doTekstu(tresc(dane('powitanie', { imie: null }), cfg)!)).toContain('Cześć!');
  });

  it('oferta bez okna czasowego nie obiecuje terminu, którego nie zna', () => {
    const t = doTekstu(tresc(dane('oferta', { oferta_do: null }), cfg)!);
    expect(t).toContain('jak najszybciej');
    expect(t).not.toContain('Masz czas do');
  });
});

describe('maile — droga wyjścia zależy od tego, czy odbiorca ma konto', () => {
  it('odbiorca z kontem dostaje link do meczu i sposób wyłączenia maili', () => {
    const t = doTekstu(tresc(dane('mecz_odwolany', { ma_konto: true }), cfg)!);
    expect(t).toContain('/wydarzenia/aaaaaaaa-0000-4000-8000-00000000000a');
    expect(t).toContain('/profil');
  });

  it('gość bez konta dostaje link do swojego wpisu, bez ustawień', () => {
    const t = doTekstu(tresc(dane('odwolanie'), cfg)!);
    expect(t).toContain('/gracz/przejmij/00000000-0000-4000-8000-0000000000ff');
    expect(t).not.toContain('/profil');
  });

  it('gość bez tokenu wraca na stronę meczu, a nie na pusty adres', () => {
    const t = doTekstu(tresc(dane('odwolanie', { token: null }), cfg)!);
    expect(t).toContain('/wydarzenia/aaaaaaaa-0000-4000-8000-00000000000a');
    expect(t).not.toContain('/gracz/przejmij/');
  });
});
