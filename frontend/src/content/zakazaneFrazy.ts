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
  'przypomnien', // no scheduler exists
  // Komentarz historyczny mówił "no event triggers notifications today" — to
  // dziś NIEPRAWDA (migracje 062/065/067/070/079 realnie wstawiają powiadomienia
  // w aplikacji). Fraza zostaje zakazana na landingu mimo to: landing jest czysto
  // sprzedażowy i nie wspomina kanałów w ogóle — o powiadomieniach mówią
  // `/jak-dziala-bojo` i `/faq`, gdzie kontekst "w aplikacji" jest jawny.
  'powiadom',
  'alert', // SHOW_GAME_ALERTS = false
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
  'push', // no push notifications
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
