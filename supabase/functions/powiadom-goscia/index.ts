import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

/**
 * Poczta do gościa bez konta.
 *
 * KTO TO WOŁA: baza, przez `pg_net` — funkcja `wyslij_mail_do_goscia()`
 * z migracji `132`. Nie aplikacja: mail o odwołaniu meczu powstaje wtedy, gdy
 * organizator klika „Odwołaj", a gość jest wtedy zupełnie gdzie indziej.
 *
 * PO CO TO ISTNIEJE: goście bez konta to ćwierć wpisów w składach, a Bojo nie
 * wysyłało im NICZEGO — ani przypomnienia, ani wiadomości o odwołaniu meczu.
 * Adres e-mail był zbierany przy zapisie i nieużywany. Skutki brał na siebie
 * organizator: skład kłamał w tej części, którą sam przyprowadził.
 *
 * UWIERZYTELNIENIE nagłówkiem `x-bojo-sekret`, tak jak w `send-push` —
 * wołający jest bazą danych, nie człowiekiem. Funkcja MUSI być wdrożona
 * z `--no-verify-jwt`, inaczej Supabase odrzuci wywołanie z bazy.
 *
 * WYMAGANE ZMIENNE (Supabase → Edge Functions → Secrets):
 *   RESEND_API_KEY     — bez niego funkcja NIC nie wysyła i kończy 200.
 *   BOJO_POCZTA_SEKRET — ta sama wartość co w `konfiguracja_poczty`.
 *   BOJO_NADAWCA       — np. "Bojo <noreply@bojo.pl>".
 *
 * ⚠️ DOMENA NADAWCY. Domeną kanoniczną jest `bojo.pl`, a historycznym nadawcą
 * `noreply@bojo.app`. Maile z domeny innej niż strona częściej lądują w spamie,
 * więc przed włączeniem kanału trzeba zweryfikować `bojo.pl` w Resend (SPF +
 * DKIM). Do tego czasu brak `RESEND_API_KEY` sprawia, że kanał po prostu
 * milczy — i nic się przez to nie psuje.
 */

const RESEND = Deno.env.get('RESEND_API_KEY') ?? '';
const SEKRET = Deno.env.get('BOJO_POCZTA_SEKRET') ?? '';
const NADAWCA = Deno.env.get('BOJO_NADAWCA') ?? 'Bojo <noreply@bojo.pl>';
const STRONA = Deno.env.get('BOJO_URL') ?? 'https://bojo.pl';
/** Adres, na który trafi ODPOWIEDŹ na maila. Ta sama wartość co
 *  `LEGAL.contactEmail` w aplikacji (regulamin, polityka prywatności).
 *
 *  PO CO. Nadawcą jest `noreply@`, więc dotąd każdy mail kończył się odesłaniem
 *  na `/zglos-blad` — formularz, do którego trzeba przejść, zalogować się
 *  i napisać od nowa. W fazie, w której zbieramy pierwszych organizatorów,
 *  odpowiedź na maila jest najtańszym kanałem opinii, jaki mamy, a każde
 *  dodatkowe kliknięcie po drodze zabiera większość odpowiedzi. */
const ODPOWIEDZ_NA = Deno.env.get('BOJO_ODPOWIEDZ_NA') ?? 'bojopolska@gmail.com';

type Powod = 'zapis' | 'zaakceptowano' | 'odrzucono' | 'odwolanie' | 'zmiana'
  | 'jutro_grasz' | 'zaloz_konto' | 'powitanie' | 'oferta'
  // Powody dla odbiorcy Z KONTEM (migracja `140`). Nazwy są DOKŁADNIE typami
  // powiadomień z tabeli `notifications` — dzięki temu baza nie tłumaczy
  // niczego po drodze, a ledger `maile_wyslane` trzyma ten sam klucz, który
  // widać pod dzwonkiem.
  | 'mecz_odwolany' | 'zmiana_terminu' | 'zmiana_warunkow_meczu' | 'mecz_przywrocony';

