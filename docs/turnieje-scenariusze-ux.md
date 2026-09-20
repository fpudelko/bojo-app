# Turnieje — scenariusze użycia i wnioski dla UX

> **Stan: 2026-09-20.** Moduł turniejowy jest zbudowany w całości (5 etapów, migracje
> `145`–`147`, `150`, `151`), ale flaga `SHOW_TURNIEJE` jest **wyłączona** od 2026-09-17 —
> nie z powodu technicznego, tylko dlatego, że pierwsze wrażenie nie jest gotowe dla kogoś
> z ulicy (`frontend/src/lib/features.ts`).
>
> Ten dokument **nie jest** kolejnym planem wdrożeniowym — te są w
> [turnieje-plan-duze-klocki.md](./turnieje-plan-duze-klocki.md) (decyzje) i
> [turnieje-plan-srednie-klocki.md](./turnieje-plan-srednie-klocki.md) (schemat, sygnatury).
> Tamte opisują, **co zbudować**. Ten opisuje, **kto tego używa, kiedy i w jakim stanie
> psychicznym** — i co z tego wynika dla interfejsu, który już istnieje.
>
> Projekt samych ekranów i układów, który z tych ustaleń wynika →
> [turnieje-ux-ekrany.md](./turnieje-ux-ekrany.md).
>
> Ustalenia mają numery `S-n`. Wnioski są czytaniem kodu i przejściem ścieżek, nie
> obserwacją użytkowników — patrz „Czego ten dokument nie sprawdził" na końcu.

---

## 0. Jedno zdanie, z którego wynika reszta

**Turniej to nie ekran, tylko pięciotygodniowy łuk z sześciogodzinnym szczytem — a pod
jednym adresem `/turnieje/[id]` stoi w tym czasie pięć różnych osób, z których każda
przychodzi po co innego.**

