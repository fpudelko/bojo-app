// Treść /jak-dziala-bojo — jedno zadanie: organizator nie ma po tej stronie
// ani jednej wątpliwości, co się kiedy dzieje. Każdy akapit ma pokrycie
// w kodzie; testy w `src/__tests__/tresciStron.test.ts` pilnują zakazanych
// fraz i uczciwości wokół powiadomień.

export interface SekcjaJakDziala {
  id: string;
  label: string;
  tytul: string;
  akapity: readonly string[];
}

export const JAK_DZIALA: readonly SekcjaJakDziala[] = [
  {
    id: 'w-skrocie',
    label: 'Bojo w pięciu zdaniach',
    tytul: 'Bojo w pięciu zdaniach',
    akapity: [
      'Zakładasz mecz w trzech krokach kreatora. Dostajesz jeden link do meczu. ' +
      'Wysyłasz go tam, gdzie Twoja ekipa już rozmawia — WhatsApp, Messenger, e-mail, ' +
      'obojętnie co. Ludzie dołączają, także bez zakładania konta w Bojo. Bojo liczy ' +
      'skład, listę rezerwową i podział kosztów za Ciebie.',
    ],
  },
  {
    id: 'zakladasz-mecz',
    label: 'Jak wygląda zakładanie meczu',
    tytul: 'Jak wygląda zakładanie meczu',
    akapity: [
      'Krok 1 — sport i miejsce. Wybierasz jeden z czterech sportów (piłka nożna, ' +
      'siatkówka, siatkówka plażowa, koszykówka) i boisko z mapy, albo stawiasz pinezkę ' +
      'gdziekolwiek w Polsce, jeśli obiektu nie ma w katalogu.',
      'Krok 2 — termin i liczba miejsc. Domyślnie jutro, 18:00, 90 minut i 14 miejsc dla ' +
      'piłki nożnej — każda wartość gotowa do zmiany jednym dotknięciem. Koszt wpisujesz ' +
      '„za obiekt", a Bojo dzieli go na miejsca i przelicza automatycznie, gdy zmienisz ' +
      'ich liczbę.',
      'Krok 3 — opcje. Tytuł (opcjonalny, z podpowiedzią domyślnej nazwy), opis, mecz ' +
      'publiczny albo prywatny, akceptacja zapisów, przypisanie do grupy. Zanim klikniesz ' +
      '„Opublikuj mecz", widzisz podsumowanie: co, kiedy, gdzie, ile miejsc, ile kosztuje ' +
      'i kto go zobaczy — z przyciskiem „Zmień" przy każdym wierszu.',
    ],
  },
  {
    id: 'wysylasz-link',
    label: 'Jeden link, gotowy tekst',
    tytul: 'Jeden link, gotowy tekst',
    akapity: [
      'Adres meczu to `bojo.pl/wydarzenia/<id>`. Przycisk „Udostępnij" otwiera systemowy ' +
      'arkusz udostępniania telefonu z gotowym tekstem — sport i format, dzień i godziny, ' +
      'nazwa obiektu z adresem, liczba miejsc i cena od osoby. Wygląda jak dobrze napisany ' +
      'post organizatora, nie jak reklama aplikacji.',
      'Mecz prywatny ma dodatkowo krótki kod dołączenia — działa tak samo jak link, na ' +
      'wypadek gdy ktoś woli wpisać kod ręcznie.',
    ],
  },
  {
    id: 'brakuje-graczy',
    label: 'Gdy brakuje 1-2 graczy',
    tytul: 'Co zrobić, gdy brakuje 1-2 graczy do składu',
    akapity: [
      'Ustaw mecz jako publiczny — trafi na listę otwartych gier i będzie mógł do niego ' +
      'dołączyć każdy zalogowany gracz, nie tylko osoby, które dostały Twój link. To ten ' +
      'sam przełącznik z kroku 3 kreatora (patrz wyżej) — możesz go zmienić też później, ' +
      'w ustawieniach już założonego meczu.',
      'Warto mieć realistyczne oczekiwania: publicznych gier na liście bywa dziś niewiele, ' +
      'więc najpewniejszy sposób na dobranie brakujących osób to nadal link do własnej ' +
      'ekipy (patrz wyżej) — otwarcie meczu publicznie to dodatkowa szansa, nie gwarancja ' +
      'kompletu.',
    ],
  },
  {
    id: 'bez-konta',
    label: 'Czy gracze muszą zakładać konto?',
    tytul: 'Czy gracze muszą zakładać konto?',
    akapity: [
      'Nie. Osoba, która dostanie link, podaje imię i e-mail i jest w składzie — bez ' +
      'hasła, bez potwierdzania adresu, bez instalowania czegokolwiek. Zanim kliknie ' +
      '„Zapisz się", widzi, czy wchodzi do składu, czy na listę rezerwową i którą z kolei.',
      'Dopiero po zapisie Bojo proponuje dokończenie konta — hasłem albo przez Google. ' +
      'Wtedy wpis staje się jej wpisem razem z historią i statystykami; można tę ' +
      'propozycję też po prostu pominąć i zostać przy samym zapisie. Ten sam e-mail nie ' +
      'zapisze się dwa razy na ten sam mecz.',
    ],
  },
  {
    id: 'sklad-i-rezerwa',
    label: 'Skład, rezerwa i „Obserwuję"',
    tytul: 'Skład, rezerwa i „Obserwuję"',
    akapity: [
      'Mecz ma twardy limit miejsc. Po jego wyczerpaniu kolejne zapisy trafiają na listę ' +
      'rezerwową, z widoczną pozycją w kolejce. Status „Obserwuję" pozwala śledzić mecz, ' +
      'nie zajmuje miejsca i nie liczy się do statystyk — to odpowiednik „może wpadnę", ' +
      'odróżnialny od „będę".',
      'Bramkarze mają osobny limit — maksymalnie dwóch — w dwóch trybach do wyboru: ' +
      'miejsca zarezerwowane osobno albo wspólna pula z resztą składu. Akceptację zapisu ' +
      'włącza się osobnym przełącznikiem i działa jednakowo dla meczu publicznego ' +
      'i prywatnego.',
    ],
  },
  {
    id: 'gdy-ktos-odpadnie',
    label: 'Co się dzieje, gdy ktoś się wypisze',
    tytul: 'Co się dzieje, gdy ktoś się wypisze',
    akapity: [
      'Bojo nie awansuje rezerwowego automatycznie — to świadoma decyzja: nikt nie ma ' +
      'trafiać do składu po cichu, bez własnej wiedzy. Zwolnione miejsce jest oferowane ' +
      'pierwszej osobie z listy rezerwowej, która ma domyślnie 3 godziny na decyzję, zanim ' +
      'oferta przejdzie dalej.',
      'Organizator widzi w aplikacji moment, w którym skład przestaje być kompletny, ' +
      'i moment, w którym znowu się zapełnia — bez odświeżania strony meczu co chwilę.',
    ],
  },
  {
    id: 'pieniadze',
    label: 'Kto ile płaci — kalkulator kosztów',
    tytul: 'Jak rozliczyć mecz ze znajomymi — kalkulator kosztów boiska',
    akapity: [
      'Bojo liczy i pilnuje rozliczenia — nie przelewa pieniędzy. Wpisujesz koszt ' +
      'wynajmu obiektu, a Bojo dzieli go na miejsca i przelicza po każdej zmianie liczby ' +
      'graczy, więc cena od osoby jest zawsze aktualna.',
      'Karty sportowe — Multisport, FitProfit, Medicover Sport i „inna", z własną nazwą — ' +
      'obniżają kwotę dla ich posiadaczy o kwotę, którą ustali organizator; bez podanej ' +
      'kwoty aplikacja pokazuje „zniżka z karty — ustal kwotę" zamiast zgadywać. Sposób ' +
      'płatności: BLIK, gotówka albo inny, ustalony poza aplikacją.',
      'Numer BLIK organizatora widzi uczestnik dopiero 60 minut przed meczem. Wpłaty ' +
      'odhaczasz przełącznikiem przy nazwisku, a jeden przycisk składa wiadomość „kto ' +
      'jeszcze nie oddał, ile i gdzie" — gotową do wklejenia na czat ekipy.',
    ],
  },
  {
    id: 'po-meczu',
    label: 'Co robisz po gwizdku',
    tytul: 'Co robisz po gwizdku',
    akapity: [
      'Rozliczasz ekipę i wysyłasz zestawienie zaległości. Wpisujesz wynik, jeśli mecz ma ' +
      'włączone wyniki — zapisuje się w statystykach graczy na ich profilach. Powtarzasz ' +
      'mecz jednym kliknięciem, z tym samym miejscem, ustawieniami i ceną — zmieniasz ' +
      'tylko termin. Zapraszasz gości bez konta, żeby przejęli swój wpis i mieli od tej ' +
      'pory historię gier w jednym miejscu.',
    ],
  },
  {
    id: 'co-widza-gracze',
    label: 'Co dokładnie widzi zaproszony',
    tytul: 'Co dokładnie widzi zaproszony',
    // Renderowane jako lista numerowana (<ol>) w page.tsx — bez ręcznych
    // prefiksów "N.", żeby numeracja nie zdublowała się z markupem.
    akapity: [
      'Klika link i widzi stronę meczu: sport, dzień, godziny, miejsce, cenę od osoby ' +
      'i licznik zajętych miejsc z paskiem postępu.',
      'Na dole ekranu ma dwa przyciski: „Dołącz bez konta →" i „Zaloguj się".',
      '„Dołącz bez konta" prosi tylko o imię i e-mail. Jeśli skład jest już pełny, Bojo ' +
      'mówi to wprost: „Mecz ma już komplet — zapiszesz się na listę rezerwową jako N. ' +
      'w kolejce".',
      'Po zapisie widzi swój faktyczny status — „Jesteś w składzie" albo „Jesteś na ' +
      'liście rezerwowej" — nad już zaktualizowaną listą uczestników.',
      'Dopiero potem pojawia się propozycja dokończenia konta. Można ją pominąć i po ' +
      'prostu zostać zapisanym.',
      'Kto zakłada konto, przejmuje swój wpis — historia gier i statystyki lecą razem ' +
      'z nim od tej pory.',
    ],
  },
  {
    id: 'powiadomienia',
    label: 'Co Bojo powiadamia i gdzie',
    tytul: 'Co Bojo powiadamia i gdzie',
    akapity: [
      'Powiadomienia są w aplikacji, pod dzwonkiem — najważniejsze zdarzenia z meczu: ' +
      'oferta zwolnionego miejsca, akceptacja zapisu, zmiana terminu, miejsca lub kosztu, ' +
      'imienne zaproszenie na mecz, odwołanie lub usunięcie meczu, usunięcie ze składu ' +
      'oraz zmiana stanu kompletu składu (organizator dowiaduje się, gdy skład przestaje ' +
      'albo zaczyna być pełny).',
      'Bojo nie wysyła SMS-ów ani maili o meczu i nie ma powiadomień push — jedyny kanał ' +
      'to powiadomienia w aplikacji, opisane wyżej. Kanałem, który realnie dociera do ' +
      'ludzi, jest link wysłany tam, gdzie ekipa już rozmawia — dlatego to na nim opiera ' +
      'się cały produkt, nie same powiadomienia w aplikacji.',
    ],
  },
  {
    id: 'czego-bojo-nie-robi',
    label: 'Czego Bojo nie robi',
    tytul: 'Czego Bojo nie robi',
    akapity: [
      'Nie rezerwuje boiska i nie płaci za nie — rezerwację ustalasz z obiektem tak jak ' +
      'dotąd. Nie przelewa pieniędzy — tylko liczy, kto ile jest winien i kto już oddał. ' +
      'Nie dobiera składu po poziomie umiejętności i nie ma rankingów. Nie awansuje ' +
      'rezerwowego samodzielnie. Nie zastępuje czatu ekipy — to link do wklejenia w czat, ' +
      'nie osobny komunikator.',
    ],
  },
];