interface Dane {
  powod: Powod;
  email: string;
  /** Puste dla konta bez podanej nazwy — patrz `powitanie` niżej. */
  imie: string | null;
  event_id: string;
  tytul: string;
  data: string;
  godzina: string;
  miejsce: string | null;
  koszt_grosz: number | null;
  na_rezerwie: boolean;
  /** Zapis czeka na akceptację organizatora (migracja `115`). Do 2026-09-08
   *  pole NIE BYŁO przekazywane, choć baza je odczytywała — więc gość
   *  w poczekalni dostawał „Masz miejsce w składzie". Nieprawda. */
  czeka_na_akceptacje?: boolean;
  /** Do kiedy stoi oferta zwolnionego miejsca — gotowy tekst z bazy
   *  („07.09, godz. 21:30"), bo tylko ona zna okno i strefę meczu. */
  oferta_do?: string | null;
  /** Odbiorca MA KONTO w Bojo (migracja `140`). Zmienia stopkę: zamiast linku
   *  do wpisu gościa idzie link do meczu i informacja, jak te maile wyłączyć.
   *  Gość bez konta nie ma czego wyłączać — nie ma ustawień. */
  ma_konto?: boolean;
  token: string | null;
}

/** „Cześć Marek!" albo samo „Cześć!" — konto z Google bez nazwy własnej nie ma
 *  imienia, a „Cześć null!" jest gorsze niż brak imienia. */
function powitanie(imie: string | null): string {
  return imie ? `Cześć ${imie}!` : 'Cześć!';
}

function zl(grosze: number | null): string | null {
  if (!grosze || grosze <= 0) return null;
  return `${(grosze / 100).toFixed(2).replace('.', ',')} zł od osoby`;
}

/** Jedna linijka podsumowania meczu — ta sama kolejność co w tekście
 *  udostępniania (`lib/eventShare.ts`): co, kiedy, gdzie, ile. */
function podsumowanie(d: Dane): string {
  const czesci = [`${d.data}, godz. ${d.godzina}`];
  if (d.miejsce) czesci.push(d.miejsce);
  const cena = zl(d.koszt_grosz);
  if (cena) czesci.push(cena);
  return czesci.join(' · ');
}

/** Treści są tu, a nie w bazie: mail to komunikat do człowieka, a nie dana.
 *  Zero języka marketingowego — to ma czytać się jak wiadomość od organizatora,
 *  nie jak reklama aplikacji (ta sama zasada co przy `eventShareText`). */
