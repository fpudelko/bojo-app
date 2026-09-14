import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

/**
 * JEDNORAZOWA funkcja ratunkowa: wypisuje PUBLICZNY klucz VAPID.
 *
 * PO CO POWSTAŁA: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` zniknął ze zmiennych Vercela,
 * a panel Supabase pokazuje sekrety funkcji obcięte wielokropkiem. Klucz
 * publiczny MUSI być identyczny po obu stronach — przeglądarka zakłada nim
 * subskrypcję, serwer podpisuje odpowiadającym mu prywatnym. Wpisanie „jakiegoś"
 * klucza wygląda na działające do momentu pierwszej wysyłki.
 *
 * DLACZEGO TO NIE JEST WYCIEK: zwracana wartość z definicji jest jawna —
 * siedzi w paczce JS każdej strony bojo.pl i w każdej subskrypcji push
 * w przeglądarce użytkownika. Klucz PRYWATNY nie jest tu nigdzie czytany
 * (`VAPID_PRIVATE_KEY` nie pojawia się w tym pliku poza sprawdzeniem, czy
 * w ogóle istnieje) i nie ma jak wyjść tą drogą.
 *
 * DO SKASOWANIA PO UŻYCIU. Usunięcie katalogu z repo NIE kasuje wdrożonej
 * funkcji — trzeba ją usunąć w panelu: Supabase → Edge Functions → `klucz-push`
 * → Delete. Dopóki żyje, każdy, kto zna adres, odczyta z niej klucz publiczny;
 * to nic nie psuje, ale nie ma powodu tego zostawiać.
 *
 * WDRAŻANA ZE ZWYKŁĄ WERYFIKACJĄ TOKENU (domyślną) — nie dopisujemy jej do listy
 * `BEZ_JWT` w `.github/workflows/wdroz-funkcje.yml`. Tamta lista istnieje dla
 * funkcji wołanych PRZEZ BAZĘ (`send-push`, `powiadom-goscia`), które nie mają
 * czyjego tokenu podać; ratunkowy odczyt jawnej wartości to za słaby powód,
 * żeby otwierać kolejny adres na oścież.
 *
 * Wołanie wymaga więc nagłówka z kluczem `anon` (tym samym, który i tak siedzi
 * w paczce JS strony):
 *
 *   curl -H "Authorization: Bearer <ANON_KEY>" \
 *     https://<project-ref>.functions.supabase.co/klucz-push
 *
 * Z telefonu wygodniej przez panel: Supabase → Edge Functions → `klucz-push`
 * → zakładka testowa („Invoke"/„Test"), która podstawia ten nagłówek sama.
 */

const PUBLICZNY = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const MA_PRYWATNY = (Deno.env.get('VAPID_PRIVATE_KEY') ?? '').length > 0;

serve(() => {
  if (!PUBLICZNY) {
    // Sekret o tej nazwie nie istnieje w tym projekcie. To odpowiedź na pytanie
    // „czy on tam w ogóle jest", a nie awaria funkcji — stąd 404, nie 500.
    return new Response(
      JSON.stringify({
        blad: 'Brak sekretu VAPID_PUBLIC_KEY w tym projekcie Supabase.',
        maPrywatny: MA_PRYWATNY,
        coDalej: MA_PRYWATNY
          ? 'Klucz prywatny JEST — publiczny da się z niego wyprowadzić (patrz supabase/functions/send-push/README.md).'
          : 'Nie ma też prywatnego — sprawdź, czy patrzysz na właściwy projekt (produkcja, nie BojoDev).',
      }, null, 2),
      { status: 404, headers: { 'content-type': 'application/json; charset=utf-8' } },
    );
  }

  // Czysty tekst, nie JSON: wartość ma iść prosto do schowka na telefonie,
  // bez cudzysłowów i nawiasów do ręcznego obcinania.
  return new Response(`${PUBLICZNY}\n`, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      // Gdyby ktoś trafił tu przypadkiem — niech nie zostanie w żadnym indeksie.
      'x-robots-tag': 'noindex, nofollow',
      'cache-control': 'no-store',
    },
  });
});
