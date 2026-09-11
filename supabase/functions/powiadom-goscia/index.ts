import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { type Dane, doHtml, doTekstu, tresc } from './tresc.ts';

/**
 * Poczta Bojo — wysyłka.
 *
 * KTO TO WOŁA: baza, przez `pg_net` — funkcja `wyslij_mail_do_goscia()`
 * z migracji `133`. Nie aplikacja: mail o odwołaniu meczu powstaje wtedy, gdy
 * organizator klika „Odwołaj", a odbiorca jest wtedy zupełnie gdzie indziej.
 *
 * PO CO TO ISTNIEJE: goście bez konta to ćwierć wpisów w składach, a Bojo nie
 * wysyłało im NICZEGO — ani przypomnienia, ani wiadomości o odwołaniu meczu.
 * Adres e-mail był zbierany przy zapisie i nieużywany. Skutki brał na siebie
 * organizator: skład kłamał w tej części, którą sam przyprowadził.
 *
 * TREŚĆ SIEDZI W `tresc.ts` — jedno źródło dla wersji tekstowej i graficznej,
 * czyste TS bez `Deno`, więc testowane Vitestem razem z resztą repo. Tutaj
 * zostaje wyłącznie to, czego nie da się przetestować bez sieci.
 *
 * UWIERZYTELNIENIE nagłówkiem `x-bojo-sekret`, tak jak w `send-push` —
 * wołający jest bazą danych, nie człowiekiem. Funkcja MUSI być wdrożona
 * z `--no-verify-jwt`, inaczej Supabase odrzuci wywołanie z bazy.
 *
 * WYMAGANE ZMIENNE (Supabase → Edge Functions → Secrets):
 *   RESEND_API_KEY     — bez niego funkcja NIC nie wysyła i kończy 200.
 *   BOJO_POCZTA_SEKRET — ta sama wartość co w `konfiguracja_poczty`.
 *   BOJO_NADAWCA       — np. "Bojo <noreply@bojo.pl>".
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

  const cfg = { strona: STRONA };
  const mail = tresc(dane, cfg);
  if (!mail) return new Response(JSON.stringify({ pominiete: 'nieznany powod' }), { status: 200 });

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: NADAWCA,
        reply_to: ODPOWIEDZ_NA,
        to: [dane.email],
        subject: mail.temat,
        // OBIE wersje. `text` nie jest zapasem na wszelki wypadek: mail bez
        // niego jest przez filtry antyspamowe traktowany gorzej, a dla
        // czytnika ekranu i klienta z wyłączonymi obrazkami bywa jedyną
        // czytelną wersją.
        html: doHtml(mail, cfg),
        text: doTekstu(mail),
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
