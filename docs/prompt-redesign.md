# Prompt: „Redesign pod społeczność"

Gotowy brief dla modelu z najwyższej półki (Fable) pracującego **w repo** (Claude Code),
nie w czacie. Model sam czyta dokumenty i kod, więc nic nie trzeba sklejać ani wklejać
poza samym promptem.

**Zakres:** przebudowa UI i UX całej aplikacji, refaktor największych plików i testy
najważniejszych przejść. Cel: Bojo ma zbierać ludzi w ekipy i przy nich trzymać.

**Zanim uruchomisz:**

- Zapisz sobie na boku trzy ekrany, które Twoim zdaniem wymagają zmiany najbardziej.
  Porównasz z tym, co model wskaże w kroku 1.
- Zdecyduj, czy model ma prawo **mergować sam** (domyślnie tak, patrz `AGENTS.md`,
  „Konwencje"). Przy redesignie warto to zawęzić: prompt niżej każe mu zatrzymać się po
  kroku 2 i poczekać na Twoją akceptację kierunku, zanim ruszy ekrany.
- Nowe wzorce zrzutów przyjmujesz etykietą `zrzuty:zaakceptuj`. To jest Twój moment
  kontroli wyglądu, więc przy tym zadaniu przyjdzie ich dużo.

Wynik kroku 1 i 2 ląduje w `docs/redesign-2026-10.md` (plik tworzy model). Dopisz link
w `docs/README.md`, gdy powstanie.

---

## Prompt

```
Jesteś jednocześnie product designerem, senior frontend inżynierem i inżynierem
jakości. Pracujesz w repozytorium Bojo (bojo.pl) i masz przebudować aplikację tak,
żeby lepiej ZBIERAŁA I TRZYMAŁA SPOŁECZNOŚĆ: wizualnie zachęcająca, funkcjonalnie
prostsza, z przekazem, który od pierwszego ekranu mówi, po co tu jestem i kto tu
jeszcze jest. Do tego refaktor największych plików i testy, które naprawdę pilnują
najważniejszych przejść.

Płacę za sąd i za wykonanie, nie za listę pomysłów. Każdą decyzję projektową
uzasadniasz konkretnym graczem, konkretnym ekranem i konkretnym plikiem.

════════════════════════════════════════════════════════════════════════════
KONTEKST, KTÓRY MUSISZ ZNAĆ, ZANIM COKOLWIEK ZMIENISZ
════════════════════════════════════════════════════════════════════════════

Bojo to aplikacja webowa (PWA) do organizowania amatorskich meczów: piłka, siatkówka,
koszykówka i inne. Next.js 14 App Router + Supabase bez własnego backendu, dostęp
pilnuje RLS. Interfejs po polsku, mobile-first. Dwóch założycieli, start w Poznaniu,
katalog ponad 30 tys. boisk w całej Polsce.

PRZECZYTAJ W CAŁOŚCI, w tej kolejności (to nie jest opcjonalne):

 1. AGENTS.md                               zasady pracy, pułapki, konwencje, KOLORY
 2. docs/wizja.md                           dokument nadrzędny; sekcji 1 NIE ruszasz
 3. BACKLOG.md, sekcja „PRZESŁANKA STRATEGICZNA"
                                            mięsem na start są STAŁE EKIPY, otwarte
                                            gry to „później"
 4. docs/rewizja-2026-08.md                 osiem person i miejsca, w których odpadają
 5. docs/analiza-gtm-2026-09.md             ostrzeżenie: budowanie zastępuje sprzedawanie
 6. docs/funkcje.md                         co jest zbudowane, flagi, układ ekranów
 7. docs/domena.md                          reguły zapisów, pojemności, płatności
 8. docs/przeplyw-organizatora.md i docs/faza1-przejscie-e2e-plan.md
                                            audyty przejść, które już zrobiono
 9. PRZEWODNIK.md                           jak funkcje opisuje się ludziom
10. docs/llm-context.md                     najgęstszy opis zachowania produktu

Potem kod: frontend/tailwind.config.ts, frontend/src/app/globals.css,
frontend/src/app/layout.tsx, frontend/src/components/ui/*,
frontend/src/components/layout/* (BottomNav, Header), frontend/src/content/*,
frontend/src/components/home/*, oraz trzy największe pliki:
  - frontend/src/app/wydarzenia/[id]/EventDetailClient.tsx   (~6000 linii)
  - frontend/src/components/map/VenueExplorer.tsx            (~2500)
  - frontend/src/app/wydarzenia/nowe/page.tsx                (~1600)
Testy: frontend/e2e/scenariusze.spec.ts, wizualne.spec.ts, wspolne.ts,
.github/bramka-scenariuszy.mjs, supabase/test/rls.sql.

Uruchom aplikację i PATRZ na nią, zanim ją ocenisz. Bez Dockera:
  ./scripts/stos-bez-dockera.sh --wszystkie-seedy
  cd frontend && set -a && . /tmp/bojo-stos/env && set +a
  npm run build && npm run start
Rób zrzuty Playwrightem w 390×844 (telefon) i 1440×900 (komputer), zalogowany
(test1@example.com / test1234) i niezalogowany. Chromium jest w
/opt/pw-browsers, nie instaluj przeglądarek. Zrzuty robocze trzymaj poza repo.

════════════════════════════════════════════════════════════════════════════
ZASADY, KTÓRYCH NIE ŁAMIESZ (każda kosztowała już kiedyś produkcję)
════════════════════════════════════════════════════════════════════════════

Znaczenie kolorów jest stałe w całej apce i redesign go NIE zmienia:
  różowy = wiadomości; niebieski = wymaga akceptacji ORAZ komplet;
  pomarańczowy = nowość, o której nie wiesz; szary (slate) = zapisy zamknięte;
  zielona liczba na „Mecze" = stan. Możesz zmienić ODCIENIE i całą resztę palety,
  ale nie przypisanie znaczeń. Jeśli uważasz, że któreś znaczenie jest złe, opisz
  to w dokumencie i zapytaj; nie zmieniaj po cichu.

Mobile-first bezwzględnie: style bazowe = najmniejszy telefon, rozszerzanie tylko
przez sm:/md:/lg:/xl:. Zakaz max-*: i @media (max-width). Pilnuje check:docs.

Zakaz długiego myślnika „—" w KAŻDEJ treści widocznej dla użytkownika. Zamiennik
dobierasz do zdania (przecinek, dwukropek, średnik, kropka, nawias).

Copy stron treści i landingu żyje w frontend/src/content/*.ts, nie w JSX.
Nowy przekaz piszesz tam. Zakazane frazy: content/zakazaneFrazy.ts.

„Wstecz" = useWstecz(rodzic) z lib/historia.tsx, nigdy router.push(rodzic).
UPDATE = zaktualizujJedenWiersz(), duże listy = pobierzWszystkie() (lib/zapytania.ts).
Wszystko zależne od „teraz" i strefy w komponentach renderowanych na serwerze:
lib/czasPolski.ts albo usePoMontazu(). Inaczej hydracja pada (W-3).
truncate we flexie wymaga min-w-0.
useSearchParams() na trasie prerenderowanej wywraca build na Vercelu, lokalnie nie.
Cenę liczy wyłącznie priceForParticipant(). Nie ma auto-awansu z rezerwy i NIE
„naprawiasz" tego. /gracze to redirect.
Flagi (lib/features.ts, config/features.ts) zostają jak są. Nie odmrażasz
gier cyklicznych, rezerwacji ani SMS.
Warstwy (z-index) tylko przez lib/warstwy.ts; modal nie może chować się pod
paskiem nawigacji. Kolejność warstw sprawdzają testy klikalności.
docs/wizja.md sekcja 1: nie parafrazujesz, nie skracasz, nie poprawiasz.

Migracje: domyślnie ŻADNYCH. Redesign ma działać na obecnym schemacie. Jeśli
jakiś element społecznościowy naprawdę wymaga danych, których nie ma, to:
tylko migracja DOKŁADAJĄCA (kolumna, widok, funkcja), z komentarzem „dlaczego",
z asercją w supabase/test/rls.sql dla każdej nowej polityki, z wpisem w
docs/baza-danych.md, i zgłaszasz ją wprost w opisie PR. Nic, co ryzyko-migracji.mjs
uzna za ręczne.

Nowe zależności npm: tylko z uzasadnieniem w opisie PR. Lucide, Tailwind,
next/font zostają. Nie dokładaj biblioteki komponentów ani frameworka animacji,
jeśli to samo robi CSS.

Commity i opisy PR po polsku, komentarze w kodzie po angielsku, nazwy zgodne
z otoczeniem (repo miesza polskie i angielskie; trzymaj się tego, co leży obok).

════════════════════════════════════════════════════════════════════════════
KROK 1: AUDYT OCZAMI GRACZA (bez zmian w kodzie)
════════════════════════════════════════════════════════════════════════════

Przeprowadź przez aplikację, na działającym stosie, pięć osób. Każda ma imię,
telefon w ręce i dokładnie jedno wejście:

 A. Organizator stałej ekipy (czwartek 20:00, orlik, 12 osób na Messengerze).
    Wejście: strona główna, zakłada konto, zakłada ekipę, pierwszy mecz, wysyła link.
 B. Stały gracz tej ekipy, bez konta. Wejście: link /d/[kod] na Messengerze.
    Dołącza bez konta, wraca za tydzień.
 C. Nowy w mieście, nikogo nie zna. Wejście: Google → /pilka-nozna/poznan
    albo /wydarzenia. Szuka gry na ten tydzień.
 D. Gracz raz w miesiącu, zapomina hasła, ignoruje powiadomienia.
    Wejście: powiadomienie push / mail o meczu ekipy.
 E. Kapitan po meczu: wpisuje wynik, rozlicza boisko, chce się pochwalić.
    Wejście: strona meczu godzinę po końcu.

Dla każdej osoby: ścieżka ekran po ekranie (trasa + plik komponentu), zrzut,
i trzy rzeczy: (1) gdzie się waha albo odpada i DLACZEGO, (2) gdzie nie widzi,
że są tu INNI ludzie, (3) gdzie przekaz jest techniczny, urzędowy albo pusty.

Potem przegląd przekrojowy:
 - spójność: ile różnych wariantów karty meczu, przycisku, plakietki, pustego
   stanu, nagłówka ekranu istnieje dziś (policz i wskaż pliki);
 - puste stany: każdy, który mówi „brak X" zamiast zapraszać do działania;
 - hierarchia: na każdym kluczowym ekranie, co jest główną akcją i czy wygląda
   jak główna;
 - dostępność: kontrast, cele dotyku < 44 px, focus, etykiety ikon, obsługa
   czytnika ekranu w modalach, prefers-reduced-motion;
 - wydajność odczuwalna: skeletony, migotanie po hydracji, rozmiar JS
   największych tras (z wyniku next build).

Na koniec: które problemy powtarzają się u więcej niż jednej osoby. To one
wyznaczają priorytety, nie Twój gust.

════════════════════════════════════════════════════════════════════════════
KROK 2: KIERUNEK (dokument, nadal bez zmian w kodzie)
════════════════════════════════════════════════════════════════════════════

Zapisz docs/redesign-2026-10.md. Musi wprost cytować ustalenia z kroku 1.

 2.1 Teza jednym zdaniem: czym Bojo ma być dla gracza po redesignie.
     Zgodna z wizją („Strava dla amatorskiego sportu", „sport jako sfera
     socjalna") i z przesłanką „stałe ekipy najpierw".

 2.2 Zasady projektowe (5–7), każda sprawdzalna na ekranie, np.:
     - „Ludzie przed logistyką": na każdym ekranie meczu i ekipy widać twarze
       / inicjały i imiona, zanim widać formularz.
     - „Pusty stan to zaproszenie": żaden pusty stan nie kończy się na „brak".
     - „Jedna główna akcja na ekran".
     - „Rytm ekipy": najbliższy mecz ekipy i pytanie „grasz?" są jedno dotknięcie
       od startu apki.
     - „Moment po meczu jest wart pokazania": wynik, skład, kto strzelił,
       rozliczenie, gotowe do wysłania na czat.
     Wymyśl własne, jeśli masz lepsze. Każda zasada ma kontrprzykład z dzisiejszej
     aplikacji (plik + zrzut).

 2.3 Język i przekaz: ton (koleżeński, konkretny, sportowy, bez korpomowy
     i bez marketingu), słownik (mecz / gra, ekipa / grupa, skład, rezerwa,
     dołącz), zasady mikrocopy dla przycisków, błędów, pustych stanów
     i powiadomień. 10 par „było / będzie" z realnych ekranów.

 2.4 System wizualny: tokeny (kolor, typografia, odstępy, promienie, cienie,
     ruch) jako zmienne CSS + Tailwind, jasny i ciemny motyw (next-themes już
     jest), ikonografia, ilustracje / zdjęcia sportu (skąd, jaka licencja; bez
     stocków o korporacyjnym wyglądzie), jak wygląda „społeczność" na ekranie
     (stosy awatarów, liczniki „X osób gra w tym tygodniu" liczone z prawdziwych
     danych, nigdy wymyślone). Zachowaj semantykę kolorów z AGENTS.md.

 2.5 Nawigacja i architektura informacji: czy dolna nawigacja (Mecze / Szukaj /
     Rozmowy / Ekipy) i nagłówek odpowiadają priorytetom. Zaproponuj zmianę
     tylko, jeśli audyt jej wymaga. Każda przesunięta trasa = przekierowanie,
     wpis w TRASY (e2e/wspolne.ts), docs/funkcje.md i public/llms.txt.

 2.6 Pętle społecznościowe, które redesign wzmacnia NA ISTNIEJĄCYCH funkcjach:
     zaproszenie linkiem → dołącz bez konta → przejęcie profilu gościa → konto;
     mecz ekipy → powiadomienie → „grasz?" jednym kliknięciem; po meczu → wynik
     i rozliczenie wysłane na czat → powrót; profil gracza i statystyki ekipy jako
     coś, czym warto się pochwalić; OG image / karty udostępniania.
     Dla każdej pętli: dzisiejsza wersja, co w niej przecieka, co zmieniasz.

 2.7 Lista NIE-robimy: czego świadomie nie ruszasz i dlaczego (np. nowych
     modułów, rankingów publicznych, odznak). Analiza GTM ostrzega, że budowanie
     zastępuje sprzedawanie; redesign ma poprawić to, co jest, a nowe funkcje
     zapisujesz w BACKLOG.md jako propozycje, nie budujesz.

 2.8 Plan PR-ów (patrz krok 3) z kolejnością i ryzykiem każdego.

 2.9 Makiety: dla 5 kluczowych ekranów (start zalogowanego, strona meczu,
     strona ekipy, /d/[kod] dla gościa, landing) statyczne HTML w design/
     (wzór: design/home-before-after.html) PRZED / PO, telefon i komputer.

>>> ZATRZYMAJ SIĘ TUTAJ. Otwórz PR z samym dokumentem i makietami, opisz w nim
>>> 5 decyzji, które najbardziej potrzebują mojej zgody, i poczekaj na akceptację
>>> kierunku. Nie merguj tego PR-a sam.

════════════════════════════════════════════════════════════════════════════
KROK 3: WYKONANIE SERIĄ MAŁYCH PR-ÓW
════════════════════════════════════════════════════════════════════════════

Każdy PR: jeden temat, zielone CI, kompletny przed otwarciem (nie dosyłasz
poprawek po otwarciu), opis po polsku z listą ekranów przed/po. Kolejność
domyślna (zmień, jeśli krok 1 mówi inaczej):

 PR 1  Fundament: tokeny i system wizualny. tailwind.config.ts, globals.css,
       layout.tsx (fonty), components/ui/* ujednolicone (Button, Card,
       plakietka, pusty stan, nagłówek ekranu, awatar i stos awatarów, sheet /
       modal). Żadnego ekranu jeszcze nie przerabiasz; komponenty mają testy.
 PR 2  Refaktor EventDetailClient.tsx BEZ zmiany wyglądu i zachowania: podział
       na sekcje (nagłówek, skład, zapis, płatność, rozmowa, po meczu, zarządzanie)
       i hooki stanu; logika do lib/ tam, gdzie jest czysta i testowalna. Dowód:
       scenariusze i zrzuty identyczne przed i po. Dopiero na tym redesign.
 PR 3  Strona meczu i /d/[kod] w nowym wyglądzie (najważniejsze wejście gracza B).
 PR 4  Ekipy: /grupy, /grupy/[id], /g/[code]; ekipa jako „dom" z rytmem meczów,
       składem, tablicą i statystykami.
 PR 5  Start zalogowanego (dashboard) i /moje-gry.
 PR 6  Kreator meczu: refaktor wydarzenia/nowe/page.tsx + nowy wygląd kroków.
 PR 7  Szukaj / mapa / /wydarzenia: refaktor VenueExplorer.tsx + nowy wygląd.
 PR 8  Landing i strony treści: nowy przekaz w content/*.ts, prawdziwe liczby,
       bez obietnic, których produkt nie spełnia. SEO nie może spaść: tytuły,
       opisy, JSON-LD i huby sportowo-miejskie zostają lub się poprawiają.
 PR 9  Rozmowy, profil, profil gracza, powiadomienia.
 PR 10 Przegląd końcowy: dostępność, ciemny motyw, animacje, martwy kod
       (AGENTS.md wymienia nieużywane komponenty mapy), lint bez ostrzeżeń
       w ruszonych plikach.

Refaktor ma twarde reguły: najpierw testy chroniące zachowanie, potem podział,
potem dopiero zmiana wyglądu, nigdy wszystko w jednym commicie. Plik > 800 linii
po Twoim PR-ze wymaga uzasadnienia. Komponent nie woła Supabase wprost, tylko
przez lib/.

Przy KAŻDYM PR, który zmienia coś widocznego:
 - docs/funkcje.md (i docs/domena.md, jeśli ruszasz lib/),
 - docs/llm-context.md: wpis w „Ostatnie zmiany" (PROBLEM / ROZWIĄZANIE BOJO /
   MECHANIKA, limit 10 wpisów), potem npm run sync:llm-context,
 - PRZEWODNIK.md, jeśli zmienia się to, co opisuje człowiekowi,
 - nowe trasy do e2e/wspolne.ts (TRASY) i public/llms.txt.

════════════════════════════════════════════════════════════════════════════
KROK 4: TESTY, KTÓRE PILNUJĄ TEGO, CO NAPRAWDĘ WAŻNE
════════════════════════════════════════════════════════════════════════════

Redesign zmieni prawie każdy zrzut. Dlatego ochrona przed regresją siedzi
w ASERCJACH ZACHOWANIA, nie w obrazkach. Zrzut dokłada układ i kolory.

Najważniejsze przejścia (każde musi mieć scenariusz w e2e/scenariusze.spec.ts
na pełnym stosie, na telefonie i komputerze; część już istnieje: rozbuduj,
nie duplikuj):

  1. Pierwsza wizyta z linku /d/[kod] → „Dołącz bez konta" → jestem w składzie
     → wracam tym samym urządzeniem i widzę swój zapis. (Ten test jako jedyny
     NIE ma ustawionej zgody na cookies; nie dopisuj jej.)
  2. Rejestracja / logowanie z meczu → powrót dokładnie na ten mecz → zapis.
  3. Organizator: kreator od sportu do publikacji → ekran „Mecz gotowy, wyślij
     link" → link otwiera właściwy mecz.
  4. Zapis: wolne miejsca → skład; komplet → rezerwa z komunikatem wprost;
     wypisanie → oferta dla rezerwowego (bez auto-awansu).
  5. Prośba o akceptację: gracz prosi, organizator akceptuje, obie strony widzą
     zmianę i powiadomienie.
  6. Ekipa: założenie → kod / link zaproszenia → drugi użytkownik dołącza →
     mecz przypięty do ekipy → członek dostaje powiadomienie → „grasz?" jednym
     kliknięciem.
  7. Po meczu: wynik, strzelcy, rozliczenie kosztów, oznaczenie „zapłacone",
     widok uczestnika „Twoja płatność".
  8. Szukanie gry: /wydarzenia i /mapa z filtrem sportu i miejscowości, pusty
     stan z alertem „Powiadom mnie, gdy się pojawi".
  9. Rozmowy: wiadomość w meczu, na tablicy ekipy i prywatna; licznik
     nieprzeczytanych (różowy) znika po przeczytaniu.
 10. Gracz spoza meczu prywatnego nie widzi treści, której nie powinien
     (granica dostępu w UI; granica w bazie jest w supabase/test/rls.sql).

Zasady pisania:
 - Selektory po roli i nazwie dostępnej (getByRole), nie po klasach Tailwinda;
   redesign nie może łamać testów tylko dlatego, że zmienił się CSS.
 - Scenariusz, który coś zapisuje, sprząta przez zeSprzataniem(). Oba projekty
   chodzą równolegle po jednej bazie.
 - Każdy test musi PAŚĆ, gdy zepsujesz zachowanie, które opisuje. Dla każdego
   nowego scenariusza raz celowo zepsuj kod i pokaż w opisie PR, że test padł.
 - Zrzuty tylko fragmentów bez dat albo z maską; selektory masek istnieją
   w src (maskiZrzutow.test.ts). /wydarzenia renderuje listę dwa razy:
   filter({ visible: true }).
 - Czysta logika wyjęta przy refaktorze dostaje testy w Vitest.
 - Nowe komponenty ui/* dostają testy w Testing Library (render, stany,
   dostępna nazwa, obsługa klawiatury).
 - Dostępność: jeśli dokładasz @axe-core/playwright, uruchamiaj go na 10
   kluczowych ekranach i blokuj tylko naruszenia „serious" i „critical".
 - Test hydracji (hydracja.klikalnosc.spec.ts, strefa Europe/Warsaw) musi
   przechodzić na każdej przerobionej trasie.
 - Wzorców zrzutów ze stosu bez Dockera NIE przyjmujesz (awatary, fonty emoji
   różnią się od CI). Wzorce przyjmuje właściciel etykietą zrzuty:zaakceptuj.

════════════════════════════════════════════════════════════════════════════
WERYFIKACJA PRZED KAŻDYM COMMITEM
════════════════════════════════════════════════════════════════════════════

  cd frontend
  npx tsc --noEmit
  npm run lint
  npm test
  NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key npm run build
  PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run e2e
  npm run scenariusze        (na stosie ze ./scripts/stos-bez-dockera.sh, BEZ
                              --wszystkie-seedy; bramka ma mówić „zachowanie bez
                              regresji")
  cd .. && npm run check:docs
  ./scripts/baza-testowa.sh  (tylko jeśli dotknąłeś supabase/)

Przeczytaj swój diff jak recenzent, który szuka powodu, żeby go odrzucić.

════════════════════════════════════════════════════════════════════════════
KIEDY SIĘ ZATRZYMAĆ I ZAPYTAĆ
════════════════════════════════════════════════════════════════════════════

 - po kroku 2 (zawsze),
 - zmiana znaczenia któregoś koloru,
 - zmiana logo, nazwy, głównej obietnicy marki,
 - usunięcie albo schowanie funkcji, którą ktoś dziś używa,
 - jakakolwiek migracja,
 - zmiana pozycji w dolnej nawigacji,
 - gdy audyt pokazuje, że problem nie jest w UI, tylko w produkcie
   (wtedy opisz to i nie maskuj wyglądem).

════════════════════════════════════════════════════════════════════════════
DEFINICJA UKOŃCZENIA
════════════════════════════════════════════════════════════════════════════

 - docs/redesign-2026-10.md zaakceptowany i aktualny po ostatnim PR,
 - pięć person z kroku 1 przechodzi swoje ścieżki bez punktów odpadnięcia,
   które sam wskazałeś (tabela „było / jest" w dokumencie, ze zrzutami),
 - jeden system komponentów: jeden wariant karty meczu, przycisku, pustego
   stanu, nagłówka ekranu (albo uzasadniony wyjątek),
 - EventDetailClient, VenueExplorer i kreator podzielone, żaden plik > 800 linii
   bez uzasadnienia,
 - 10 przejść z kroku 4 pokrytych scenariuszami, które padają przy regresji,
 - CI zielone, check:docs zielony, dokumentacja i llm-context zaktualizowane,
 - w BACKLOG.md lista rzeczy, które zauważyłeś, a świadomie zostawiłeś.
```
