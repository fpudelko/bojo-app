// Jedno źródło FAQ dla całej aplikacji.
//
// Strona główna (`components/home/landing/content.ts` re-eksportuje
// `FAQ_LANDING` jako `LANDING_FAQ`) pokazuje ośmiopozycyjny podzbiór, /faq
// pokazuje wszystko. Ponieważ oba biorą z tej samej tablicy, widoczna treść
// i `FAQPage` JSON-LD (patrz `lib/structuredData.ts`, `faqJsonLd()`) nie mają
// jak się rozjechać — żadna odpowiedź nie jest przepisywana w drugim miejscu.
//
// Każda pozycja musi mieć pokrycie w kodzie: `src/__tests__/tresciStron.test.ts`
// pilnuje zakazanych fraz (patrz `zakazaneFrazy.ts`) i tego, że wzmianka
// o powiadomieniach zawsze mówi "w aplikacji", nigdy o kanale, którego nie ma.

export type KategoriaFaq = 'podstawy' | 'konto' | 'organizator' | 'pieniadze' | 'ekipa' | 'boiska';

export interface PytanieFaq {
  q: string;
  a: string;
  kategoria: KategoriaFaq;
  /** Trafia też na skróconą listę ośmiu pytań na stronie głównej. */
  naLandingu?: true;
}

export const KATEGORIE_FAQ: { klucz: KategoriaFaq; tytul: string; kotwica: string }[] = [
  { klucz: 'podstawy', tytul: 'Podstawy', kotwica: 'podstawy' },
  { klucz: 'konto', tytul: 'Konto i logowanie', kotwica: 'konto' },
  { klucz: 'organizator', tytul: 'Organizacja meczu', kotwica: 'organizator' },
  { klucz: 'pieniadze', tytul: 'Pieniądze', kotwica: 'pieniadze' },
  { klucz: 'ekipa', tytul: 'Ekipa i po meczu', kotwica: 'ekipa' },
  { klucz: 'boiska', tytul: 'Boiska', kotwica: 'boiska' },
];

