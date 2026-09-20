// Treść /o-bojo — jedno miejsce, do którego można odesłać organizatora
// w rozmowie (docs/outreach-organizatorzy.md) zamiast tłumaczyć misję
// i etap produktu w kolejnej wiadomości na Messengerze.
//
// ŚWIADOMIE bez imion, nazwisk i bez liczby osób (decyzja właściciela
// 2026-09-18) — "mały zespół" wszędzie, nigdy konkretna liczba: liczba
// starzeje się przy pierwszej zmianie składu zespołu, a "mały zespół" mówi
// dokładnie tyle, ile trzeba, żeby zadziałał efekt wspólnej tożsamości
// (unity, Cialdini) bez obietnicy, którą trzeba będzie pilnować.
//
// Każde zdanie ma pokrycie w kodzie. Testy w `tresciStron.test.ts` pilnują
// zakazanych fraz i uczciwości wokół powiadomień — ta sama reguła co
// `/faq`, `/jak-dziala-bojo`, `/dlaczego-bojo`.

import type { SekcjaProza } from './dlaczego';

/**
 * Direct Answer — ten sam wymóg samodzielności co DLACZEGO_ODPOWIEDZ
 * i JAK_DZIALA_ODPOWIEDZ: nazywa Bojo z nazwy i podaje fakty, nie zapowiedź.
 */
export const O_BOJO_ODPOWIEDZ =
  'Bojo (bojo.pl) to darmowa aplikacja webowa do organizowania amatorskich meczów, ' +
  'budowana przez mały zespół. Misja Bojo: łączyć ludzi przez najprostszy sposób ' +
  'organizowania i dołączania do amatorskich gier sportowych. Bojo zaczyna od ' +
  'organizatorów: najpierw zdejmuje robotę z osoby, która zbiera skład, bo to ona ' +
  'przyprowadza resztę graczy.';

/** Co realnie działa dziś — pokrycie identyczne jak w outreach-organizatorzy.md
 *  §6 „Możemy obiecać". Lista jest ŚWIADOMIE osobna od tamtej (inny odbiorca:
 *  tu czyta ktoś, kto jeszcze się waha, nie ktoś już w rozmowie na Messengerze),
 *  ale każda pozycja musi mieć to samo pokrycie — zmiana w jednym miejscu
 *  wymaga sprawdzenia drugiego. */
export const O_BOJO_DZIALA: readonly string[] = [
  'Zakładanie meczu w trzech krokach: publicznego albo prywatnego, dostępnego ' +
  'wyłącznie przez link lub kod.',
  'Zapis z linku bez zakładania konta: imię i e-mail i gracz jest w składzie. ' +
  'Konto zakłada wyłącznie organizator.',
  'Twardy limit miejsc, komplet, lista rezerwowa z widoczną kolejnością, osobny ' +
  'limit miejsc dla bramkarzy.',
  'Status „Obserwuję" (nie zajmuje miejsca), akceptacja zapisów przez organizatora, ' +
  'ręczne dopisywanie gości.',
  'Podział kosztu obiektu na graczy, zniżki z kart Multisport, FitProfit ' +
  'i Medicover Sport, odhaczanie wpłat.',
  'Ekipa: grupa z linkiem zaproszenia, wspólne mecze, rozmowa, historia składów ' +
  'i statystyki.',
  'Drużyny, wyniki meczu, gole i asysty, publiczny profil gracza ze statystykami.',
  'Katalog boisk z całej Polski na mapie, z nadchodzącymi meczami przy obiekcie.',
  'Powiadomienia w aplikacji pod dzwonkiem, po włączeniu także na telefon, a osoba ' +
  'zapisana bez konta dostaje je mailem. Dzień przed meczem Bojo przypomina o nim samo.',
];

/** Odwrotność listy wyżej — ta sama reguła co WczesnyEtapBadge na landingu:
 *  nie zostawiać miejsca na domysły. Pokrycie sprawdzone wobec
 *  outreach-organizatorzy.md §6 „Czego NIE obiecujemy" i zakazaneFrazy.ts. */
