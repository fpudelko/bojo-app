/**
 * Treść maili Bojo — JEDNO źródło dla wersji tekstowej i graficznej.
 *
 * DLACZEGO OSOBNY PLIK. Do 2026-09-11 funkcja wysyłała wyłącznie `text:`.
 * Wyglądało to jak notatka z notatnika: gołe adresy URL, brak nagłówka, a Gmail
 * podkreślał na niebiesko przypadkowe fragmenty (nazwę ulicy!), bo sam zgadywał,
 * co jest odnośnikiem. Pierwsza wiadomość, jaką Bojo wysyła człowiekowi, jest
 * jednocześnie pierwszym dowodem, że to działające narzędzie, a nie skrypt.
 *
 * DLACZEGO MODEL BLOKÓW, a nie dwa szablony obok siebie. Dwie równoległe
 * wersje tej samej treści rozjeżdżają się przy pierwszej poprawce — ktoś zmieni
 * zdanie w HTML-u i zapomni o tekście, a wersję tekstową widzą czytniki,
 * zegarki i filtry antyspamowe. Tutaj `tresc()` opisuje, CO jest w mailu,
 * a `doTekstu()` i `doHtml()` decydują JAK to pokazać. Rozjazd jest niemożliwy.
 *
 * WERSJA TEKSTOWA ZOSTAJE. Mail bez `text:` jest przez filtry traktowany gorzej,
 * a dla odbiorcy blokującego obrazki i style bywa jedyną czytelną wersją.
 *
 * Plik jest CZYSTY — bez `Deno`, bez sieci — więc testuje go Vitest
 * (`frontend/src/__tests__/mailePowiadomien.test.ts`) razem z resztą repo.
 */

/** Zieleń marki (`primary-700`), tło i tekst — te same wartości co w aplikacji
 *  (`tailwind.config.ts`, `globals.css`). W mailu nie ma zmiennych CSS ani
 *  klas: każdy styl musi być wpisany w atrybut `style`, bo klienci pocztowe
 *  wycinają `<style>` i arkusze zewnętrzne. */
const ZIELEN = '#15663E';
const ZIELEN_CIEMNA = '#104d2e';
const ATRAMENT = '#1A1D21';
const PLOTNO = '#FAF9F6';
const SZARY = '#5b6470';
const OBWODKA = '#e3e6e3';

export interface Konfiguracja {
  /** Adres strony bez ukośnika na końcu, np. `https://bojo.pl`. */
  strona: string;
}

export type Blok =
  /** Zwykły akapit. Zakończony dwukropkiem wprowadza blok `mecz`. */
  | { typ: 'akapit'; tekst: string }
  /** Karta meczu: tytuł i jedna linia szczegółów (data · miejsce · koszt). */
  | { typ: 'mecz'; tytul: string; szczegoly: string }
  /** Wyliczenie — w tekście z półpauzą, w HTML-u z kropką. */
  | { typ: 'lista'; punkty: string[] }
  /** Główna akcja. `opis` prowadzi do niej w wersji tekstowej („Zacznij tutaj:"),
   *  `etykieta` jest napisem na przycisku („Utwórz mecz"). */
  | { typ: 'przycisk'; etykieta: string; opis: string; url: string }
  /** Akcja drugorzędna — w HTML-u odnośnik z nazwą, w tekście opis + adres.
   *  Goły adres w HTML-u łamie się w pół na telefonie i wygląda jak wklejka. */
  | { typ: 'link'; etykieta: string; opis: string; url: string }
  /** Zdanie pomocnicze: mniejsze i wyszarzone w HTML-u. */
  | { typ: 'drobne'; tekst: string };

export interface Mail {
  temat: string;
  /** „Cześć Jan!" albo „Cześć!" */
  naglowek: string;
  bloki: Blok[];
}

// ── Wersja tekstowa ────────────────────────────────────────────────────────

export function doTekstu(mail: Mail): string {
  const kawalki: string[] = [mail.naglowek];
  for (const b of mail.bloki) {
    switch (b.typ) {
      case 'akapit':
      case 'drobne':
        kawalki.push(b.tekst);
        break;
      case 'mecz':
        kawalki.push(`${b.tytul}\n${b.szczegoly}`);
        break;
      case 'lista':
        kawalki.push(b.punkty.map((p) => `— ${p}`).join('\n'));
        break;
      case 'przycisk':
      case 'link':
        kawalki.push(`${b.opis}\n${b.url}`);
        break;
    }
  }
  return kawalki.join('\n\n') + '\n';
}

