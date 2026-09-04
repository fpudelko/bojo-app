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

type Powod = 'zapis' | 'odwolanie' | 'zmiana' | 'jutro_grasz' | 'zaloz_konto' | 'powitanie';

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
  const stopka =
    `\n\nTym linkiem sprawdzisz skład i wypiszesz się, gdyby coś wypadło:\n${link}\n`;

  switch (d.powod) {
    case 'zapis':
      return {
        temat: `Jesteś zapisany: ${d.tytul}`,
        tekst:
          `${powitanie(d.imie)}\n\n` +
          (d.na_rezerwie
            ? `Jesteś na liście rezerwowej meczu:\n${d.tytul}\n${podsumowanie(d)}\n\n` +
              `Damy znać, gdy zwolni się miejsce.`
            : `Masz miejsce w składzie:\n${d.tytul}\n${podsumowanie(d)}`) +
          `\n\nDzień przed meczem przypomnimy Ci o nim mailem.` + stopka,
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
      // 3. Prośby o odpowiedź na maila — nadawcą jest `noreply@`, więc odpowiedź
      //    nigdzie by nie dotarła. Zamiast tego link do `/zglos-blad`.
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
          `jeden link. Kto go dostanie, zapisuje się sam — nawet bez zakładania konta.\n\n` +
          `Co Bojo robi za Ciebie:\n` +
          `— liczy skład i pilnuje limitu miejsc,\n` +
          `— prowadzi listę rezerwową z widoczną kolejnością,\n` +
          `— dzieli koszt wynajmu na graczy i pokazuje, kto jeszcze nie oddał,\n` +
          `— przypomina wszystkim o meczu dzień wcześniej.\n\n` +
          `Zacznij tutaj:\n${STRONA}/wydarzenia/nowe\n\n` +
          `Grasz stałą ekipą? Załóż grupę — wchodzi się do niej jednym linkiem, ` +
          `a każdy nowy mecz widzą wszyscy:\n${STRONA}/grupy/nowe\n\n` +
          `Szukasz gry, a nie ekipy? Otwarte mecze są tutaj:\n${STRONA}/wydarzenia\n` +
          `Bojo dopiero się rozkręca, więc bywa ich mało — najszybciej zagrasz, ` +
          `tworząc mecz i wysyłając link znajomym.\n\n` +
          `Coś nie działa albo czegoś brakuje? Napisz:\n${STRONA}/zglos-blad\n`,
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
        to: [dane.email],
        subject: t.temat,
        text: t.tekst,
      }),
    });
    if (!res.ok) console.error('[powiadom-goscia] Resend', res.status, await res.text());
    return new Response(JSON.stringify({ wyslane: res.ok }), { status: 200 });
  } catch (e) {
    console.error('[powiadom-goscia]', e);
    return new Response(JSON.stringify({ wyslane: false }), { status: 200 });
  }
});
