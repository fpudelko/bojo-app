// Listy fraz zakazanych w treści marketingowej/informacyjnej — jedno miejsce,
// żeby landing i nowe strony treści (`/faq`, `/jak-dziala-bojo`, `/dlaczego-bojo`)
// nie mogły niezależnie zacząć obiecywać funkcję, której nie ma.
//
// Dwie listy, bo dwie strony mają inne zasady:
//  - landing (`ZAKAZANE_NA_LANDINGU`) NIE MOŻE wspominać tych rzeczy w ogóle,
//    nawet przecząco — to czysto sprzedażowa treść i przeczenie w niej samo
//    w sobie sugeruje możliwość ("nie wysyłamy SMS-ów" na landingu brzmi jak
//    reklama SMS-ów, których nie ma);
//  - strony treści (`ZAKAZANE_WSZEDZIE`) MOGĄ o nich pisać wyłącznie przecząco,
//    bo mają wprost odpowiadać na pytanie "czy Bojo to robi" — patrz sekcja
//    "Czego Bojo NIE robi" w `docs/funkcje.md`.

export const ZAKAZANE_NA_LANDINGU = [
  'turniej', // SHOW_CUP = false
  'sms', // SHOW_SMS_FEATURES = false
  // Przypomnienia ISTNIEJĄ od migracji `129` (zadanie `bojo-przypomnienia`),
  // więc komentarz „no scheduler exists" był nieaktualny. Fraza zostaje zakazana
  // NA LANDINGU mimo to — z tego samego powodu co 'powiadom' niżej: landing jest
  // czysto sprzedażowy i nie wymienia kanałów w ogóle. Mówią o nich `/faq`
  // i `/jak-dziala-bojo`, gdzie jest miejsce na kontekst.
  //
  // ROZSTRZYGNIĘTE 2026-09-11 (`R-11`) — i to jest właśnie ta rozmowa, którą
  // BACKLOG kazał odbyć RAZEM z tą regułą, a nie obok niej.
  //
  // Zarzut wobec reguły był mocny: przypomnienia są JEDYNĄ rzeczą, której post
  // na grupie i ankieta na WhatsAppie nie umieją w ogóle, a landing sprzedaje
  // organizatorowi dokładnie „to samo co post, tylko z tym, czego tam brakuje"
  // (docs/strategia.md §0). Milczeć o jedynym prawdziwym wyróżniku to dziwna
  // strategia.
  //
  // Reguła mimo to ZOSTAJE BEZ ZMIAN, bo zarzut i reguła mówią o dwóch różnych
  // rzeczach. Reguła zakazuje nazywania KANAŁU; wyróżnikiem nie jest kanał,
  // tylko SKUTEK — skład, który wie, że gra. Landing dostał więc kafelek
  // „Skład wie, że gra" (`components/home/landing/content.ts`), mówiący o tym,
  // co się dzieje, a nie czym to przychodzi. Ani jedna fraza z tej listy nie
  // musiała ustąpić.
  //
  // Wniosek do zapamiętania: gdy reguła copy zderza się z funkcją, najpierw
  // sprawdź, czy naprawdę zakazuje TEJ rzeczy. Tutaj nie zakazywała — zakazywała
  // gorszego sposobu opowiedzenia o niej.
  'przypomnien',
  // Komentarz historyczny mówił "no event triggers notifications today" — to
  // dziś NIEPRAWDA (migracje 062/065/067/070/079 realnie wstawiają powiadomienia
  // w aplikacji). Fraza zostaje zakazana na landingu mimo to: landing jest czysto
  // sprzedażowy i nie wspomina kanałów w ogóle — o powiadomieniach mówią
  // `/jak-dziala-bojo` i `/faq`, gdzie kontekst "w aplikacji" jest jawny.
  'powiadom',
  // `SHOW_GAME_ALERTS` jest WŁĄCZONA od 2026-09-12, więc dawny powód („funkcji
  // nie ma") już nie obowiązuje. Fraza zostaje zakazana NA LANDINGU z tego
  // samego powodu co 'powiadom' wyżej: landing nie wymienia kanałów w ogóle.
  // O alercie mówi samo miejsce, w którym da się go włączyć — pusta lista
  // meczów na `/wydarzenia`.
  'alert',
  'rezerwacj[aeę] boisk', // FEATURE_RESERVATIONS = false
  'blik', // no payment integration
  'zapłać przez', // no payment integration
  'automatyczn[iy].*(awans|wskocz)', // no reserve auto-promotion, by design
  'ranking', // does not exist
  'poziom(u|ie)? zaawansowania', // does not exist
  'warszaw', // not a covered city by name
  'krak[oó]w', // not a covered city by name
] as const;

/** Strony treści MOGĄ pisać o tych rzeczach, ale wyłącznie w zdaniu, które je
 *  jawnie zaprzecza — patrz testy pozytywne w `tresciStron.test.ts`. */
export const ZAKAZANE_WSZEDZIE = [
  // ZDJĘTE 2026-09-08: 'push'. Komentarz brzmiał „no push notifications" i był
  // NIEPRAWDZIWY od migracji `102` — funkcja `send-push` jest wdrożona,
  // `konfiguracja_push` wypełniona, subskrypcje istnieją. Zakaz sprawiał, że
  // strony treści musiały pisać o pushu wyłącznie przecząco, czyli zaniżać
  // możliwości produktu w miejscu, które ma je tłumaczyć.
  'ranking', // does not exist
  'poziom(u|ie)? zaawansowania', // does not exist
  'automatyczn[iy].*(awans|wskocz)', // no reserve auto-promotion, by design
  'rezerw(uj|acj[aeę]) boisk', // FEATURE_RESERVATIONS = false
  'turniej', // SHOW_CUP = false
  'odznak', // no badges beyond "rzetelny gracz"
  'płatność online', // no payment integration
  'zapłać przez', // no payment integration
  'przelew(amy|u) pieni', // Bojo does not move money
] as const;