function tresc(d: Dane): { temat: string; tekst: string } | null {
  const link = d.token ? `${STRONA}/gracz/przejmij/${d.token}` : `${STRONA}/wydarzenia/${d.event_id}`;
  const stopka = d.ma_konto
    // ODBIORCA Z KONTEM. Dostaje link do meczu (wpisu gościa nie ma) oraz —
    // wymóg elementarnej uczciwości przy kanale, którego nikt nie zamawiał —
    // jednozdaniową drogę wyjścia. Bez niej pierwszą reakcją na niechciany
    // mail jest „Zgłoś spam", a to psuje doręczalność WSZYSTKICH maili z domeny,
    // łącznie z tymi o odwołanym meczu.
    ? `\n\nSzczegóły meczu:\n${STRONA}/wydarzenia/${d.event_id}\n\n`
      + `Nie chcesz takich maili? Wyłączysz je w ustawieniach powiadomień:\n${STRONA}/profil\n`
    : `\n\nTym linkiem sprawdzisz skład i wypiszesz się, gdyby coś wypadło:\n${link}\n`;

  switch (d.powod) {
    case 'zapis':
      // TRZY STANY, NIE DWA. Do 2026-09-08 były dwa (skład / rezerwa), więc
      // gość, którego zapis czeka na akceptację organizatora (`115`), czytał
      // „Masz miejsce w składzie" — a miejsca nie miał i mógł go nie dostać.
      return {
        temat: d.czeka_na_akceptacje
          ? `Prośba wysłana: ${d.tytul}`
          : `Jesteś zapisany: ${d.tytul}`,
        tekst:
          `${powitanie(d.imie)}\n\n` +
          (d.czeka_na_akceptacje
            ? `Twoja prośba o dołączenie czeka na akceptację organizatora:\n` +
              `${d.tytul}\n${podsumowanie(d)}\n\n` +
              `Damy znać mailem, gdy organizator ją rozpatrzy. Do tego czasu ` +
              `nie masz jeszcze miejsca w składzie.`
            : d.na_rezerwie
              ? `Jesteś na liście rezerwowej meczu:\n${d.tytul}\n${podsumowanie(d)}\n\n` +
                `Damy znać, gdy zwolni się miejsce.`
              : `Masz miejsce w składzie:\n${d.tytul}\n${podsumowanie(d)}\n\n` +
                `Dzień przed meczem przypomnimy Ci o nim mailem.`) + stopka,
      };
    case 'zaakceptowano':
      // Gość NIE dostawał o tym nic: `powiadom_o_akceptacji` (`076`) wymaga
      // konta, a poczta z `133` takiego powodu nie miała. Jedynym wyjściem było
      // wracanie na stronę wpisu i sprawdzanie.
      return {
        temat: `Jesteś w składzie: ${d.tytul}`,
        tekst:
          `${powitanie(d.imie)}\n\n` +
          `Organizator przyjął Twoją prośbę — masz miejsce w składzie:\n` +
          `${d.tytul}\n${podsumowanie(d)}\n\n` +
          `Dzień przed meczem przypomnimy Ci o nim mailem.` + stopka,
      };
    case 'odrzucono':
      return {
        temat: `Nie tym razem: ${d.tytul}`,
        tekst:
          `${powitanie(d.imie)}\n\n` +
          `Organizator nie przyjął Twojej prośby o dołączenie do meczu:\n` +
          `${d.tytul}\n${podsumowanie(d)}\n\n` +
          `Nie przyjeżdżaj na boisko. Otwarte mecze w okolicy znajdziesz tutaj:\n` +
          `${STRONA}/wydarzenia\n`,
      };
    case 'oferta':
      // Gość na rezerwie do migracji `137` był w kolejce POMIJANY — oferta szła
      // wyłącznie przez `notifications`, a te wymagają konta. Mail `zapis`
      // obiecywał mu przy tym „damy znać, gdy zwolni się miejsce".
      return {
        temat: `Zwolniło się miejsce: ${d.tytul}`,
        tekst:
          `${powitanie(d.imie)}\n\n` +
          `Ktoś się wypisał i miejsce jest Twoje, jeśli je potwierdzisz:\n` +
          `${d.tytul}\n${podsumowanie(d)}\n\n` +
          (d.oferta_do
            ? `Masz czas do ${d.oferta_do}. Później miejsce przejdzie do kolejnej ` +
              `osoby, a Ty wrócisz na koniec kolejki.\n`
            : `Potwierdź jak najszybciej — miejsce czeka tylko przez chwilę.\n`) +
          `\nPotwierdzasz tym linkiem:\n` +
          `${d.token ? `${STRONA}/gracz/przejmij/${d.token}` : `${STRONA}/wydarzenia/${d.event_id}`}\n`,
      };
    case 'odwolanie':
      return {
        temat: `Mecz odwołany: ${d.tytul}`,
        tekst:
          `${powitanie(d.imie)}\n\n` +
          `Organizator odwołał ten mecz:\n${d.tytul}\n${podsumowanie(d)}\n\n` +
          `Nie przyjeżdżaj na boisko.` + stopka,
      };
    case 'zmiana':
      return {
        temat: `Zmiana w meczu: ${d.tytul}`,
        tekst:
          `${powitanie(d.imie)}\n\n` +
          `Coś się zmieniło w meczu, na który jesteś zapisany. Aktualne dane:\n` +
          `${d.tytul}\n${podsumowanie(d)}` + stopka,
      };
    case 'jutro_grasz':
      return {
        temat: `Jutro grasz: ${d.tytul}`,
        tekst:
          `${powitanie(d.imie)}\n\n` +
          `Jutro masz mecz:\n${d.tytul}\n${podsumowanie(d)}\n\n` +
          `Jeśli nie dasz rady — daj znać jak najszybciej, żeby ktoś zdążył wejść na Twoje miejsce.` +
          stopka,
      };
    case 'zaloz_konto':
      // ŚWIADOMIE CZWARTY W KOLEJNOŚCI, nie pierwszy: to jedyny mail, który
      // czegoś CHCE, a nie o czymś informuje. Wysłany jako pierwszy kontakt od
      // nieznanego nadawcy czytałby się jak spam niezależnie od treści.
      // Odwołuje się do tego, co się właśnie wydarzyło, zamiast zachwalać apkę.
      return {
        temat: 'Zagrałeś wczoraj — zapisz sobie to miejsce',
        tekst:
          `${powitanie(d.imie)}\n\n` +
          `Wczoraj grałeś w meczu: ${d.tytul} (${podsumowanie(d)}).\n\n` +
          `Zapisałeś się bez konta, więc za każdym razem podajesz imię i mail od nowa, ` +
          `a organizator nie ma jak Cię dopisać na kolejny termin jednym kliknięciem.\n\n` +
          `Konto w Bojo zajmuje chwilę i daje trzy rzeczy:\n` +
          `— zapisujesz się jednym kliknięciem, bez wpisywania danych,\n` +
          `— widzisz wszystkie swoje mecze w jednym miejscu,\n` +
          `— dostajesz powiadomienie, gdy coś się zmieni albo zwolni się miejsce.\n\n` +
          `Zakładasz je tutaj, a Twój wczorajszy zapis przypisze się do niego:\n${link}\n`,
      };
    // ── Powody dla odbiorcy Z KONTEM (migracja `140`) ──────────────────────
    //
    // Osobne szablony, nie aliasy `odwolanie`/`zmiana`, z dwóch powodów.
    // Pierwszy: temat maila jest tym, co człowiek czyta na liście w telefonie,
    // a „Zmiana w meczu" i „Nowy termin" to dla planującego tydzień DWIE różne
    // wiadomości. Drugi: `mecz_przywrocony` nie ma odpowiednika wśród powodów
    // gościa — prostuje wcześniejszą złą wiadomość, więc musi się do niej
    // wprost odnieść, inaczej czyta się jak zaproszenie na nowy mecz.
    case 'mecz_odwolany':
      return {
        temat: `Mecz odwołany: ${d.tytul}`,
        tekst:
          `${powitanie(d.imie)}\n\n` +
          `Organizator odwołał ten mecz:\n${d.tytul}\n${podsumowanie(d)}\n\n` +
          `Nie przyjeżdżaj na boisko.` + stopka,
      };
    case 'zmiana_terminu':
      return {
        temat: `Nowy termin: ${d.tytul}`,
        tekst:
          `${powitanie(d.imie)}\n\n` +
          `Organizator zmienił termin meczu, na który jesteś zapisany.\n` +
          `Nowy termin:\n${d.tytul}\n${podsumowanie(d)}\n\n` +
          `Jeśli nowy termin Ci nie pasuje — wypisz się, żeby ktoś zdążył wejść na Twoje miejsce.` +
          stopka,
      };
    case 'zmiana_warunkow_meczu':
      return {
        temat: `Zmiana w meczu: ${d.tytul}`,
        tekst:
          `${powitanie(d.imie)}\n\n` +
          `Zmieniło się miejsce albo koszt meczu, na który jesteś zapisany. Aktualne dane:\n` +
          `${d.tytul}\n${podsumowanie(d)}` + stopka,
      };
    case 'mecz_przywrocony':
      return {
        temat: `Jednak gramy: ${d.tytul}`,
        tekst:
          `${powitanie(d.imie)}\n\n` +
          `Dostałeś wcześniej wiadomość, że ten mecz jest odwołany. Organizator cofnął ` +
          `odwołanie — mecz się odbędzie:\n${d.tytul}\n${podsumowanie(d)}\n\n` +
          `Twoje miejsce w składzie zostało nietknięte. Jeśli zdążyłeś zaplanować coś ` +
          `innego — wypisz się, żeby ktoś mógł wejść na Twoje miejsce.` + stopka,
      };
    case 'powitanie':
      // JEDYNY mail, który NIE dotyczy konkretnego meczu — stąd brak `podsumowanie()`
      // i brak `stopka` z linkiem do wpisu.
      //
      // Trzy rzeczy, których tu świadomie NIE ma:
      // 1. Zachwalania. To ma czytać się jak instrukcja od kogoś, kto wie, po co
      //    przyszedłeś — nie jak reklama (ta sama zasada co przy `eventShareText`).
      // 2. Obietnicy pełnej półki otwartych gier. Bojo jest na wczesnym etapie
      //    i landing mówi to wprost plakietką „Wczesny etap"; mail nie może
      //    obiecywać więcej niż strona, bo pierwsze rozczarowanie jest ostatnie.
      // 3. Listy słów kluczowych i „dołącz do tysięcy graczy" — Bojo ma dziś
      //    kilkunastu organizatorów i mail nie może udawać, że jest inaczej.
      //
      // ZMIANA 2026-09-08: mail KOŃCZY SIĘ PROŚBĄ O ODPOWIEDŹ. Wcześniej było
      // tu odesłanie na `/zglos-blad`, bo nadawcą jest `noreply@` — ale od tej
      // zmiany wychodzi nagłówek `reply_to` z adresem kontaktowym z regulaminu,
      // więc odpowiedź realnie dociera. W fazie zbierania pierwszych
      // organizatorów ich opinia jest warta więcej niż każda poprawka treści,
      // a formularz za logowaniem zabiera większość odpowiedzi.
      //
      // Kolejność jest wyborem: NAJPIERW stworzenie meczu, bo to jedyna droga,
      // która działa w dniu zero, bez żadnego innego użytkownika po drugiej
      // stronie. Grupa jest druga, bo wciąga więcej ludzi naraz, ale wymaga
      // ekipy, którą trzeba już mieć. Szukanie gry jest trzecie i jest
      // uczciwie oznaczone jako to, na co dziś nie ma co liczyć.
      return {
        temat: 'Konto w Bojo gotowe — pierwszy mecz zajmie dwie minuty',
        tekst:
          `${powitanie(d.imie)}\n\n` +
          `Konto założone. Bojo służy do jednego: organizujesz mecz i wysyłasz ekipie ` +
          `jeden link. Kto go dostanie, zapisuje się sam — bez zakładania konta.\n\n` +
          `Co Bojo liczy za Ciebie:\n` +
          `— skład i limit miejsc,\n` +
          `— listę rezerwową z widoczną kolejnością,\n` +
          `— koszt wynajmu podzielony na graczy i to, kto jeszcze nie oddał,\n` +
          `— przypomnienie o meczu dzień wcześniej.\n\n` +
          `Zacznij tutaj:\n${STRONA}/wydarzenia/nowe\n\n` +
          `Grasz stałą ekipą? Załóż grupę — wchodzi się do niej jednym linkiem, ` +
          `a każdy nowy mecz widzą wszyscy:\n${STRONA}/grupy/nowe\n\n` +
          `Szukasz gry, a nie ekipy? Otwarte mecze są tutaj:\n${STRONA}/wydarzenia\n` +
          `Bojo dopiero się rozkręca, więc bywa ich mało — najszybciej zagrasz, ` +
          `tworząc mecz i wysyłając link znajomym.\n\n` +
          `Coś nie działa albo czegoś brakuje? Odpisz na tego maila — czytamy ` +
          `każdą odpowiedź.\n\n` +
          `— zespół Bojo\n${STRONA}\n`,
      };
    default:
      return null;
  }
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!SEKRET || req.headers.get('x-bojo-sekret') !== SEKRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const dane = (await req.json().catch(() => null)) as Dane | null;
  if (!dane?.email || !dane?.powod) {
    return new Response(JSON.stringify({ pominiete: 'brak danych' }), { status: 200 });
  }

  if (!RESEND) {
    // Brak klucza to stan wdrożenia, nie błąd żądania. 200, żeby `pg_net` nie
    // ponawiał w nieskończoność — i żeby brak skonfigurowanej poczty NIGDY nie
    // wyglądał jak awaria po stronie bazy.
    console.warn('[powiadom-goscia] brak RESEND_API_KEY — nie wysyłam');
    return new Response(JSON.stringify({ pominiete: 'brak klucza' }), { status: 200 });
  }

  const t = tresc(dane);
  if (!t) return new Response(JSON.stringify({ pominiete: 'nieznany powod' }), { status: 200 });

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: NADAWCA,
        reply_to: ODPOWIEDZ_NA,
        to: [dane.email],
        subject: t.temat,
        text: t.tekst,
        // Nagłówek dla klienta pocztowego — Gmail rysuje z niego przycisk
        // „Wypisz się" obok nadawcy. Bez niego jedyną dostępną reakcją na
        // niechciany mail jest „Zgłoś spam", co obniża doręczalność całej
        // domeny. Tylko dla odbiorcy z kontem: gość nie ma ustawień, do
        // których ten link miałby prowadzić.
        ...(dane.ma_konto
          ? { headers: { 'List-Unsubscribe': `<${STRONA}/profil>` } }
          : {}),
      }),
    });
    if (!res.ok) console.error('[powiadom-goscia] Resend', res.status, await res.text());
    return new Response(JSON.stringify({ wyslane: res.ok }), { status: 200 });
  } catch (e) {
    console.error('[powiadom-goscia]', e);
    return new Response(JSON.stringify({ wyslane: false }), { status: 200 });
  }
});