Moduł meczowy tego problemu nie ma: mecz to 90 minut i dwie role (organizator, gracz).
Turniej ma pięć ról i sześć momentów, więc ten sam URL musi w poniedziałek być plakatem,
w czwartek terminarzem, w sobotę o 11:40 tablicą wyników, a w niedzielę podium. Dzisiejsza
strona jest we wszystkich tych momentach **tym samym**: paskiem statusu + czterema
zakładkami, z których domyślna („Mecze") przez pierwsze trzy tygodnie mówi „Terminarz
jeszcze nie jest gotowy".

To jest cała diagnoza. Reszta dokumentu ją rozpisuje.

---

## 1. Pięć ról

| Rola | Kim jest naprawdę | Urządzenie | Ile razy wchodzi |
|---|---|---|---|
| **Organizator** | ma dziś Excela, grupę na Facebooku i kartkę A4 z terminarzem | telefon + laptop | dziesiątki razy przez 5 tygodni |
| **Prowadzący** | kolega/syn/sędzia-wolontariusz przy jednym boisku | telefon, jedna ręka, słońce | non stop przez 6 godzin |
| **Kapitan** | zebrał ośmiu ludzi na WhatsAppie, płaci wpisowe z własnej kieszeni | telefon | 5–10 razy |
| **Zawodnik** | dostał link i nie wie, co to Bojo | telefon | 2–4 razy, głównie w dniu turnieju |
| **Widz** | żona, kolega z pracy, rodzic przy juniorach, organizator z sąsiedniego miasta | telefon | 1–3 razy |

**Proporcje mają znaczenie dla growthu.** Turniej na 12 drużyn to **1 organizator,
2–3 prowadzących, 12 kapitanów i ~90 zawodników**. Organizator to jedno konto. Zawodnicy
to dziewięćdziesiąt. Każde tarcie na ścieżce zawodnika kosztuje więc trzydzieści razy
więcej niż to samo tarcie u organizatora — a moduł jest dziś zbudowany odwrotnie:
najbogatszy jest panel organizatora (712 linii), a zawodnik nie ma ani jednego własnego
ekranu.

---

## 2. Oś czasu — sześć momentów

```
T-35 ─────── T-14 ─────── T-3 ── T-1 ─┬─ T-0 (6 h) ─┬── T+1 ───────── T+365
 ①ogłaszam    ②zbieram     ③układam   │  ④gramy      │  ⑤domykam      ⑥następna
              drużyny      terminarz  │              │                 edycja
```

Każdy moment ma **inne główne pytanie** i **inny artefakt do udostępnienia**:

| Moment | Główne pytanie | Co trafia na WhatsAppa / Facebooka |
|---|---|---|
| ① Ogłaszam | „czy to wygląda poważnie?" | plakat: nazwa, data, miejsce, wpisowe, ile miejsc zostało |
| ② Zbieram | „ilu nas jest i kto brakuje?" | link drużyny dla ośmiu kolegów |
| ③ Układam | „o której gramy?" | terminarz mojej drużyny (3 pozycje, nie 42) |
| ④ Gramy | „jaki wynik i gdzie nasz następny mecz?" | wynik na żywo |
| ⑤ Domykam | „kto wygrał?" | podium + król strzelców |
| ⑥ Następna edycja | „kiedy znowu?" | zaproszenie do drużyn z poprzedniego razu |

**Dzisiaj z tych sześciu artefaktów istnieją dwa** (obraz OG turnieju — ten sam we
wszystkich stanach — i link drużyny, dostępny wyłącznie raz, patrz `S-6`).

---

## 3. Ścieżka A — organizator

### A1. „Ogłaszam turniej" (T-35 … T-14)

Człowiek ma w głowie: datę, boisko, „chcę 8–12 drużyn po 100 zł". Chce wyjść z Bojo
z **czymś do wklejenia na Facebooka**, dziś, w ciągu kwadransa. Nie chce jeszcze
terminarza — nie wie nawet, ile będzie drużyn.

Co zastaje: `/turnieje/nowe` — jeden długi formularz (nazwa, sport, daty, miejsce, format,
limity, widoczność, akceptacja, wpisowe, regulamin, opis), po zapisie skok do panelu.

| # | Ustalenie |
|---|---|
| **S-1** | **Kreator jest jedną ścianą pól zamiast obiecanych czterech kroków.** Plan (§8 dużych klocków) zakładał 4 kroki z kartą „Tak zobaczą to kapitanowie" i wyliczeniem czasu trwania turnieju — „najważniejsze zdanie w kreatorze". Nie powstały. Kreator meczu (`/wydarzenia/nowe`) ma trzy kroki i podgląd; turniej, rzecz **trudniejsza**, dostał formularz prostszy w formie, a cięższy w treści. |
| **S-2** | **Wyliczenie czasu to jedyna rzecz, której organizator nie policzy w głowie, a od której zależy, czy turniej się uda.** „8 drużyn, grupy + puchar, mecz 2×10 min, 2 boiska → 21 meczów, ostatni gwizdek ok. 16:40" odpowiada na pytanie, które dziś rozstrzyga się dopiero w sobotę o 17:00, gdy robi się ciemno. To najmocniejszy pojedynczy element całego modułu i **nie istnieje**. |
| **S-3** | **Po utworzeniu turnieju nie ma czego udostępnić.** Kreator kończy się skokiem do panelu — ekranu zarządzania. Powinien kończyć się ekranem „Gotowe. Oto Twój plakat" z linkiem, podglądem obrazka OG i gotowym tekstem do wklejenia (jak `outreach-organizatorzy.md` robi to dla nas samych). Organizator wyszedł z narzędzia bez rzeczy, po którą przyszedł. |

### A2. „Zbieram drużyny" (T-14 … T-3)

Wchodzi co drugi dzień z jednym pytaniem: **ilu nas jest i kto nie zapłacił**. Panel →
Drużyny to dziś daje (lista, status, przełącznik „opłacone", kopiowanie linku drużyny).

| # | Ustalenie |
|---|---|
| **S-4** | **Panel nie odpowiada na „jak mi idzie".** Brakuje jednego wiersza na górze: „7 z 12 drużyn · 4 opłacone · 2 czekają na decyzję · zapisy zamykasz za 6 dni". Dziś trzeba to policzyć wzrokiem z listy. |
| **S-5** | **Nie ma zamknięcia zapisów z datą.** Stan `zapisy → zamkniete_zapisy` przestawia się ręcznie. Organizator, który zapomni, przyjmuje zgłoszenie w piątek wieczorem po ułożonym terminarzu — a deadline jest też jedynym powodem, dla którego kapitan zgłasza się dziś, a nie „kiedyś". |

### A3. „Układam terminarz" (T-3 … T-1)

Najbardziej stresujący moment przed turniejem: losowanie grup, przypisanie do boisk,
sprawdzenie, czy ktoś nie gra dwóch meczów pod rząd. Generator (`lib/turniejFormat.ts`)
to robi i robi dobrze — cztery czyste funkcje, przetestowane.

| # | Ustalenie |
|---|---|
| **S-6** | **Publikacja terminarza nie jest zdarzeniem.** Dziś „zapisz terminarz" i tyle. To jest moment, w którym 12 kapitanów i 90 zawodników dostaje swoją godzinę — powinien wyglądać jak publikacja: podgląd → „Opublikuj terminarz" → powiadomienie do wszystkich → a potem każda zmiana godziny jest **zmianą**, nie zwykłym zapisem (wzorem `lib/zmianyMeczu.ts`, który przy meczu odróżnia „poprawiłem literówkę" od „przesunąłem o godzinę"). |

### A4. „Prowadzę dzień turnieju" (T-0)

Patrz ścieżka D — organizator jest wtedy przede wszystkim prowadzącym. Poza konsolą ma
trzy rzeczy do zrobienia i żadna nie ma dziś przycisku w miejscu, w którym jej szuka:
**przesunięcie całego terminarza** (jest, ale w panelu), **walkower dla drużyny, która
nie dojechała**, **ogłoszenie „przerwa 20 minut"** (jest).

| # | Ustalenie |
|---|---|
| **S-7** | **„Nie dojechali" nie ma przycisku.** Walkower istnieje w danych (`status: 'walkower'`, tabela go liczy poprawnie) i w generatorze przy wolnych losach, ale prowadzący w konsoli meczu nie ma jak go wpisać. To zdarza się na **każdym** turnieju amatorskim. |
| **S-8** | **Panel organizatora nie ma trybu „dziś".** W dniu turnieju panel wygląda identycznie jak trzy tygodnie wcześniej: zakładki Drużyny/Ludzie/Terminarz/Ustawienia. Powinien mieć na górze to, co dotyczy najbliższej godziny: co teraz trwa na każdej arenie, co jest następne, opóźnienie względem planu. |

### A5. „Domykam i wracam za rok" (T+1 … T+365)

| # | Ustalenie |
|---|---|
| **S-9** | **Turniej nie ma końca — ma wygasanie.** Po ostatnim meczu status zmienia się na `zakonczony` i strona pokazuje tabelę. Nie ma podium, nie ma króla strzelców na górze, nie ma nic do udostępnienia. To jest **moment o największym zasięgu w całym module**: wszyscy uczestnicy patrzą w telefon w tej samej minucie. |
| **S-10** | **Nie ma „zorganizuj kolejną edycję".** Organizator, który zrobił turniej raz, zrobi go znowu — i wtedy wszystko wpisuje od zera, a dwanaście drużyn zgłasza się od zera. Kopia turnieju z zaproszeniem do poprzednich drużyn to najtańsza retencja organizatora, jaką ten moduł może mieć. |

---

## 4. Ścieżka B — kapitan (tu mieszka growth)

### B1. „Widzę plakat, zgłaszam drużynę"

Dostał link na Facebooku. Otwiera na telefonie, bez konta.

| # | Ustalenie |
|---|---|
| **S-11** | **Link udostępniony prowadzi na pustą zakładkę.** Domyślna zakładka to zawsze `mecze`, a przez cały okres zapisów terminarza nie ma — więc pierwsze, co widzi człowiek z ulicy, to „Terminarz jeszcze nie jest gotowy". Plan (§8) mówił wprost: domyślna zakładka **zależy od stanu** (`zapisy`→Info). Ta reguła zniknęła przy przebudowie z 2026-09-17 i to jest najdroższa pojedyncza pomyłka w module: jedna linijka `const zakladka` decyduje o pierwszym wrażeniu każdego udostępnionego linku. |
| **S-12** | **Brakuje pilności.** „7/12 drużyn" to informacja, nie powód do działania. „Zostało 5 miejsc · zapisy do 12 października" to powód. Ta sama różnica, którą moduł meczowy rozstrzygnął już dawno licznikiem miejsc i oknem zapisu. |

### B2. „Zbieram ośmiu na WhatsAppie" — **najważniejszy scenariusz w module**

Zgłosił drużynę. Teraz ma wrzucić link ośmiu kolegom, przypilnować, żeby weszli, i mieć
komplet przed sobotą. **To jest cała pętla wzrostu Bojo w turniejach: jeden organizator
→ dwunastu kapitanów → dziewięćdziesiąt kont.**

| # | Ustalenie |
|---|---|
| **S-13** | **Link do drużyny pokazuje się dokładnie raz i nigdy więcej.** Kapitan widzi go na ekranie potwierdzenia `/turnieje/[id]/zglos` tuż po zgłoszeniu. Kto zamknie kartę, nie odzyska go **nigdzie**: pasek „Twoja drużyna" na stronie turnieju pokazuje nazwę, następny mecz i wpisowe — bez linku; jedyne inne miejsce z tym linkiem to panel organizatora, do którego kapitan nie ma wstępu. Jeśli w całym module jest jeden błąd do naprawienia przed odmrożeniem flagi, to jest to ten: **pętla wzrostu urywa się na zamkniętej karcie przeglądarki.** |
| **S-14** | **Nie ma ekranu drużyny.** Plan przewidywał trasę `/turnieje/[id]/druzyna/[id]`; nie powstała. Kapitan nie ma więc gdzie: zobaczyć, kto już dołączył, dopisać kolegę bez smartfona, poprawić nazwę drużyny, oddać kapitaństwo, wycofać drużynę. Wszystkie te operacje **istnieją w `lib/turniejDruzyny.ts`** (`dodajZawodnika`, `updateZawodnika`, `usunZawodnika`, `updateDruzyne`, `usunDruzyne`) i nie mają ani jednego przycisku poza panelem organizatora. To nie jest brak funkcji — to brak ekranu do funkcji, które już są napisane. |
| **S-15** | **Nie ma licznika kompletowania składu.** „3 z 8 zawodników dołączyło" plus „Przypomnij" (kopiuje link z gotowym tekstem) zamienia bierne czekanie w czynność. Turniej zna `minZawodnikow`/`maxZawodnikow`, więc licznik jest do policzenia dzisiaj, bez migracji. |

### B3. „Rano w dniu turnieju"

Chce jednej rzeczy: **o której i na którym boisku gramy pierwszy mecz**, żeby wkleić to
na grupę. Pasek „Twoja drużyna" pokazuje najbliższy mecz — to działa. Ale terminarz
całej drużyny (3–5 pozycji) trzeba wyłuskać wzrokiem z listy 42 meczów.

| # | Ustalenie |
|---|---|
| **S-16** | **„Nasze mecze" nie jest osobnym widokiem.** Przełącznik Najbliższe/Rozegrane dzieli mecze po czasie, nigdy po drużynie. Filtr „tylko nasze" to jedna linijka nad istniejącą listą, a jest dokładnie tym, po co uczestnik wchodzi. |

### B4. „Po turnieju zostaje mi ekipa"

`zamienDruzyneWEkipe()` istnieje i jest dobrym pomysłem (plan §13). Problem jest z
miejscem: przycisk siedzi wewnątrz **rozwiniętej karty drużyny na zakładce Drużyny**.

| # | Ustalenie |
|---|---|
| **S-17** | **Najlepsza funkcja retencyjna jest schowana trzy kliknięcia głęboko i pokazuje się wtedy, kiedy nikt jej nie szuka.** „Zamień drużynę w ekipę" powinno wyjść samo — na ekranie podsumowania turnieju (`S-9`), w dniu, w którym dwunastu ludzi właśnie razem grało. |

---

## 5. Ścieżka C — zawodnik (dziewięćdziesiąt kont)

### C1. „Dostałem link, dołączam"

Trasa `/t/[kod]` → logowanie → dopisanie do składu. To działa i jest najkrótszą drogą do
konta, jaką Bojo ma.

| # | Ustalenie |
|---|---|
| **S-18** | **Ekran `/t/[kod]` nie mówi, do czego człowiek dołącza.** Dla kogoś, kto nie zna Bojo, to jest prośba o założenie konta na nieznanym serwisie w zamian za nic. Powinien widzieć najpierw: nazwę turnieju, datę, miejsce, nazwę drużyny i kto już w niej jest — a dopiero potem „Zaloguj się, żeby dołączyć". Ten sam argument, który uzasadnia bramę logowania przed kreatorem w [przeplyw-organizatora.md](./przeplyw-organizatora.md) (ekran-brama sprzedaje, nie przekierowuje). |

### C2. „Kiedy gramy i z kim" (dzień turnieju)

| # | Ustalenie |
|---|---|
| **S-19** | **Powiadomienie `turniej_nastepny_mecz` nie istnieje.** Plan nazwał je najlepszym typem w module (§12): „Wasz mecz jest następny — Boisko 2", wysyłane w chwili zakończenia poprzedniego meczu na tej arenie. Zero crona, zero zegara — wyzwalacz przy zamknięciu meczu. W `ikonyPowiadomien.ts` i w migracjach `145`–`150` jest dziś **siedem** typów turniejowych z dziewięciu, o których mówił plan — i brakuje wśród nich właśnie tego. To jedyne powiadomienie w całym Bojo, które dociera do człowieka dokładnie w minucie, w której jest mu potrzebne. |
| **S-20** | **Strona się nie odświeża.** Plan zakładał odświeżanie co 20 s dla widzów (§10, świadomie zamiast Realtime); w kodzie nie ma ani jednego `setInterval`. Wynik na żywo, który wymaga pociągnięcia strony w dół, nie jest wynikiem na żywo. |

### C3. „Czy mój gol jest policzony"

To jest moment konwersji opisany w planie (§5): wynik widzi każdy, nazwisko strzelca —
tylko zalogowany. Mechanizm działa (RLS + `SciankaLogowania`).

| # | Ustalenie |
|---|---|
| **S-21** | **Ściana logowania stoi w dobrym miejscu, ale mówi za mało.** 31 linii komponentu z tytułem i przyciskiem. Najmocniejsza wersja tego ekranu nazywa konkretną rzecz po drugiej stronie: „3:2 — zobacz, kto strzelił" jest ofertą; „Statystyki graczy · Zaloguj się" jest komunikatem systemowym. |

### C4. „Co mi zostaje"

| # | Ustalenie |
|---|---|
| **S-22** | **Statystyki turniejowe nie trafiają na profil gracza.** Zapisane w BACKLOG §6 jako decyzja odłożona i tam niech zostanie jako decyzja — ale warto ją podjąć świadomie, bo to jedyny powód, dla którego zawodnik wraca do Bojo w tygodniu po turnieju. Bez tego konto założone dla jednego turnieju jest kontem założonym na jeden dzień. |

---

## 6. Ścieżka D — prowadzący (ekran, od którego zależy wiarygodność)

Stoi przy boisku, słońce, jedna ręka, hałas, drużyny czekają. Ma sześć godzin i
21 meczów. Każde dotknięcie kosztuje go uwagę, której nie ma.

| # | Ustalenie |
|---|---|
| **S-23** | **Wybór strzelca to `<select>`, nie arkusz ze składem.** Plan (§10) mówił: „arkusz z dołu ekranu ze składem, jedno dotknięcie". Dziś: rozwijana lista systemowa, osobno druga na asystę, potem przycisk „Gol". Trzy interakcje i dwa natywne menu tam, gdzie miało być jedno dotknięcie w nazwisko. Natywny `<select>` na telefonie zasłania ekran i wymaga precyzji — dokładnie tego, czego nie ma człowiek w słońcu. |
| **S-24** | **Koszykówka liczy każdą akcję jako jeden punkt.** Przyciski `+1`, `+2`, `+3` wołają tę samą funkcję bez przekazania wartości (`MeczClient.tsx:115`, `dodajZdarzenieAkcja(druzynaId, 'punkty', wybrany)`), a `dodajZdarzenie()` domyśla `wartosc: 1`. Trójka zapisuje się jako punkt. Kolumna `wartosc` i obsługa po stronie bazy istnieją — brakuje jednego argumentu. **To jest błąd, nie brak funkcji**: turniej koszykarski prowadzony tą konsolą kończy się fałszywym wynikiem. |
| **S-25** | **Nie ma zegara meczu.** Turniej amatorski stoi na „2×10 minut" i to prowadzący pilnuje czasu — dziś stoperem w innej aplikacji, przełączając się tam i z powrotem. Minutnik nie musi nic zapisywać do bazy, żeby być najczęściej używanym elementem tego ekranu. |
| **S-26** | **Konsola nie pokazuje, co dalej.** Po „Zakończ mecz" prowadzący wraca na stronę turnieju i szuka kolejnego meczu na swojej arenie. Powinien dostać „Następny na Boisku 2: Dziki – Orły, 11:20 · Rozpocznij". Jedno zdanie zamienia sześć godzin klikania po liście w kolejkę. |

---

## 7. Ścieżka E — widz i ktoś z zewnątrz (tu mieszka propagacja)

### E1. Żona/kolega śledzi wyniki

Nie ma konta i nie będzie miał. Chce wyniku i godziny. Dostaje to (ściana logowania jest
tylko na składach i statystykach) — pod warunkiem, że strona się odświeża (`S-20`).

### E2. Organizator z sąsiedniego miasta ogląda cudzy turniej

To jest **najtańszy kanał pozyskania organizatora**, jaki ten moduł produkuje: udostępniony
link trafia do kilkuset osób, z których część sama coś organizuje.

| # | Ustalenie |
|---|---|
| **S-27** | **Cudzy turniej nie proponuje własnego.** Na stronie zakończonego turnieju nie ma niczego w rodzaju „Organizujesz podobny? Zrób to w Bojo — zapisy, terminarz i wyniki za darmo". Jedyny przycisk „Utwórz turniej" siedzi na liście `/turnieje`, do której z udostępnionego linku nikt nie trafia. |
| **S-28** | **Obraz OG jest jeden na wszystkie stany.** Link do turnieju przed zapisami, w trakcie i po finale wygląda na Facebooku tak samo. Wynik finału na obrazku to treść, którą ludzie udostępniają sami — moduł ma już wszystkie dane, żeby go narysować. |

### E3. Gracz bez drużyny — **scenariusz, którego plan nie przewidział**

Ktoś widzi turniej, chce zagrać, nie ma ośmiu kolegów. Dziś: koniec drogi, żadnego
przycisku. Jednocześnie kapitan obok ma sześciu ludzi i szuka dwóch.

| # | Ustalenie |
|---|---|
| **S-29** | **„Szukam drużyny" to jedyny scenariusz w module, który pozyskuje użytkownika bez organizatora.** Cała reszta modułu (zgodnie ze strategią single-player mode, [strategia.md §0](./strategia.md)) czeka, aż ktoś przyprowadzi ludzi. Lista chętnych bez drużyny, z której kapitan kogoś bierze, odwraca ten kierunek — i rozwiązuje realny problem obu stron. **Wymaga decyzji produktowej**, bo to nowa encja (nie ma jej w `145`–`150`) i dokłada powierzchni. Zapisane tutaj, żeby decyzja była świadoma, a nie przeoczona. |

---

## 8. Wnioski przekrojowe — pięć reguł dla tego modułu

1. **Ekran zależy od momentu, nie od zakładki.** Górna część `/turnieje/[id]` ma być inna
   w zapisach (plakat + „Zgłoś drużynę"), inna w dniu turnieju (co teraz trwa, nasz
   następny mecz), inna po finale (podium). Zakładki niech zostaną — zmienia się to, co
   jest nad nimi i która otwiera się domyślnie (`S-11`).
2. **„Moje" przed „wszystkie".** Uczestnik nie chce terminarza turnieju, chce terminarza
   swojej drużyny. Dotyczy `S-16`, `S-19`, `S-26`.
3. **Każdy stan ma artefakt do udostępnienia.** Plakat, link drużyny, terminarz drużyny,
   wynik, podium. Udostępnianie jest w tym module mechanizmem wzrostu, nie ozdobą
   (`S-3`, `S-13`, `S-28`).
4. **Ściana logowania jest ofertą, nie murem** — nazywa konkretną rzecz po drugiej stronie
   (`S-18`, `S-21`).
5. **Funkcja bez ekranu w miejscu, gdzie jej szukają, nie istnieje.** Większość ustaleń
   z tego dokumentu (`S-7`, `S-13`, `S-14`, `S-16`, `S-17`) nie wymaga migracji ani nowej
   logiki — `lib/` ma je napisane i przetestowane. Brakuje wyłącznie miejsca, w którym
   właściwa osoba je zobaczy.

---

## 9. Co z tego wynika — kolejność

Podział na trzy poziomy według jednego kryterium: **czy bez tego można wpuścić ludzi.**

### Poziom 1 — bez tego nie odmrażamy flagi

| # | Rzecz | Dlaczego blokuje |
|---|---|---|
| `S-13` | stałe miejsce na link drużyny + ekran drużyny (`S-14`) | pętla wzrostu urywa się na zamkniętej karcie |
| `S-11` | domyślna zakładka zależna od stanu | każdy udostępniony link ląduje na pustce |
| `S-24` | wartość punktu w koszykówce | fałszywy wynik zapisany do bazy |
| `S-7` | walkower w konsoli prowadzącego | zdarza się na każdym turnieju |
| `S-20` | odświeżanie w dniu turnieju | „na żywo", które nie jest na żywo |

### Poziom 2 — decyduje o tym, czy organizator wróci

`S-2` (wyliczenie czasu w kreatorze), `S-1` (kroki kreatora), `S-3` (plakat po
utworzeniu), `S-9` (podium), `S-19` (powiadomienie o następnym meczu), `S-23` (arkusz
składu zamiast `<select>`), `S-25` (zegar), `S-26` (kolejka na arenie), `S-16` (nasze
mecze).

### Poziom 3 — wzrost i retencja, po pierwszym prawdziwym turnieju

`S-10` (następna edycja), `S-17` (ekipa z podium), `S-27` (zaczepka dla organizatora),
`S-28` (OG per stan), `S-22` (statystyki na profilu), `S-29` (szukam drużyny),
`S-4`/`S-5`/`S-6`/`S-8`/`S-12`/`S-15`/`S-18`/`S-21`.

---

## 10. Rozstrzygnięcia właściciela produktu (podjęte 2026-09-20)

Zapisane, żeby nie wracały co miesiąc jako „a może by jednak". Co z nich wynika dla
ekranów → [turnieje-ux-ekrany.md](./turnieje-ux-ekrany.md).

1. **„Szukam drużyny" (`S-29`) — ODŁOŻONE.** Jedyny scenariusz pozyskujący użytkownika
   bez organizatora, ale nowa encja i nowa powierzchnia. Wraca po pierwszym prawdziwym
   turnieju.
2. **Statystyki turniejowe (`S-22`) — WCHODZĄ na profil gracza.** Osobną sekcją i osobną
   funkcją, bez ruszania `get_player_stats()`, żeby liczby, które ktoś już widział, nie
   zmieniły po cichu znaczenia.
3. **Kapitan zaprasza DWIEMA drogami** — linkiem (dla kolegów spoza Bojo) i imiennie,
   z własnych ekip, wzorem `event_player_invites` (migracja `060`). Domyka to pętlę
   „turniej → ekipa → następny turniej".
4. **Pierwszy turniej prowadzi obcy organizator, nie my.** Zmienia to wymagania wobec
   modułu mocniej, niż wygląda: nikogo nie będzie obok, gdy o 11:40 coś nie zadziała.
   Konsekwencje spisane w [turnieje-ux-ekrany.md §13](./turnieje-ux-ekrany.md).
5. **Tryb „drużyny umawiają się same" — ODŁOŻONY** (projekt zachowany w §12 tamtego
   dokumentu).

## 11. Czego ten dokument nie sprawdził

- **Nie było obserwacji ani jednego użytkownika.** Wszystkie ustalenia to czytanie kodu
  i przejście ścieżek na sucho. Scenariusze są rekonstrukcją, nie badaniem.
- **Nie weryfikowano wydajności** przy pełnym turnieju (64 drużyny, ~200 meczów,
  ~1000 zdarzeń liczonych w przeglądarce).
- **Nie sprawdzano dostępności** (czytnik ekranu, kontrast w słońcu) — a konsola
  prowadzącego jest używana dokładnie w najgorszych warunkach oświetleniowych.
- **Nie ruszano RLS** — granice dostępu są sprawdzane w `supabase/test/rls.sql`
  i ten dokument ich nie kwestionuje.
- **Nie liczono kosztu wdrożenia** żadnego z ustaleń. Kolejność w §9 wynika z wpływu na
  użytkownika, nie z pracochłonności.