export const FAQ: readonly PytanieFaq[] = [
  // ── Podstawy ─────────────────────────────────────────────────────────────
  {
    kategoria: 'podstawy',
    q: 'Czym jest Bojo?',
    a: 'Bojo to aplikacja webowa do organizowania amatorskich meczów w całej Polsce. ' +
      'Organizator zakłada mecz, wysyła jeden link, a Bojo liczy skład, listę rezerwową ' +
      'i podział kosztów zamiast robić to ręcznie w wątku na czacie.',
  },
  {
    kategoria: 'podstawy',
    q: 'Czym Bojo różni się od systemu rezerwacji boisk?',
    a: 'System rezerwacji odpowiada na pytanie, czy obiekt jest wolny, i przyjmuje ' +
      'opłatę za termin. Bojo tego nie robi — zaczyna się tam, gdzie termin jest już ' +
      'załatwiony, i zajmuje się zebraniem składu, listą rezerwową i podziałem kosztu ' +
      'między graczy.',
  },
  {
    kategoria: 'podstawy',
    naLandingu: true,
    q: 'Czy Bojo jest darmowe?',
    a: 'Tak. Tworzenie meczów, dołączanie do gier, grupy i mapa boisk są bezpłatne. ' +
      'Nie ma abonamentu ani opłat od organizatora.',
  },
  {
    kategoria: 'podstawy',
    naLandingu: true,
    q: 'Gdzie działa Bojo?',
    a: 'W całej Polsce. Mecz stworzysz w dowolnym miejscu — wskazując je na mapie albo ' +
      'wybierając obiekt z katalogu, który obejmuje boiska z całego kraju.',
  },
  {
    kategoria: 'podstawy',
    q: 'Jakie sporty obsługuje Bojo?',
    a: 'Cztery dyscypliny w kreatorze meczu i filtrach: piłka nożna, siatkówka, siatkówka ' +
      'plażowa, koszykówka. Futsal i piłka ręczna są w katalogu boisk na mapie, ale nie ' +
      'da się dziś stworzyć w nich meczu przez kreator.',
  },
  {
    kategoria: 'podstawy',
    q: 'Czy muszę instalować aplikację?',
    a: 'Nie. Bojo działa w przeglądarce telefonu albo komputera, bez instalacji, sklepu ' +
      'z aplikacjami i aktualizacji do pobrania.',
  },

  // ── Konto i logowanie ────────────────────────────────────────────────────
  {
    kategoria: 'konto',
    naLandingu: true,
    q: 'Czy gracze muszą zakładać konto, żeby dołączyć do mojego meczu?',
    a: 'Nie. Osoba z linkiem dołącza, podając imię i e-mail — bez hasła i bez zakładania ' +
      'konta. Konto potrzebne jest tylko organizatorowi, żeby mecz w ogóle powstał. ' +
      'Przeglądanie mapy boisk i listy meczów też nie wymaga logowania.',
  },
  {
    kategoria: 'konto',
    q: 'Czy muszę mieć konto, żeby przeglądać boiska i mecze?',
    a: 'Nie. Mapa boisk, strony obiektów i lista publicznych meczów są dostępne bez ' +
      'logowania. Konto jest potrzebne dopiero, żeby stworzyć mecz.',
  },
  {
    kategoria: 'konto',
    q: 'Czy jako organizator muszę mieć konto?',
    a: 'Tak. Założenie meczu, zapraszanie ludzi i zarządzanie składem wymagają konta — ' +
      'to jedyne miejsce, w którym Bojo prosi o logowanie. Konto zakładasz przez Google ' +
      'albo e-mail w chwili, gdy klikasz „Zorganizuj mecz".',
  },
  {
    kategoria: 'konto',
    q: 'Jak się loguję do Bojo?',
    a: 'Kontem Google albo e-mailem — hasłem, magic linkiem wysyłanym na skrzynkę, albo ' +
      'resetem hasła, jeśli je zapomnisz. Każdy sposób prowadzi do tego samego konta.',
  },
  {
    kategoria: 'konto',
    q: 'Co zyskuje gracz, który założy konto po meczu?',
    a: 'Historię swoich meczów i statystyki (gole, liczba rozegranych spotkań) pod ' +
      'publicznym profilem. Kto dołączył jako gość bez konta, może potem założyć je ' +
      'jednym kliknięciem i przejąć swój wpis — historia i statystyki lecą razem z nim.',
  },
  {
    kategoria: 'konto',
    q: 'Zapisałem się jako gość na e-mail, który ma już konto w Bojo — co się stanie?',
    a: 'Bojo rozpoznaje to od razu i zamiast rejestracji proponuje logowanie na to konto. ' +
      'Po zalogowaniu wpis w składzie staje się Twoim wpisem — bez dodatkowego kroku ' +
      'i bez drugiego wiersza na liście uczestników.',
  },

  // ── Organizacja meczu ────────────────────────────────────────────────────
  {
    kategoria: 'organizator',
    naLandingu: true,
    q: 'Ile zajmuje zorganizowanie meczu?',
    a: 'Kreator ma trzy kroki: sport i boisko, termin i liczba miejsc, opcje. ' +
      'W praktyce dwie minuty. Boisko wybierasz z mapy — nie wpisujesz adresu ręcznie.',
  },
  {
    kategoria: 'organizator',
    q: 'Co dokładnie ustawiam, tworząc mecz?',
    a: 'Krok 1: sport i miejsce z mapy (albo pinezka gdziekolwiek w Polsce). Krok 2: ' +
      'termin, liczba miejsc i koszt — domyślnie jutro, 18:00, 90 minut. Krok 3: tytuł, ' +
      'opis, widoczność publiczna albo prywatna i akceptacja zapisów. Przed publikacją ' +
      'widzisz podsumowanie wszystkiego z przyciskiem „Zmień" przy każdej pozycji.',
  },
  {
    kategoria: 'organizator',
    naLandingu: true,
    q: 'Czym różni się mecz publiczny od prywatnego?',
    a: 'Mecz publiczny widnieje na liście gier i każdy zalogowany może dołączyć. Mecz ' +
      'prywatny jest dostępny wyłącznie dla osób z linkiem albo kodem dołączenia.',
  },
  {
    kategoria: 'organizator',
    q: 'Czy mogę zatwierdzać, kto wchodzi do składu?',
    a: 'Tak — osobny przełącznik „wymaga akceptacji" w kreatorze i w edycji meczu. ' +
      'Działa jednakowo dla meczu publicznego i prywatnego: zapis czeka na Twoją zgodę, ' +
      'zanim zajmie miejsce.',
  },
  {
    kategoria: 'organizator',
    q: 'Jak zaprosić ludzi na mecz?',
    a: 'Jednym linkiem do meczu — przycisk „Udostępnij" otwiera systemowy arkusz ' +
      'udostępniania z gotowym tekstem (sport, termin, miejsce, cena). Możesz też ' +
      'zaprosić kogoś imiennie z listy znajomych albo z grupy, jeśli macie wspólną ekipę.',
  },
  {
    kategoria: 'organizator',
    naLandingu: true,
    q: 'Co się dzieje, gdy zbierze się komplet?',
    a: 'Kolejne zapisy trafiają na listę rezerwową. Bojo nie awansuje rezerwowych ' +
      'automatycznie — gdy ktoś się wypisze, organizator sam decyduje, kogo wpuścić.',
  },
  {
    kategoria: 'organizator',
    q: 'Co, jeśli ktoś się wypisze na dzień przed meczem?',
    a: 'Zwolnione miejsce jest oferowane pierwszej osobie z listy rezerwowej, która ma ' +
      'domyślnie 3 godziny na decyzję — nikt nie trafia do składu po cichu. Organizator ' +
      'widzi w aplikacji, gdy skład przestaje być kompletny.',
  },
  {
    kategoria: 'organizator',
    q: 'Jak odwołać mecz i skąd gracze się o tym dowiedzą?',
    a: 'Przycisk „Odwołaj mecz" w panelu zarządzania. Wszyscy zapisani — z kontem i bez ' +
      'konta — dostają o tym powiadomienie w aplikacji, a strona meczu pokazuje wyraźny ' +
      'baner „Mecz odwołany" zamiast cichej zmiany, którą trzeba samemu zauważyć.',
  },
  {
    kategoria: 'organizator',
    q: 'Czy Bojo wysyła SMS-y albo maile o meczu?',
    a: 'Nie wysyła. Powiadomienia (oferta zwolnionego miejsca, akceptacja zapisu, zmiana ' +
      'terminu, zaproszenie, odwołanie meczu, zmiana kompletu składu) są wyłącznie ' +
      'w aplikacji, pod dzwonkiem. Kanałem, który realnie dociera, jest link wysłany ' +
      'tam, gdzie ekipa już rozmawia.',
  },
  {
    kategoria: 'organizator',
    q: 'Czy mogę dopisać kogoś ręcznie, bez jego udziału?',
    a: 'Tak — „Dopisz osobę bez konta" w panelu składu. Powstaje wpis gościa, który ' +
      'zajmuje miejsce jak każdy inny; osoba dopisana może później sama założyć konto ' +
      'i przejąć swój wpis, jeśli dostanie do tego link.',
  },
  {
    kategoria: 'organizator',
    q: 'Czy uczestnicy mogą dopisywać własnych gości?',
    a: 'Tak, jeśli organizator włączy przełącznik „Uczestnicy mogą dodawać gości". ' +
      'Domyślnie jest wyłączony — dopisywanie zostaje wtedy wyłącznie po stronie ' +
      'organizatora.',
  },
  {
    kategoria: 'organizator',
    q: 'Czy mogę powtórzyć ten sam mecz za tydzień?',
    a: 'Tak — „Powtórz mecz" w panelu zarządzania tworzy nowy mecz z tym samym miejscem, ' +
      'liczbą miejsc, ceną i opcjami; zmieniasz tylko termin.',
  },
  {
    kategoria: 'organizator',
    q: 'Jak zrobić stałą, cotygodniową gierkę?',
    a: 'Stałe gierki (`/cykliczne`) to szablon z ustalonym dniem tygodnia i godziną — ' +
      'kolejny termin powstaje sam, dziedzicząc ustawienia poprzedniego, a organizator ' +
      'widzi w jednym miejscu niezawodność zapraszanych osób.',
  },
  {
    kategoria: 'organizator',
    q: 'Czy organizator musi grać w swoim meczu?',
    a: 'Nie. „Biorę udział" to osobny przełącznik w kreatorze — możesz zorganizować mecz ' +
      'i w nim nie grać, np. gdy tylko rezerwujesz boisko dla ekipy.',
  },

  {
    kategoria: 'organizator',
    q: 'Co zrobić, gdy brakuje osoby na mecz?',
    a: 'Ustaw mecz jako publiczny — trafia wtedy na listę otwartych gier i na stronę ' +
      'swojego sportu i miasta, więc może dopisać się ktoś spoza ekipy. Chętni ponad ' +
      'limit ustawiają się w kolejce rezerwowej z widoczną kolejnością; gdy ktoś się ' +
      'wypisze, zwolnione miejsce proponujesz wybranej osobie z rezerwy.',
  },
  {
    kategoria: 'organizator',
    q: 'Gdzie szukać ludzi do gry w piłkę?',
    a: 'W Bojo otwarte mecze publiczne widać na liście wydarzeń oraz na stronach ' +
      'poszczególnych sportów i miast. Możesz dołączyć do cudzego meczu albo założyć ' +
      'własny i puścić link po znajomych — publiczny mecz zbiera jedno i drugie naraz.',
  },

  // ── Pieniądze ────────────────────────────────────────────────────────────
  {
    kategoria: 'pieniadze',
    naLandingu: true,
    q: 'Czy przez Bojo zapłacę za wynajem boiska?',
    a: 'Nie. Bojo dzieli koszt na graczy, uwzględnia zniżki z kart sportowych i pozwala ' +
      'odhaczyć, kto już oddał pieniądze — ale samego przelewu nie obsługuje. ' +
      'Rozliczacie się jak dotąd, tylko bez liczenia w pamięci.',
  },
  {
    kategoria: 'pieniadze',
    q: 'Jak Bojo dzieli koszt na graczy?',
    a: 'Wpisujesz koszt obiektu, a Bojo dzieli go równo na liczbę miejsc: 150 zł za halę ' +
      'przy 12 miejscach to 12,50 zł od osoby. Kwota przelicza się sama, gdy zmienisz ' +
      'liczbę miejsc. Każdy zapisany widzi na stronie meczu, ile ma zapłacić.',
  },
  {
    kategoria: 'pieniadze',
    q: 'Czy Bojo uwzględnia Multisport i inne karty sportowe?',
    a: 'Tak — Multisport, FitProfit, Medicover Sport i „inna karta" z własną nazwą. ' +
      'Organizator wpisuje kwotę zniżki dla posiadaczy karty; bez podanej kwoty aplikacja ' +
      'pokazuje adnotację „zniżka z karty — ustal kwotę" zamiast zgadywać.',
  },
  {
    kategoria: 'pieniadze',
    q: 'Jak sprawiedliwie rozliczyć koszty wynajmu boiska?',
    a: 'Wpisujesz w Bojo całkowity koszt obiektu, a aplikacja dzieli go przez liczbę ' +
      'miejsc w składzie — 150 zł przy 12 miejscach daje 12,50 zł od osoby. Posiadaczom ' +
      'kart Multisport, FitProfit i Medicover Sport odejmujesz zniżkę, a kto już oddał ' +
      'pieniądze, odhaczasz jednym kliknięciem.',
  },
  {
    kategoria: 'pieniadze',
    q: 'Kiedy gracz widzi mój numer BLIK?',
    a: 'Dopiero 60 minut przed rozpoczęciem meczu — wcześniej pole jest ukryte, żeby numer ' +
      'nie krążył niepotrzebnie po telefonach osób, które jeszcze mogą się wypisać.',
  },
  {
    kategoria: 'pieniadze',
    q: 'Jak powiedzieć ekipie, kto jeszcze nie oddał pieniędzy?',
    a: 'Przycisk „Wyślij rozliczenie ekipie" w panelu kosztów składa gotową wiadomość — ' +
      'kwotę, listę zaległości z uwzględnioną zniżką kartową i numer BLIK, jeśli go ' +
      'akceptujesz — i otwiera systemowy arkusz udostępniania.',
  },

  // ── Ekipa i po meczu ─────────────────────────────────────────────────────
  {
    kategoria: 'ekipa',
    naLandingu: true,
    q: 'Jak zaprosić stałą ekipę?',
    a: 'Zakładasz grupę i wysyłasz link zaproszenia. Członkowie widzą mecze grupy ' +
      'i historię wspólnych składów w jednym miejscu.',
  },
  {
    kategoria: 'ekipa',
    q: 'Co się dzieje z meczem po jego zakończeniu?',
    a: 'Strona meczu zostaje — z pełnym składem, wynikiem (jeśli go wpiszesz) i stanem ' +
      'rozliczenia. Panel kosztów działa tak samo jak przed meczem, więc rozliczenie ' +
      'ekipy nie musi się zdążyć przed gwizdkiem.',
  },
  {
    kategoria: 'ekipa',
    q: 'Czy Bojo liczy statystyki graczy?',
    a: 'Tak, gdy organizator włączy wyniki meczu (gole, w niektórych sportach też asysty). ' +
      'Statystyki zbierają się na publicznym profilu gracza (`/gracz/[id]`) i liczą tylko ' +
      'zapisanych ze statusem „gram" — obserwujący i osoby usunięte ze składu ich nie ' +
      'zawyżają.',
  },

  // ── Boiska ───────────────────────────────────────────────────────────────
  {
    kategoria: 'boiska',
    q: 'Skąd Bojo ma dane o boiskach?',
    a: 'Katalog powstał z importu danych OpenStreetMap, województwo po województwie, ' +
      'wzbogaconych częściowo o telefon, stronę www i godziny otwarcia. Dane z OSM są ' +
      'na licencji ODbL.',
  },
  {
    kategoria: 'boiska',
    q: 'Dlaczego przy niektórych boiskach brakuje szczegółów?',
    a: 'Lokalizacja i podstawowe dane są kompletne dla całego katalogu, ale nawierzchnia, ' +
      'typ obiektu i zdjęcia są dziś wypełnione tylko dla części wierszy — uzupełniamy je ' +
      'obiekt po obiekcie, zamiast obiecywać komplet, którego jeszcze nie ma.',
  },
  {
    kategoria: 'boiska',
    q: 'Nie ma mojego boiska w katalogu — co wtedy?',
    a: 'Kreator meczu przyjmuje dowolną pinezkę na mapie, nawet spoza katalogu — nazwa ' +
      'i adres liczą się z lokalizacji, więc mecz i tak powstanie. Samo dodanie boiska do ' +
      'stałego katalogu to dziś proces poza aplikacją.',
  },
];

/** Ośmiopozycyjny podzbiór pokazywany na stronie głównej. */
export const FAQ_LANDING = FAQ.filter((p) => p.naLandingu);
