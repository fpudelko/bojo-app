// Treść /kalkulator-kosztow-boiska — jedyna strona w planie SEO/GEO, która nie
// potrzebuje ani jednego użytkownika, ani jednego meczu, żeby być użyteczna
// (docs/seo-geo-strategia.md, N1). Odpowiada na klaster "Rozliczenie" wprost,
// niezależnie od tego, czy ktoś w ogóle zna Bojo.

/**
 * Direct Answer — ta sama zasada co w content/jakDziala.ts i content/dlaczego.ts:
 * nazywa Bojo z nazwy, podaje mechanikę, nie zapowiada jej.
 */
export const KALKULATOR_ODPOWIEDZ =
  'Koszt wynajmu boiska dzieli się na liczbę graczy, którzy realnie wchodzą do ' +
  'składu — nie na tych, którzy „może wpadną". Przy 280 zł za halę i czternastu ' +
  'graczach wychodzi 20 zł od osoby. Jeśli część ekipy ma kartę Multisport, ' +
  'FitProfit albo Medicover Sport, ich stawka bywa inna, więc reszta dopłaca ' +
  'różnicę. Ten kalkulator liczy to tak samo, jak robi to Bojo przy każdym ' +
  'meczu, i przelicza wynik za każdym razem, gdy skład się zmienia.';

/** Pytania z content/faq.ts pokazywane pod kalkulatorem — te same odpowiedzi
 *  co na /faq, zero duplikowanej treści (jedno źródło, patrz app/faq/page.tsx
 *  dla tego samego wzorca filtrowania). */
export const KALKULATOR_HINT_KARTA =
  'Multisport, FitProfit, Medicover Sport — Bojo nie rozróżnia karty, tylko kwotę zniżki.';

export const KALKULATOR_HINT_BEZ_ZNIZKI =
  'Bez podanej kwoty zniżki posiadacze karty płacą tyle samo, co reszta — suma to liczy ' +
  'tak samo, jak zrobiłby to Bojo na stronie meczu.';

export const KALKULATOR_PYTANIA: readonly string[] = [
  'Czy przez Bojo zapłacę za wynajem boiska?',
  'Jak Bojo dzieli koszt na graczy?',
  'Czy Bojo uwzględnia Multisport i inne karty sportowe?',
  'Jak sprawiedliwie rozliczyć koszty wynajmu boiska?',
  'Kiedy gracz widzi mój numer BLIK?',
];