// ── Wersja graficzna ───────────────────────────────────────────────────────

/** Bez tego cudzy tytuł meczu („Ligówka <b>7v7</b>") rozjechałby układ maila,
 *  a w skrajnym przypadku wstrzyknął do niego cudzy odnośnik. Tytuł i miejsce
 *  pisze człowiek, więc nigdy nie trafiają do HTML-a surowe. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function blokHtml(b: Blok): string {
  switch (b.typ) {
    case 'akapit':
      return `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:${ATRAMENT};">${esc(b.tekst)}</p>`;
    case 'drobne':
      return `<p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:${SZARY};">${esc(b.tekst)}</p>`;
    case 'mecz':
      // Karta, a nie dwie linijki tekstu: to jest ta część maila, do której
      // człowiek wraca („o której to było?"), więc ma się rzucać w oczy.
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
        style="margin:0 0 16px;border-collapse:separate;"><tr><td
        style="background:${PLOTNO};border:1px solid ${OBWODKA};border-left:4px solid ${ZIELEN};
        border-radius:10px;padding:14px 16px;">
        <div style="font-size:17px;font-weight:700;color:${ATRAMENT};line-height:1.35;">${esc(b.tytul)}</div>
        <div style="margin-top:5px;font-size:15px;color:${SZARY};line-height:1.45;">${esc(b.szczegoly)}</div>
        </td></tr></table>`;
    case 'lista':
      return `<ul style="margin:0 0 16px;padding-left:20px;font-size:16px;line-height:1.55;color:${ATRAMENT};">`
        + b.punkty.map((p) => `<li style="margin-bottom:6px;">${esc(p)}</li>`).join('')
        + `</ul>`;
    case 'przycisk':
      // Pełna szerokość na telefonie — mail czyta się prawie wyłącznie tam,
      // a przycisk węższy niż kciuk jest przyciskiem tylko z nazwy.
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
        style="margin:4px 0 20px;"><tr><td align="center"
        style="background:${ZIELEN};border-radius:10px;">
        <a href="${esc(b.url)}" style="display:block;padding:14px 20px;font-size:16px;
        font-weight:700;color:#ffffff;text-decoration:none;">${esc(b.etykieta)}</a>
        </td></tr></table>`;
    case 'link':
      return `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:${ATRAMENT};">`
        + `${esc(b.opis)}<br><a href="${esc(b.url)}" style="color:${ZIELEN};font-weight:600;">${esc(b.etykieta)} →</a></p>`;
  }
}

export function doHtml(mail: Mail, cfg: Konfiguracja): string {
  const rok = new Date().getFullYear();
  const domena = cfg.strona.replace(/^https?:\/\//, '');
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(mail.temat)}</title></head>
<body style="margin:0;padding:0;background:${PLOTNO};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(mail.temat)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
  style="background:${PLOTNO};padding:20px 12px;"><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
  style="max-width:560px;background:#ffffff;border:1px solid ${OBWODKA};border-radius:14px;overflow:hidden;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td style="background:${ZIELEN};padding:18px 24px;">
  <a href="${esc(cfg.strona)}" style="font-size:20px;font-weight:700;color:#ffffff;text-decoration:none;">⚽ Bojo</a>
</td></tr>
<tr><td style="padding:24px;">
  <p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:${ATRAMENT};">${esc(mail.naglowek)}</p>
  ${mail.bloki.map(blokHtml).join('\n  ')}
</td></tr>
<tr><td style="background:${PLOTNO};border-top:1px solid ${OBWODKA};padding:16px 24px;">
  <p style="margin:0;font-size:13px;line-height:1.5;color:${SZARY};">
    © ${rok} Bojo · <a href="${esc(cfg.strona)}" style="color:${ZIELEN};text-decoration:none;">${esc(domena)}</a><br>
    Odpisz na tę wiadomość, jeśli coś nie gra — czytamy każdą odpowiedź.
  </p>
</td></tr>
</table></td></tr></table></body></html>`;
}

// ── Treść ──────────────────────────────────────────────────────────────────

export type Powod = 'zapis' | 'zaakceptowano' | 'odrzucono' | 'odwolanie' | 'zmiana'
  | 'jutro_grasz' | 'zaloz_konto' | 'powitanie' | 'oferta'
  | 'mecz_odwolany' | 'zmiana_terminu' | 'zmiana_warunkow_meczu' | 'mecz_przywrocony';

export interface Dane {
  powod: Powod;
  email: string;
  imie: string | null;
  event_id: string;
  tytul: string;
  data: string;
  godzina: string;
  miejsce: string | null;
  koszt_grosz: number | null;
  na_rezerwie: boolean;
  czeka_na_akceptacje?: boolean;
  oferta_do?: string | null;
  ma_konto?: boolean;
  token: string | null;
}

function przywitaj(imie: string | null): string {
  return imie ? `Cześć ${imie}!` : 'Cześć!';
}

function zl(grosze: number | null): string | null {
  if (!grosze || grosze <= 0) return null;
  return `${(grosze / 100).toFixed(2).replace('.', ',')} zł od osoby`;
}

function szczegoly(d: Dane): string {
  const czesci = [`${d.data}, godz. ${d.godzina}`];
  if (d.miejsce) czesci.push(d.miejsce);
  const cena = zl(d.koszt_grosz);
  if (cena) czesci.push(cena);
  return czesci.join(' · ');
}

function kartaMeczu(d: Dane): Blok {
  return { typ: 'mecz', tytul: d.tytul, szczegoly: szczegoly(d) };
}

/** Zamknięcie maila o konkretnym meczu. Gość dostaje link do swojego wpisu,
 *  odbiorca z kontem — link do meczu plus droga wyjścia z tych maili. Bez niej
 *  jedyną reakcją na niechcianą wiadomość jest „Zgłoś spam", a to psuje
 *  doręczalność WSZYSTKICH maili z domeny, łącznie z tymi o odwołanym meczu. */