export const O_BOJO_NIE_MA: readonly string[] = [
  'Bojo nie znajdzie Ci dziś brakujących graczy. Otwartych meczów jest za mało, więc ' +
  'otwarcie meczu publicznie to dodatkowa szansa, nie gwarancja kompletu.',
  'Bojo nie wysyła SMS-ów.',
  'Bojo nie przelewa pieniędzy: liczy, kto ile jest winien, i pilnuje, kto już oddał. ' +
  'Rozliczacie się jak dotąd.',
  'Bojo nie rezerwuje obiektu. Halę czy orlik załatwiasz bezpośrednio, tak jak dotąd; ' +
  'Bojo zaczyna się krok później.',
  'Bojo nie awansuje rezerwowego samo: zwolnione miejsce jest oferowane pierwszej ' +
  'osobie z rezerwy, a decyzja należy do niej.',
  'Nie ma rankingów ani doboru meczów po poziomie umiejętności.',
  'Szczegóły boisk (nawierzchnia, typ obiektu, zdjęcia) są dziś wypełnione tylko ' +
  'dla części katalogu.',
];

export const O_BOJO_PROZA: readonly SekcjaProza[] = [
  {
    id: 'misja',
    tytul: 'Misja Bojo',
    akapity: [
      'Misja Bojo: łączyć ludzi przez najprostszy sposób organizowania i dołączania ' +
      'do amatorskich gier sportowych. Docelowo każdy, kto ma czas i ochotę zagrać, ' +
      'znajdzie w okolicy otwartą grę do dołączenia, a organizator znajdzie brakujące ' +
      'osoby do składu. Im więcej organizatorów i graczy korzysta z Bojo, tym więcej ' +
      'takich gier jest do wyboru i tym łatwiej znaleźć zarówno otwarty mecz, jak ' +
      'i brakujących do składu.',
      'Bojo buduje mały zespół, który sam organizuje gierki i sam liczył „+1" ' +
      'w komentarzach. Bojo jest darmowe, bez reklam i bez limitów, na tym etapie ' +
      'zależy nam na tym, żeby ktoś realnie tego użył i powiedział, co jest do poprawki.',
    ],
  },
  {
    id: 'od-organizatorow',
    tytul: 'Dlaczego Bojo zaczyna od organizatorów',
    akapity: [
      'Narzędzie do zbierania składu jest bezużyteczne, dopóki nie ma ani graczy, ' +
      'ani organizatorów, i dokładnie w tym miejscu większość takich pomysłów umiera. ' +
      'Bojo omija to z jednej strony: aplikacja ma być użyteczna dla organizatora ' +
      'w dniu pierwszym, zanim po drugiej stronie ktokolwiek się pojawi. Organizator ' +
      'zyskuje na Bojo nawet wtedy, gdy zaprosi wyłącznie własną ekipę.',
      'Dlatego gracz nie musi zakładać konta, żeby dołączyć. Organizator, który ' +
      'wysyła link do Bojo, nie zmusza nikogo do rejestracji: to jest warunek, bez ' +
      'którego całe to podejście by nie działało, a nie uprzejmość wobec graczy.',
    ],
  },
  {
    id: 'jak-gadac',
    tytul: 'Jak się z nami skontaktować',
    akapity: [
      'Bojo nie ma działu obsługi i nie będzie go udawać. Piszesz na adres z tej ' +
      'strony, a odpowiada ktoś z zespołu, który Bojo buduje, zwykle tego samego ' +
      'dnia. Jeśli coś w aplikacji nie działa, szybszy jest formularz „Zgłoś błąd" ' +
      'w stopce: dokleja sam adres strony i przeglądarkę, więc da się to odtworzyć.',
      'Uwagi od organizatorów, którzy realnie rozegrali na Bojo mecz, mają dziś ' +
      'pierwszeństwo przed wszystkim innym w kolejce zadań. To nie jest grzeczność ' +
      'ani deklaracja: na tym etapie to jest jedyne sensowne kryterium, czym się zajmować.',
    ],
  },
];