function zamkniecie(d: Dane, cfg: Konfiguracja): Blok[] {
  if (d.ma_konto) {
    return [
      { typ: 'przycisk', etykieta: 'Zobacz mecz', opis: 'Szczegóły meczu:',
        url: `${cfg.strona}/wydarzenia/${d.event_id}` },
      { typ: 'drobne', tekst: 'Nie chcesz takich maili? Wyłączysz je w ustawieniach powiadomień: '
        + `${cfg.strona}/profil` },
    ];
  }
  return [{
    typ: 'przycisk',
    etykieta: 'Sprawdź skład',
    opis: 'Tym linkiem sprawdzisz skład i wypiszesz się, gdyby coś wypadło:',
    url: wpis(d, cfg),
  }];
}

function wpis(d: Dane, cfg: Konfiguracja): string {
  return d.token ? `${cfg.strona}/gracz/przejmij/${d.token}` : `${cfg.strona}/wydarzenia/${d.event_id}`;
}

export function tresc(d: Dane, cfg: Konfiguracja): Mail | null {
  const naglowek = przywitaj(d.imie);

  switch (d.powod) {
    case 'zapis':
      if (d.czeka_na_akceptacje) {
        return { temat: `Prośba wysłana: ${d.tytul}`, naglowek, bloki: [
          { typ: 'akapit', tekst: 'Twoja prośba o dołączenie czeka na akceptację organizatora:' },
          kartaMeczu(d),
          { typ: 'akapit', tekst: 'Damy znać mailem, gdy organizator ją rozpatrzy. Do tego czasu nie masz jeszcze miejsca w składzie.' },
          ...zamkniecie(d, cfg),
        ] };
      }
      if (d.na_rezerwie) {
        return { temat: `Jesteś na rezerwie: ${d.tytul}`, naglowek, bloki: [
          { typ: 'akapit', tekst: 'Jesteś na liście rezerwowej meczu:' },
          kartaMeczu(d),
          { typ: 'akapit', tekst: 'Damy znać, gdy zwolni się miejsce.' },
          ...zamkniecie(d, cfg),
        ] };
      }
      return { temat: `Jesteś zapisany: ${d.tytul}`, naglowek, bloki: [
        { typ: 'akapit', tekst: 'Masz miejsce w składzie:' },
        kartaMeczu(d),
        { typ: 'akapit', tekst: 'Dzień przed meczem przypomnimy Ci o nim mailem.' },
        ...zamkniecie(d, cfg),
      ] };

    case 'zaakceptowano':
      return { temat: `Jesteś w składzie: ${d.tytul}`, naglowek, bloki: [
        { typ: 'akapit', tekst: 'Organizator przyjął Twoją prośbę — masz miejsce w składzie:' },
        kartaMeczu(d),
        { typ: 'akapit', tekst: 'Dzień przed meczem przypomnimy Ci o nim mailem.' },
        ...zamkniecie(d, cfg),
      ] };

    case 'odrzucono':
      return { temat: `Nie tym razem: ${d.tytul}`, naglowek, bloki: [
        { typ: 'akapit', tekst: 'Organizator nie przyjął Twojej prośby o dołączenie do meczu:' },
        kartaMeczu(d),
        { typ: 'akapit', tekst: 'Nie przyjeżdżaj na boisko.' },
        { typ: 'przycisk', etykieta: 'Otwarte mecze w okolicy',
          opis: 'Otwarte mecze w okolicy znajdziesz tutaj:', url: `${cfg.strona}/wydarzenia` },
      ] };

    case 'oferta':
      return { temat: `Zwolniło się miejsce: ${d.tytul}`, naglowek, bloki: [
        { typ: 'akapit', tekst: 'Ktoś się wypisał i miejsce jest Twoje, jeśli je potwierdzisz:' },
        kartaMeczu(d),
        { typ: 'akapit', tekst: d.oferta_do
          ? `Masz czas do ${d.oferta_do}. Później miejsce przejdzie do kolejnej osoby, a Ty wrócisz na koniec kolejki.`
          : 'Potwierdź jak najszybciej — miejsce czeka tylko przez chwilę.' },
        { typ: 'przycisk', etykieta: 'Potwierdzam, gram', opis: 'Potwierdzasz tym linkiem:', url: wpis(d, cfg) },
      ] };

    case 'odwolanie':
    case 'mecz_odwolany':
      return { temat: `Mecz odwołany: ${d.tytul}`, naglowek, bloki: [
        { typ: 'akapit', tekst: 'Organizator odwołał ten mecz:' },
        kartaMeczu(d),
        { typ: 'akapit', tekst: 'Nie przyjeżdżaj na boisko.' },
        ...zamkniecie(d, cfg),
      ] };

    case 'zmiana':
      return { temat: `Zmiana w meczu: ${d.tytul}`, naglowek, bloki: [
        { typ: 'akapit', tekst: 'Coś się zmieniło w meczu, na który jesteś zapisany. Aktualne dane:' },
        kartaMeczu(d),
        ...zamkniecie(d, cfg),
      ] };

    case 'zmiana_terminu':
      return { temat: `Nowy termin: ${d.tytul}`, naglowek, bloki: [
        { typ: 'akapit', tekst: 'Organizator zmienił termin meczu, na który jesteś zapisany. Nowy termin:' },
        kartaMeczu(d),
        { typ: 'akapit', tekst: 'Jeśli nowy termin Ci nie pasuje — wypisz się, żeby ktoś zdążył wejść na Twoje miejsce.' },
        ...zamkniecie(d, cfg),
      ] };

    case 'zmiana_warunkow_meczu':
      return { temat: `Zmiana w meczu: ${d.tytul}`, naglowek, bloki: [
        { typ: 'akapit', tekst: 'Zmieniło się miejsce albo koszt meczu, na który jesteś zapisany. Aktualne dane:' },
        kartaMeczu(d),
        ...zamkniecie(d, cfg),
      ] };

    case 'mecz_przywrocony':
      return { temat: `Jednak gramy: ${d.tytul}`, naglowek, bloki: [
        { typ: 'akapit', tekst: 'Dostałeś wcześniej wiadomość, że ten mecz jest odwołany. Organizator cofnął odwołanie — mecz się odbędzie:' },
        kartaMeczu(d),
        { typ: 'akapit', tekst: 'Twoje miejsce w składzie zostało nietknięte. Jeśli zdążyłeś zaplanować coś innego — wypisz się, żeby ktoś mógł wejść na Twoje miejsce.' },
        ...zamkniecie(d, cfg),
      ] };

    case 'jutro_grasz':
      return { temat: `Jutro grasz: ${d.tytul}`, naglowek, bloki: [
        { typ: 'akapit', tekst: 'Jutro masz mecz:' },
        kartaMeczu(d),
        { typ: 'akapit', tekst: 'Jeśli nie dasz rady — daj znać jak najszybciej, żeby ktoś zdążył wejść na Twoje miejsce.' },
        ...zamkniecie(d, cfg),
      ] };

    case 'zaloz_konto':
      // ŚWIADOMIE CZWARTY W KOLEJNOŚCI, nie pierwszy: to jedyny mail, który
      // czegoś CHCE, a nie o czymś informuje. Wysłany jako pierwszy kontakt od
      // nieznanego nadawcy czytałby się jak spam niezależnie od treści.
      return { temat: 'Zagrałeś wczoraj — zapisz sobie to miejsce', naglowek, bloki: [
        { typ: 'akapit', tekst: 'Wczoraj grałeś w meczu:' },
        kartaMeczu(d),
        { typ: 'akapit', tekst: 'Zapisałeś się bez konta, więc za każdym razem podajesz imię i mail od nowa, a organizator nie ma jak Cię dopisać na kolejny termin jednym kliknięciem.' },
        { typ: 'akapit', tekst: 'Konto w Bojo zajmuje chwilę i daje trzy rzeczy:' },
        { typ: 'lista', punkty: [
          'zapisujesz się jednym kliknięciem, bez wpisywania danych',
          'widzisz wszystkie swoje mecze w jednym miejscu',
          'dostajesz powiadomienie, gdy coś się zmieni albo zwolni się miejsce',
        ] },
        { typ: 'przycisk', etykieta: 'Załóż konto',
          opis: 'Zakładasz je tutaj, a Twój wczorajszy zapis przypisze się do niego:', url: wpis(d, cfg) },
      ] };

    case 'powitanie':
      // JEDYNY mail, który NIE dotyczy konkretnego meczu — stąd brak karty
      // meczu i brak zamknięcia z linkiem do wpisu.
      //
      // Kolejność jest wyborem: NAJPIERW stworzenie meczu, bo to jedyna droga,
      // która działa w dniu zero, bez żadnego innego użytkownika po drugiej
      // stronie. Grupa jest druga, bo wciąga więcej ludzi naraz, ale wymaga
      // ekipy, którą trzeba już mieć. Szukanie gry jest trzecie i jest
      // uczciwie oznaczone jako to, na co dziś nie ma co liczyć.
      return { temat: 'Konto w Bojo gotowe — pierwszy mecz zajmie dwie minuty', naglowek, bloki: [
        { typ: 'akapit', tekst: 'Konto założone. Bojo służy do jednego: organizujesz mecz i wysyłasz ekipie jeden link. Kto go dostanie, zapisuje się sam — bez zakładania konta.' },
        { typ: 'akapit', tekst: 'Co Bojo liczy za Ciebie:' },
        { typ: 'lista', punkty: [
          'skład i limit miejsc',
          'listę rezerwową z widoczną kolejnością',
          'koszt wynajmu podzielony na graczy i to, kto jeszcze nie oddał',
          'przypomnienie o meczu dzień wcześniej',
        ] },
        { typ: 'przycisk', etykieta: 'Utwórz pierwszy mecz', opis: 'Zacznij tutaj:',
          url: `${cfg.strona}/wydarzenia/nowe` },
        { typ: 'link', etykieta: 'Załóż grupę',
          opis: 'Grasz stałą ekipą? Załóż grupę — wchodzi się do niej jednym linkiem, a każdy nowy mecz widzą wszyscy:',
          url: `${cfg.strona}/grupy/nowe` },
        { typ: 'link', etykieta: 'Zobacz otwarte mecze',
          opis: 'Szukasz gry, a nie ekipy? Otwarte mecze są tutaj:',
          url: `${cfg.strona}/wydarzenia` },
        // Prośbę o odpowiedź niesie stopka KAŻDEGO maila, więc drugi raz w treści
        // była powtórzeniem — widać to dopiero na złożonej wiadomości, nie w kodzie.
        { typ: 'drobne', tekst: 'Bojo dopiero się rozkręca, więc otwartych meczów bywa mało — najszybciej zagrasz, tworząc mecz i wysyłając link znajomym.' },
      ] };

    default:
      return null;
  }
}
