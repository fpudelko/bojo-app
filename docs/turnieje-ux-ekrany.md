# Turnieje — ekrany, układy i scenariusze (projekt UX)

> **Stan: 2026-09-20.** Projekt interfejsu modułu turniejowego: co widzi organizator,
> kapitan i gracz, w jakim układzie i w jakiej kolejności.
>
> Dokument-rodzeństwo: [turnieje-scenariusze-ux.md](./turnieje-scenariusze-ux.md) mówi,
> **co jest dziś zepsute** (ustalenia `S-1`…`S-29`). Ten mówi, **jak to ma wyglądać**.
> Decyzje pierwotne → [turnieje-plan-duze-klocki.md](./turnieje-plan-duze-klocki.md),
> schemat i sygnatury → [turnieje-plan-srednie-klocki.md](./turnieje-plan-srednie-klocki.md).
>
> Szkice ekranów są w szerokości telefonu (360 px) — bo tam ten moduł żyje. Wszystko,
> co w nich stoi, ma być czytelne na stojąco, w słońcu, jedną ręką.

---

## Decyzje właściciela produktu (2026-09-20)

Zapisane, żeby nie wracały co miesiąc jako „a może by jednak".

1. **Tryb „drużyny umawiają się same" — ODŁOŻONY.** Projekt zostaje w §12, żeby nie
   przepadł; nie budujemy go teraz. Dwie pozostałe wartości `tryb_terminarza`
   (`jeden_dzien`, `kolejki`) zostają w zakresie.
2. **„Szukam drużyny" (gracz bez drużyny) — ODŁOŻONE.**
3. **Kapitan zaprasza DWIEMA drogami: linkiem i imiennie** — tak samo jak organizator
   zaprasza na mecz (`event_player_invites`, migracja `060`). Projekt → §5.2.
4. **Wyniki turniejowe TRAFIAJĄ na profil gracza.** Projekt → §6.5.
5. **Pierwszy turniej prowadzi obcy organizator, nie my** — ktoś, kto turnieje robi
   i tak, a naszej aplikacji użyje do obsługi. Co to zmienia → §13.

---

## 0. Co ten dokument rozstrzyga

Trzy rzeczy, których nie było w planie:

1. **Że turnieje są trzech rodzajów**, a dzisiejsza kolumna `format` potrafi opisać
   tylko jeden z nich (§1).
2. **Że turniej to najpierw ogłoszenie, a dopiero potem rozgrywka** — i że kreator
   powinien się na tym przełamać (§2).
3. **Że kapitan jest osobną rolą z własnym ekranem**, a nie graczem z dodatkowym
   przyciskiem (§6).

---

## 1. Trzy rodzaje turnieju — dwie osie zamiast jednej

Dziś `turnieje.format` ma trzy wartości: `grupy_puchar`, `puchar`, `liga`. To opisuje
**jak wyłaniamy zwycięzcę**. Ale rodzaje turniejów, które realnie się organizuje, różnią
się czymś innym — **jak mecze dostają termin**:

| Rodzaj | Jak to wygląda w życiu | Kto ustala termin meczu |
|---|---|---|
| **Jeden dzień** | sobota, 8 drużyn, 3 boiska, od 10:00 do 16:00 | generator, z góry, co do minuty |
| **Kolejki z terminarzem** | liga zakładowa, 10 tygodni, wtorki 20:00, ta sama hala | organizator, kolejka po kolejce |
| **Drużyny umawiają się same** | liga amatorska, „rozegrajcie mecz do końca marca" | dwaj kapitanowie, między sobą |

**To są dwie niezależne osie.** Liga może być jednodniowa (4 drużyny, każdy z każdym,
jedno popołudnie) albo rozłożona na kwartał. Puchar może być rozegrany w sobotę albo
przez sześć tygodni, gdzie każda para umawia się sama. Wszystkie dziewięć kombinacji
ma sens:

|  | **Jeden dzień** | **Kolejki z terminarzem** | **Umawiają się same** |
|---|---|---|---|
| **Grupy → puchar** | klasyczny turniej weekendowy | liga z play-offami | rzadkie, ale poprawne |
| **Puchar** | streetball, plażówka | puchar rozgrywany tygodniami | puchar „do końca miesiąca" |
| **Liga** | 4 drużyny, jedno popołudnie | liga zakładowa, amatorska | liga elastyczna |

### Wniosek: `format` × `tryb`

Proponowana zmiana — **jedna nowa kolumna**:

```sql
ALTER TABLE turnieje ADD COLUMN IF NOT EXISTS tryb_terminarza text
  NOT NULL DEFAULT 'jeden_dzien'
  CHECK (tryb_terminarza IN ('jeden_dzien','kolejki','umawiane'));
```

Nazwy w interfejsie (kapitan i organizator czytają to, nie `enum`):

```
Kiedy gracie?

  ◉  Wszystko w jeden dzień
     Sobota albo weekend, jedno lub kilka boisk obok siebie.
     Wyniki wpisuje prowadzący na miejscu.

  ○  Kolejka co tydzień
     Mecze rozłożone na tygodnie. Terminy i miejsce ustalasz Ty.

  ○  Drużyny umawiają się same
     Ty dajesz pary i termin graniczny kolejki.
     Kiedy i gdzie — dogadują kapitanowie.
```

> **Zakres po decyzji z 2026-09-20:** budujemy `jeden_dzien` i `kolejki`. Trzeci tryb
> (`umawiane`) jest odłożony — kolumna dostaje na razie dwie wartości, trzecia dokłada
> się później bez zmiany istniejących wierszy. Projekt trzeciego trybu zostaje w §12,
> bo ma wartość w chwili, gdy decyzja się odwróci, a odtwarzanie go od zera kosztuje
> drugi raz tyle samo.

**Trzeci tryb to mechanika skasowanego „BOJO Cup"** (migracje `029`/`030`, usunięte
migracją `151`): drużyny umawiają mecze same, wynik zgłasza kapitan, rywal potwierdza.
Tamten moduł zginął, bo był **osobnym produktem dla jednej edycji zakładanej przez
admina** — nie dlatego, że mechanika była zła. Wraca tu jako **tryb**, nie jako drugi
moduł. Warto to zapisać, bo bez tego zdania wygląda na cofanie decyzji z 2026-09-13.

### Co każdy tryb zmienia w interfejsie

| | Jeden dzień | Kolejki | Umawiają się same |
|---|---|---|---|
| Areny (boiska) | **tak**, kilka naraz | jedna, stała | brak — każdy mecz gdzie indziej |
| Godzina meczu | co do minuty | data + godzina kolejki | ustalana przez kapitanów |
| „Przesuń o 10 min" | **kluczowe** | nieużywane | bez sensu |
| Wpis wyniku | konsola prowadzącego, na żywo | organizator po kolejce | kapitan zgłasza, rywal potwierdza |
| Powiadomienie „jesteście następni" | **kluczowe** | nie dotyczy | nie dotyczy |
| Przypomnienie | brak (wszyscy są na miejscu) | dzień przed kolejką | „zostały 4 dni na rozegranie" |
| Główny ekran w dniu meczu | tablica na żywo | karta kolejki | karta „wasz mecz do rozegrania" |

---

## 2. Dwa akty: ogłoszenie, potem rozgrywka

Dzisiejszy kreator pyta o wszystko naraz: nazwę, sport, daty, miejsce, format, liczbę
grup, limity składu, widoczność, akceptację, wpisowe, regulamin, opis. **Połowy z tych
rzeczy organizator w tym momencie nie wie** — bo nie wie jeszcze, ile drużyn się zgłosi.
Liczba grup przy 7 drużynach i przy 12 to dwa różne turnieje.

**Turniej ma dwa akty i kreator ma się na tym przełamać:**

```
AKT I — OGŁOSZENIE                      AKT II — ROZGRYWKA
(kreator, 6 pól, 2 minuty)              (panel, gdy wiadomo ilu was jest)

  co, kiedy, gdzie                        format (grupy/puchar/liga)
  ile drużyn                              tryb terminarza
  wpisowe                                 liczba grup, awans
  → PLAKAT + zapisy otwarte               czas meczu, przerwy, punktacja
                                          areny, losowanie, terminarz
```

Stan `szkic` w bazie już to umożliwia — brakuje wyłącznie podziału w interfejsie.

### Kreator — akt I

```
┌──────────────────────────────────┐
│ ← Wróć                           │
│                                  │
│ Nowy turniej                     │
│ Za chwilę dostaniesz link do     │
│ wysłania kapitanom.              │
│                                  │
│ Nazwa turnieju                   │
│ ┌──────────────────────────────┐ │
│ │ Turniej o Puchar Dzielnicy   │ │
│ └──────────────────────────────┘ │
│                                  │
│ Sport      ⚽ 🏀 🏐 🎾           │
│                                  │
│ Kiedy                            │
│ ┌────────────┐ ┌───────────────┐ │
│ │ 18.10.2026 │ │ 10:00         │ │
│ └────────────┘ └───────────────┘ │
│                                  │
│ Gdzie                            │
│ ┌──────────────────────────────┐ │
│ │ 🔍 Orlik Dąbrowskiego 12     │ │
│ └──────────────────────────────┘ │
│                                  │
│ Ile drużyn     [−]  8  [+]       │
│ Wpisowe        [ 100 ] zł/drużyna│
│                                  │
│ ─────────────────────────────    │
│ ⏱  8 drużyn, grupy → puchar,     │
│    2×10 min, 2 boiska            │
│    → 21 meczów, koniec ok. 16:40 │
│    Zmienisz to później.          │
│ ─────────────────────────────    │
│                                  │
│ ┌──────────────────────────────┐ │
│ │      Opublikuj turniej       │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

**Wyliczenie czasu (`S-2`) jest najważniejszym zdaniem w tym ekranie.** To jedyna rzecz,
której organizator nie policzy w głowie, a od której zależy, czy o 17:00 nie będzie
grał finału po ciemku. Liczy się z danych, które już są (`czas_meczu_min`, `przerwa_min`,
liczba aren, `meczeKazdyZKazdym`/`zbudujDrabinke` z `lib/turniejFormat.ts`) i musi się
przeliczać na żywo przy każdej zmianie suwaka.

### Ekran po publikacji — akt I kończy się plakatem, nie panelem (`S-3`)

```
┌──────────────────────────────────┐
│           🏆                     │
│    Turniej jest ogłoszony        │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ [ podgląd obrazka OG:        │ │
│ │   nazwa, data, miejsce,      │ │
│ │   „zapisy otwarte" ]         │ │
│ └──────────────────────────────┘ │
│                                  │
│ ┌──────────────────────────────┐ │
│ │   📤  Wyślij kapitanom       │ │
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │   🔗  Kopiuj link            │ │
│ └──────────────────────────────┘ │
│                                  │
│ Gotowy tekst na grupę:           │
│ ┌──────────────────────────────┐ │
│ │ Turniej o Puchar Dzielnicy   │ │
│ │ ⚽ sobota 18.10, 10:00       │ │
│ │ 📍 Orlik Dąbrowskiego        │ │
│ │ 8 drużyn · 100 zł/drużyna    │ │
│ │ Zapisy: bojo.pl/turnieje/... │ │
│ │                    [Kopiuj]  │ │
│ └──────────────────────────────┘ │
│                                  │
│ Co dalej: gdy zgłoszą się        │
│ drużyny, ustawisz format         │
│ i wygenerujesz terminarz.        │
│                   Przejdź do → │
└──────────────────────────────────┘
```

Organizator wychodzi z narzędzia z rzeczą, po którą przyszedł. Dziś wychodzi do panelu
z zakładkami.

---

## 3. Ekran turnieju — jeden adres, zmienna głowa

`/turnieje/[id]` to **publiczna twarz turnieju**: to on trafia na Facebooka i na
WhatsAppa. Zakładki zostają stałe, ale **nad nimi stoi blok zależny od momentu**, a
domyślna zakładka wynika ze stanu (`S-11`).

```
STAŁY SZKIELET                     GŁOWA ZALEŻY OD STANU
┌──────────────────────────┐
│ ← Nazwa turnieju      📤 │       zapisy      → PLAKAT
├──────────────────────────┤       zamknięte   → ODLICZANIE
│                          │       trwa        → TABLICA NA ŻYWO
│      ◆  G Ł O W A  ◆     │       zakończony  → PODIUM
│                          │
├──────────────────────────┤       DOMYŚLNA ZAKŁADKA
│ Mecze │Tabela│Druż.│Info │       zapisy      → Info
├──────────────────────────┤       zamknięte   → Mecze
│                          │       trwa        → Mecze
│        treść             │       zakończony  → Tabela
└──────────────────────────┘
```

### Głowa A — zapisy trwają (widzi ją człowiek z Facebooka)

```
┌──────────────────────────────────┐
│ ← Puchar Dzielnicy            📤 │
├──────────────────────────────────┤
│  ⚽  TRWAJĄ ZAPISY               │
│                                  │
│  sobota 18 października, 10:00   │
│  📍 Orlik Dąbrowskiego 12        │
│     Poznań-Jeżyce      Nawiguj → │
│                                  │
│  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░  6 z 8 drużyn  │
│  Zostały 2 miejsca               │
│  ⏳ Zapisy do czwartku 16.10     │
│                                  │
│  100 zł od drużyny · 5–12 osób   │
│                                  │
│ ┌──────────────────────────────┐ │
│ │       Zgłoś drużynę          │ │
│ └──────────────────────────────┘ │
│   Nie masz drużyny? Zgłoś się    │
│   pojedynczo →                   │
├──────────────────────────────────┤
│ Info │ Drużyny │ Mecze │ Tabela  │
└──────────────────────────────────┘
```

Trzy rzeczy, których dziś nie ma: **pasek zapełnienia z liczbą wolnych miejsc**,
**termin graniczny zapisów** (kolumna `zapisy_do` **istnieje w bazie od migracji `145`
i jest ignorowana** — `przyjmujeZgloszenia()` patrzy wyłącznie na status i limit) oraz
**wyjście dla gracza bez drużyny** (`S-29`).

### Głowa B — zapisy zamknięte, turniej za chwilę

```
┌──────────────────────────────────┐
│  ⚽  ZAPISY ZAMKNIĘTE            │
│                                  │
│      Start za 2 dni              │
│   sobota 18.10, 10:00            │
│   8 drużyn · 2 boiska            │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ TWOJA DRUŻYNA: Dziki         │ │
│ │ Pierwszy mecz: 10:00         │ │
│ │ Boisko 1, z Orłami        →  │ │
│ │ Skład: 7 z 8   Wpisowe: ✓    │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

### Głowa C — dzień turnieju, tryb „jeden dzień"

To jest ekran, na który w sobotę patrzy sto osób naraz. **Odświeża się sam co 20 s**
(`S-20`).

```
┌──────────────────────────────────┐
│  🔴 NA ŻYWO        odświeżono 12s│
│                                  │
│  BOISKO 1        BOISKO 2        │
│  Dziki   2       Wilki   0       │
│  Orły    1       Sokoły  3       │
│  ⏱ 7'            ⏱ 7'            │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ WASZ NASTĘPNY MECZ           │ │
│ │ 11:20 · Boisko 2 · z Sokoły  │ │
│ │ za ok. 25 minut           →  │ │
│ └──────────────────────────────┘ │
│                                  │
│  📣 Przerwa obiadowa 13:00–13:30 │
└──────────────────────────────────┘
```

### Głowa D — po finale (największy zasięg w całym module, dziś pusta — `S-9`)

```
┌──────────────────────────────────┐
│           ZAKOŃCZONY             │
│                                  │
│            🥇                    │
│          D Z I K I               │
│                                  │
│     🥈 Orły      🥉 Wilki        │
│                                  │
│  👟 Król strzelców               │
│     Marek Nowak (Dziki) · 7 goli │
│  ⭐ MVP turnieju                 │
│     Paweł Kot (Orły)             │
│                                  │
│ ┌──────────────────────────────┐ │
│ │   📤  Udostępnij wyniki      │ │
│ └──────────────────────────────┘ │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ 🔁 Zamień drużynę w ekipę    │ │
│ │ Graliście razem — grajcie    │ │
│ │ dalej. Zostanie Wam ekipa    │ │
│ │ w Bojo z całym składem.      │ │
│ └──────────────────────────────┘ │
│  (kapitan)                       │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ 🏆 Zrób podobny turniej      │ │
│ └──────────────────────────────┘ │
│  (organizator + każdy inny)      │
└──────────────────────────────────┘
```

Tu wychodzą na wierzch dwie funkcje, które dziś są schowane: „Zamień drużynę w ekipę"
(`S-17`, dziś trzy kliknięcia w głąb zakładki Drużyny) i zaczepka dla obcego organizatora
(`S-27`).

---

## 4. Organizator — panel

`/turnieje/[id]/panel`. Dziś: Drużyny · Ludzie · Terminarz · Ustawienia. Brakuje tego,
co ma być pierwsze: **odpowiedzi na „jak mi idzie" i „co mam zrobić teraz"** (`S-4`, `S-8`).

### Pulpit — nowa pierwsza zakładka, zmienia się z turniejem

**Przed turniejem — lista rzeczy do zrobienia:**

```
┌──────────────────────────────────┐
│ ← Puchar Dzielnicy · panel       │
├──────────────────────────────────┤
│ Pulpit│Druż.│Termin│Ludzie│Ustaw.│
├──────────────────────────────────┤
│                                  │
│  DO STARTU: 2 DNI                │
│                                  │
│  ✓ Turniej ogłoszony             │
│  ✓ 8 z 8 drużyn                  │
│  ⚠ 5 z 8 opłaciło wpisowe        │
│      → zobacz kto (3)            │
│  ⚠ Terminarz niewygenerowany     │
│      → ułóż terminarz            │
│  ✗ Nie masz numeru BLIK          │
│      → dodaj                     │
│                                  │
│  2 zgłoszenia czekają na decyzję │
│  ┌────────────────────────────┐  │
│  │ Rysie      [Przyjmij][Nie] │  │
│  │ Barbarzyńcy[Przyjmij][Nie] │  │
│  └────────────────────────────┘  │
│                                  │
│ ┌──────────────────────────────┐ │
│ │    📣  Napisz ogłoszenie     │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

**W dniu turnieju — ten sam pulpit staje się wieżą kontrolną:**

```
┌──────────────────────────────────┐
│  SOBOTA 11:07   🔴 turniej trwa  │
│  Opóźnienie: +12 min względem    │
│  planu                           │
│ ┌──────────────────────────────┐ │
│ │ ⏩ Przesuń resztę o 10 min   │ │
│ └──────────────────────────────┘ │
│                                  │
│  BOISKO 1                        │
│  ▶ teraz  Dziki 2–1 Orły  ⏱7'    │
│    potem  11:20 Rysie–Wilki      │
│                                  │
│  BOISKO 2                        │
│  ▶ teraz  Wilki 0–3 Sokoły ⏱7'   │
│    potem  11:20 Dziki–Sokoły     │
│                                  │
│  ⚠ Barbarzyńcy nie zgłosili się  │
│    do meczu M7                   │
│    [Walkower] [Czekam]           │
└──────────────────────────────────┘
```

Przycisk „Przesuń resztę o 10 minut" to — zgodnie z planem (§9) — najmocniejsza funkcja
organizatorska i musi stać **tutaj**, w miejscu, w które organizator patrzy co kwadrans,
a nie w zakładce Terminarz.

### Terminarz — układanie (akt II)

```
┌──────────────────────────────────┐
│  FORMAT                          │
│  ◉ Grupy → puchar                │
│  ○ Puchar   ○ Liga               │
│                                  │
│  8 drużyn → 2 grupy po 4         │
│  awansuje 2 z grupy              │
│  [−] 2 grupy [+]                 │
│                                  │
│  BOISKA                          │
│  • Boisko 1        ✎ ✕           │
│  • Boisko 2        ✎ ✕           │
│  + Dodaj boisko                  │
│                                  │
│  Mecz 2×10 min, przerwa 5 min    │
│                                  │
│ ─────────────────────────────    │
│ ⏱  21 meczów · start 10:00       │
│    ostatni gwizdek 16:40         │
│    Zmieści się przed zmrokiem ✓  │
│ ─────────────────────────────    │
│                                  │
│ ┌──────────────────────────────┐ │
│ │  🎲 Rozlosuj grupy           │ │
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │  Wygeneruj terminarz         │ │
│ └──────────────────────────────┘ │
│                                  │
│  ⚠ Dziki grają 2 mecze pod rząd  │
│     (11:20 i 11:40)              │
│                                  │
│ ┌──────────────────────────────┐ │
│ │  ✅ Opublikuj terminarz       │ │
│ │  Powiadomimy 8 kapitanów     │ │
│ │  i 61 zawodników             │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

**Publikacja terminarza jest zdarzeniem, nie zapisem** (`S-6`). Podgląd → publikacja →
powiadomienie. Każda późniejsza zmiana godziny to **zmiana** i leci osobnym
powiadomieniem, wzorem `lib/zmianyMeczu.ts`.

### Konsola prowadzącego — `/turnieje/[id]/mecz/[meczId]`

Ekran, od którego zależy wiarygodność całego modułu: sześć godzin, słońce, jedna ręka.

```
┌──────────────────────────────────┐
│ ← M7 · Faza grupowa · Boisko 2   │
├──────────────────────────────────┤
│                                  │
│   DZIKI      2 – 1      ORŁY     │
│                                  │
│        ⏱  07:42                  │
│      [ Pauza ]  [ Koniec połowy ]│
│                                  │
├──────────────────────────────────┤
│ ┌──────────────┐┌──────────────┐ │
│ │              ││              │ │
│ │   ⚽ GOL     ││   ⚽ GOL     │ │
│ │    DZIKI     ││    ORŁY      │ │
│ │              ││              │ │
│ └──────────────┘└──────────────┘ │
│  🟨 🟥 ⊘samob.    🟨 🟥 ⊘samob.  │
│                                  │
│  ↩ Cofnij ostatnie               │
├──────────────────────────────────┤
│  PRZEBIEG                        │
│  7'  ⚽ Nowak (Dziki)            │
│  4'  ⚽ Kot (Orły) as. Mak       │
│  2'  ⚽ Nowak (Dziki)            │
└──────────────────────────────────┘

po dotknięciu „GOL DZIKI" wjeżdża
arkusz od dołu:

┌──────────────────────────────────┐
│  Kto strzelił?        [Pomiń]    │
│ ┌────┐┌────┐┌────┐┌────┐         │
│ │ 7  ││ 9  ││ 4  ││ 11 │         │
│ │Nowak│Kot ││Mak ││Duda│         │
│ └────┘└────┘└────┘└────┘         │
│ ┌────┐┌────┐┌────┐               │
│ │ 3  ││ 5  ││ 8  │               │
│ │Wilk││Król││Sowa│               │
│ └────┘└────┘└────┘               │
└──────────────────────────────────┘
        ↓ jedno dotknięcie
┌──────────────────────────────────┐
│  Asysta?  (opcjonalnie) [Pomiń]  │
│  … te same kafle …               │
└──────────────────────────────────┘
```

Zmiany wobec dzisiejszego ekranu:

| Dziś | Ma być | Dlaczego |
|---|---|---|
| `<select>` ze strzelcem, drugi `<select>` z asystą, potem „Gol" | dotknięcie „GOL" → arkusz z kaflami składu → arkusz asysty | `S-23`: natywne menu na telefonie zasłania ekran i wymaga precyzji, której nie ma człowiek w słońcu |
| brak zegara | zegar meczu z pauzą, bez zapisu do bazy | `S-25`: dziś prowadzący przełącza się do stopera w innej aplikacji |
| `+1 / +2 / +3` zapisują po jednym punkcie | wartość idzie do `turniej_zdarzenia.wartosc` | `S-24`: **błąd**, nie brak funkcji — trójka liczy się jak wolny rzut |
| brak walkowera | `⋯` → „Drużyna się nie zgłosiła → walkower" | `S-7`: zdarza się na każdym turnieju amatorskim |
| po „Zakończ mecz" powrót na listę | „Następny na Boisku 2: Rysie–Wilki 11:20 · Rozpocznij" | `S-26`: zamienia sześć godzin szukania w kolejkę |

---

## 5. Kapitan — ekran, którego nie ma

**To jest największa dziura w module i zarazem miejsce, w którym mieszka cała pętla
wzrostu Bojo.** Turniej na 12 drużyn to 12 kapitanów i ~90 zawodników; każdy z nich
zakłada konto **tylko dlatego**, że kapitan wysłał mu link.

Dziś kapitan dostaje ten link **dokładnie raz** — na ekranie potwierdzenia zgłoszenia.
Kto zamknął kartę, nie odzyska go nigdzie (`S-13`). Operacje kapitańskie (dopisz
zawodnika, zmień nazwę, przekaż kapitaństwo, wycofaj drużynę) **są napisane
i przetestowane** w `lib/turniejDruzyny.ts` i nie mają ani jednego przycisku poza panelem
organizatora (`S-14`).

### 5.1. Nowa trasa: `/turnieje/[id]/druzyna/[druzynaId]`

Publiczna dla wszystkich (skład za ścianą logowania), z dodatkowymi przyciskami dla
kapitana.

```
┌──────────────────────────────────┐
│ ← Dziki                       📤 │
│   Puchar Dzielnicy · sob. 18.10  │
├──────────────────────────────────┤
│                                  │
│  ╔══════════════════════════════╗│
│  ║  SKŁAD: 5 z 8                ║│
│  ║  ▓▓▓▓▓▓▓▓▓▓░░░░░░            ║│
│  ║  Brakuje 3 osób do pełnego   ║│
│  ║                              ║│
│  ║ ┌──────────────────────────┐ ║│
│  ║ │ 📤 Wyślij link kolegom   │ ║│
│  ║ └──────────────────────────┘ ║│
│  ║   bojo.pl/t/K3M9WQ    [kopiuj]║│
│  ╚══════════════════════════════╝│
│                                  │
│  ZAWODNICY                       │
│  ⓵ Marek Nowak    kapitan        │
│  ⓻ Paweł Kot                     │
│  ⓸ Jan Mak                       │
│  ⓹ Adam Wilk                     │
│  ⓷ Tomek Duda   dopisany ręcznie │
│                                  │
│  + Dopisz zawodnika bez konta    │
│                                  │
│  WPISOWE                         │
│  100 zł — nieopłacone            │
│  BLIK: 601 234 567    [kopiuj]   │
│                                  │
│  NASZE MECZE                     │
│  10:00 Boisko 1  z Orłami        │
│  11:20 Boisko 2  z Sokoły        │
│  12:40 Boisko 1  z Rysiami       │
│                                  │
│  ⋯ Zmień nazwę · Przekaż         │
│    kapitaństwo · Wycofaj drużynę │
└──────────────────────────────────┘
```

**Licznik „5 z 8" jest sercem tego ekranu** (`S-15`). Zamienia bierne czekanie
w czynność: widać, ilu brakuje, i jest jeden przycisk, żeby to zmienić. Turniej zna już
`min_zawodnikow`/`max_zawodnikow`, więc licznik jest do policzenia dziś, bez migracji.

Wejścia do tego ekranu: pasek „Twoja drużyna" na stronie turnieju, karta drużyny
w zakładce Drużyny, powiadomienie o przyjęciu zgłoszenia, `/moje-gry`.

### 5.2. Kapitan zaprasza imiennie — drugą drogą obok linku

Link działa na WhatsAppie i dla kolegów spoza Bojo; **imienne zaproszenie działa dla
tych, którzy konto już mają** — i to ono zamienia turniej w rzecz, która sama pojawia
się w aplikacji, zamiast ginąć w linku wklejonym na czacie.

Wzorzec jest gotowy i nie wymyślamy go od nowa: `event_player_invites` (migracja `060`,
`lib/playerInvites.ts`). Powtarzamy jego trzy zasady co do joty:

- **zaproszenie nie zajmuje miejsca w składzie i niczego nie przesądza** — jest
  wyłącznie sposobem, żeby rzecz pojawiła się u zapraszanego,
- **duplikaty pomija baza** (`UNIQUE (druzyna_id, user_id)`), więc powtórne „zaproś
  ekipę" nie wskrzesza zaproszenia, które ktoś świadomie odrzucił,
- **odrzucone zostaje w tabeli** (`dismissed_at`), żeby nie wróciło.

**Skąd kapitan bierze ludzi: ze swoich ekip** — dokładnie tak, jak
`InviteFromGroupDialog.tsx` bierze ich przy meczu (`getMyGroups` → `getGroupMembers`,
domyślnie zaznaczeni wszyscy, bo „zaproś całą ekipę" to najczęstszy przypadek).

```
┌──────────────────────────────────┐
│  SKŁAD: 5 z 8                    │
│  ▓▓▓▓▓▓▓▓▓▓░░░░░░                │
│                                  │
│ ┌──────────────┐┌──────────────┐ │
│ │ 📤 Wyślij    ││ 👥 Zaproś    │ │
│ │    link      ││    z ekipy   │ │
│ └──────────────┘└──────────────┘ │
└──────────────────────────────────┘
        ↓ „Zaproś z ekipy"
┌──────────────────────────────────┐
│  Zaproś do drużyny Dziki     ✕   │
│                                  │
│  Ekipa: [ Czwartkowa gierka  ▾ ] │
│                                  │
│  ☑ Marek Nowak                   │
│  ☑ Paweł Kot                     │
│  ☑ Jan Mak                       │
│  ☐ Adam Wilk    już w składzie   │
│  ☐ Ola Sowa     zaproszona       │
│                                  │
│ ┌──────────────────────────────┐ │
│ │      Zaproś 3 osoby          │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

Zaproszony widzi turniej **tam, gdzie dziś widzi zaproszenia na mecz** — na stronie
głównej (`DashboardSections.tsx`), nie w osobnym miejscu do nauczenia się:

```
┌──────────────────────────────────┐
│  ZAPROSZENIA                     │
│ ┌──────────────────────────────┐ │
│ │ 🏆 Marek zaprasza Cię do      │ │
│ │    drużyny Dziki             │ │
│ │    Puchar Dzielnicy          │ │
│ │    ⚽ sob. 18.10, Orlik       │ │
│ │    [ Dołączam ]  [ Nie mogę ]│ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

### 5.3. Pętla, która się domyka

To jest powód, dla którego „Zamień drużynę w ekipę" przestaje być miłym dodatkiem
i staje się mechanizmem:

```
   turniej  ──►  drużyna  ──►  „Zamień w ekipę"  ──►  EKIPA
                                                        │
   następny turniej  ◄── „Zaproś z ekipy" (1 dotknięcie)┘
```

Pierwszy turniej kapitan zbiera po jednym, linkiem, przez WhatsAppa. Drugi — jednym
dotknięciem z ekipy, która została po pierwszym. **Trzeci turniej jest dla niego
tańszy niż Excel**, a to jest jedyny trwały powód, dla którego ktoś zostaje w Bojo.

## 6. Gracz — cztery ekrany, jedno powiadomienie i ślad, który zostaje

Gracz to 90 osób z tych ~105 w turnieju. Ma dziś **zero własnych ekranów**.

### 6.1. Wejście: `/t/[kod]` — pierwszy kontakt z Bojo (`S-18`)

Dziś ten ekran prosi o założenie konta w nieznanym serwisie w zamian za nic. Ma
najpierw powiedzieć, do czego człowiek dołącza:

```
┌──────────────────────────────────┐
│                                  │
│  Marek zaprasza Cię do drużyny   │
│                                  │
│         D Z I K I                │
│                                  │
│  🏆 Puchar Dzielnicy             │
│  ⚽ sobota 18.10, 10:00          │
│  📍 Orlik Dąbrowskiego, Poznań   │
│                                  │
│  W składzie już są:              │
│  Marek N. · Paweł K. · Jan M.    │
│  i 2 inne osoby                  │
│                                  │
│ ┌──────────────────────────────┐ │
│ │   Dołącz do drużyny          │ │
│ └──────────────────────────────┘ │
│  Konto zakładasz przy okazji —   │
│  Google albo e-mail, bez         │
│  instalowania niczego.           │
└──────────────────────────────────┘
```

### 6.2. W dniu turnieju: „nasze mecze" (`S-16`)

Uczestnik nie chce terminarza turnieju — chce terminarza swojej drużyny. Nad istniejącą
listą meczów wystarczy jeden przełącznik:

```
┌──────────────────────────────────┐
│ ┌────────────┬─────────────────┐ │
│ │ NASZE (3)  │  Wszystkie (21) │ │
│ └────────────┴─────────────────┘ │
│                                  │
│  ▶ TERAZ · Boisko 1              │
│    Dziki 2 – 1 Orły        ⏱7'   │
│                                  │
│  11:20 · Boisko 2                │
│    Dziki – Sokoły                │
│                                  │
│  12:40 · Boisko 1                │
│    Dziki – Rysie                 │
└──────────────────────────────────┘
```

Domyślnie **„Nasze"**, gdy człowiek jest w składzie którejś drużyny.

### 6.3. Powiadomienie, którego brakuje — `turniej_nastepny_mecz` (`S-19`)

> **Dziki — wasz mecz jest następny**
> Boisko 2, ok. 11:20, z Sokoły

Wysyłane w chwili zakończenia poprzedniego meczu na tej arenie. Zero crona, zero zegara —
wyzwalacz przy zamknięciu meczu. Plan nazwał je najlepszym typem w module (§12); w
migracjach `145`–`150` jest **siedem** typów turniejowych z dziewięciu i brakuje właśnie
tego. Dotyczy wyłącznie trybu „jeden dzień"; w pozostałych rolę tę pełni przypomnienie
dzień przed kolejką albo „zostały 4 dni na rozegranie meczu".

### 6.4. Ściana logowania jako oferta, nie mur (`S-21`)

```
   źle                      dobrze
┌──────────────┐   ┌──────────────────────┐
│ Statystyki   │   │  Dziki 3 – 2 Orły    │
│ graczy       │   │                      │
│              │   │  Kto strzelił? 🔒    │
│ [Zaloguj się]│   │  Zaloguj się, żeby   │
└──────────────┘   │  zobaczyć strzelców, │
                   │  asysty i MVP.       │
                   │     [Zaloguj się]    │
                   └──────────────────────┘
```

---

### 6.5. Po turnieju: ślad na profilu gracza

**Decyzja 2026-09-20: wyniki turniejowe trafiają na `/gracz/[id]`.** To jedyny powód,
dla którego zawodnik wraca do Bojo w tygodniu po turnieju — bez tego konto założone pod
jeden turniej jest kontem założonym na jeden dzień.

**Nie dopisujemy tego do istniejących liczników.** `get_player_stats()` (migracja `074`)
liczy `matches_played`, `goals_total`, `no_shows` z meczów — i te liczby mają dziś
konsekwencje: `matchesPlayed` i `noShows` sterują odznaką rzetelnego gracza i paskiem
frekwencji (`/gracz/[id]/page.tsx`). Wrzucenie tam turniejów po cichu zmieniłoby
znaczenie liczb, które ktoś już widział. Do tego mecz turniejowy jest **inną rzeczą** niż
gierka: nie ma w nim rezerwy, zapisów ani nieobecności.

Dlatego: **osobna sekcja, osobna funkcja** — `get_player_turniej_stats(p_user_id)`,
licząca z `turniej_zawodnicy` (po `user_id`), `turniej_zdarzenia` i `turniej_mecze`.
Twarda granica z planu zostaje nienaruszona: zero zmian w `events`, `event_participants`
i `get_player_stats`.

```
┌──────────────────────────────────┐
│  🏆 Statystyki                   │
│ ┌──────────────┐┌──────────────┐ │
│ │ Mecze        ││ Zorganizowane│ │
│ │ rozegrane 47 ││            6 │ │
│ └──────────────┘└──────────────┘ │
│  Frekwencja  ▓▓▓▓▓▓▓▓▓░  94%     │
├──────────────────────────────────┤
│  🏅 Turnieje                     │
│ ┌──────┐┌──────┐┌──────┐┌──────┐ │
│ │  3   ││  11  ││  7   ││  2   │ │
│ │turni.││mecze ││ gole ││ MVP  │ │
│ └──────┘└──────┘└──────┘└──────┘ │
│                                  │
│  🥇 Puchar Dzielnicy   wrz 2026  │
│     Dziki · 1. miejsce           │
│     5 meczów · 4 gole · 1 MVP    │
│                                  │
│  🥉 Liga Jeżycka       cze 2026  │
│     Dziki · 3. miejsce           │
│     6 meczów · 3 gole            │
└──────────────────────────────────┘
```

Trzy rzeczy, które ta sekcja musi trzymać:

- **Miejsce w turnieju jest ważniejsze niż liczby.** „1. miejsce" pamięta się rok;
  „4 gole" nie. Wyliczane z `posortujTabele()` i drabinki, tak samo jak na stronie
  turnieju — **nie zapisywane jako osobna kolumna**, bo dwie prawdy o tym, kto wygrał,
  rozjadą się przy pierwszej korekcie wyniku.
- **Sekcja stoi za ścianą logowania**, jak reszta modułu (plan §5). Kto nie ma konta,
  widzi kartę z zaproszeniem — a to jest dobre miejsce na konwersję, bo ogląda
  konkretnego człowieka, nie abstrakcyjną listę.
- **Zero sekcji, gdy zero turniejów.** Pusta „🏅 Turnieje: 0" na profilu 90% graczy to
  szum. Sekcja pojawia się przy pierwszym turnieju.

Wejście w drugą stronę już działa: skład drużyny prowadzi do `/gracz/[id]`
(`KartaDruzyny.tsx`), więc po dołożeniu tej sekcji **ścieżka się zamyka** — z turnieju
w profil i z profilu w turniej.

---

## 7. Zapisywanie wyników — dwie drogi, jedna tabela

To jest miejsce, w którym tryby najmocniej się rozjeżdżają. **Dane docelowe są te same**
(`turniej_mecze.wynik_a/b` + `turniej_zdarzenia`) — różni się droga:

```
JEDEN DZIEŃ            KOLEJKI              (UMAWIANE — §12,
prowadzący             organizator           odłożone)
na boisku, na żywo     po kolejce
      │                      │
      │ konsola              │ lista kolejki
      │ gol po golu          │ 5 wyników naraz
      ▼                      ▼
 turniej_zdarzenia      wynik_recznie=true
      │                      │
      └──────────┬───────────┘
                 ▼
        turniej_mecze.wynik_a/b
                 ▼
        obliczTabele() · Drabinka · Klasyfikacja · profil gracza (§6.5)
```

Wpis zbiorczy dla trybu „kolejki" — ekran, którego dziś nie ma:

```
┌──────────────────────────────────┐
│  KOLEJKA 3 · wtorek 24.03        │
│                                  │
│  Dziki    [3] – [2]   Wilki      │
│  Orły     [1] – [1]   Sokoły     │
│  Rysie    [ ] – [ ]   Barbarz.   │
│  Żubry    [4] – [0]   Lisy       │
│                                  │
│ ┌──────────────────────────────┐ │
│ │  Zapisz kolejkę              │ │
│ └──────────────────────────────┘ │
│  Tabela przeliczy się sama.      │
└──────────────────────────────────┘
```

Zasada z planu (§6) zostaje nietknięta: **zdarzenia rządzą, dopóki nie wejdzie człowiek**.
`wynik_recznie = true` zamraża wynik wobec zdarzeń, a interfejs mówi to wprost.

---

## 8. Tabela, terminarz, drabinka — co pokazać w którym trybie

| Zakładka | Jeden dzień | Kolejki | Umawiają się same |
|---|---|---|---|
| **Mecze** | oś godzin, grupowane po arenie | grupowane po kolejkach, z datą | **dwie sekcje: „do rozegrania" i „rozegrane"** |
| **Tabela** | po fazie grupowej | od pierwszej kolejki, z formą | z kolumną „rozegranych" (drużyny mają różną liczbę meczów!) |
| **Drabinka** | pionowa lista rund, drzewko od `md:` | jak obok | jak obok |

> Kolumna „umawiają się same” opisuje tryb odłożony (§12) — zostaje w tabeli, żeby przy
> jego budowie nie zaczynać od zera.

**Tabela w trybie „umawiane" musi pokazywać liczbę rozegranych meczów** i sortować
z tym w głowie — bo drużyna z 6 meczami i 12 punktami nie stoi wyżej niż drużyna
z 3 meczami i 9 punktami w żadnym sensownym odczytaniu. To jedyne miejsce, w którym
`lib/turniejTabela.ts` wymaga zmiany logiki, nie tylko prezentacji.

---

## 9. Co to znaczy dla schematu — minimalna lista

Wszystko poniżej dotyczy **wyłącznie tabel turniejowych i nowych funkcji**, więc twarda
granica z planu (§3: „moduł nie modyfikuje ani jednej istniejącej tabeli poza
`notifications.turniej_id`") zostaje nienaruszona. `get_player_stats()` też nie jest
ruszane (§6.5).

### W zakresie

| Zmiana | Po co | Etap |
|---|---|---|
| `turniej_zaproszenia` (nowa tabela) | kapitan zaprasza imiennie, wzorem `event_player_invites` (§5.2) | A |
| typ `turniej_zaproszenie_do_druzyny` | zaproszony musi je gdzieś zobaczyć | A |
| typ `turniej_nastepny_mecz` | „wasz mecz jest następny" (`S-19`) | B |
| `get_player_turniej_stats()` (nowa funkcja) | sekcja Turnieje na profilu (§6.5) | C |
| `turnieje.tryb_terminarza` (`jeden_dzien`/`kolejki`) | dwa rodzaje turnieju (§1) | D |

### Nie wymaga niczego w bazie

- Ekran drużyny, licznik składu, stały link (`S-13`, `S-14`, `S-15`) — `lib/turniejDruzyny.ts`
  ma wszystkie operacje napisane i przetestowane.
- Głowa zależna od stanu, domyślna zakładka, „nasze mecze", podium, plakat, pulpit.
- Konsola: arkusz składu, zegar, walkower, **wartość punktu w koszykówce** — kolumna
  `turniej_zdarzenia.wartosc` istnieje i jest poprawnie obsługiwana przez wyzwalacz;
  brakuje jednego argumentu w wywołaniu.
- **Termin graniczny zapisów**: `turnieje.zapisy_do` istnieje od migracji `145` i jest
  ignorowany przez `przyjmujeZgloszenia()`, która patrzy wyłącznie na status i limit.
  To zmiana w jednej czystej funkcji.

### Odłożone razem z trybem „umawiane" (§12)

`turniej_mecze.field_id`/`miejsce_nazwa`/`termin_do`, tabela `turniej_terminy`,
`wynik_zglosil_druzyna_id`/`wynik_potwierdzony_at`, typy `turniej_termin_propozycja`
i `turniej_wynik_do_potwierdzenia`.

---

## 10. Kolejność budowy

Cztery etapy. **Etapy A–C to niemal wyłącznie interfejs nad logiką, która już istnieje
i ma testy** — dwie migracje w całości (zaproszenia, powiadomienie) plus jedna funkcja.

**Etap A — kapitan i pierwsze wrażenie** — ✅ **ZROBIONE 2026-09-20** (migracja `154`)
`/turnieje/[id]/druzyna/[id]` ze stałym linkiem i licznikiem „5 z 8" (§5.1) ·
zaproszenia imienne z ekipy + karta na stronie głównej (§5.2, migracja) · domyślna
zakładka zależna od stanu · głowa „plakat" w zapisach · termin graniczny zapisów ·
sprzedający `/t/[kod]` · przełącznik „Nasze mecze".

**Etap B — dzień turnieju** — ✅ **ZROBIONE 2026-09-20** (migracja `155`)
Konsola: arkusz składu zamiast `<select>`, zegar, walkower, **wartość punktu
w koszykówce**, „następny mecz na tej arenie" · odświeżanie co 20 s · głowa „na żywo" ·
pulpit organizatora w trybie dnia.

**Etap C — początek i koniec łuku** *(funkcja `get_player_turniej_stats`)*
Kreator w dwóch aktach z wyliczeniem czasu · ekran-plakat po publikacji · podium
z udostępnianiem · „Zamień drużynę w ekipę" na podium · „Zrób podobny turniej" ·
**sekcja Turnieje na profilu gracza** (§6.5).

**Etap D — tryb `kolejki`** *(migracja: `tryb_terminarza`)*
Zbiorczy wpis wyników kolejki, terminarz rozłożony na tygodnie, przypomnienie dzień
przed kolejką. Dopiero po pierwszym prawdziwym turnieju jednodniowym.

**Kolejność jest podyktowana tym, kto z czego korzysta.** Etap A dotyczy dwunastu
kapitanów i dziewięćdziesięciu zawodników, etap B — trzech prowadzących w ciągu sześciu
godzin, etap C — jednego organizatora i tych samych dziewięćdziesięciu tydzień później.
A jest przed B, bo bez składów w drużynach nie ma czego prowadzić.

---

## 11. Co zostaje otwarte

1. **Czy kapitan może zapraszać ludzi spoza swoich ekip?** Dziś projekt bierze
   kandydatów wyłącznie z ekip (§5.2), jak przy meczu. Wyszukiwanie po nazwisku w całym
   Bojo to osobna decyzja z własnymi konsekwencjami dla prywatności.
2. **Czy organizator widzi, kogo kapitanowie zaprosili?** Przy meczu widzi
   (`EventInvitesStatus.tsx`). W turnieju to cudza drużyna — skłaniam się do „nie, widzi
   tylko licznik składu".
3. **Ile miejsca dostaje sekcja Turnieje na profilu**, gdy ktoś zagrał w piętnastu?
   Projekt zakłada trzy ostatnie i „pokaż wszystkie".

---

## 12. Odłożone świadomie: tryb „drużyny umawiają się same"

**Decyzja 2026-09-20: nie budujemy tego teraz.** Projekt zostaje w całości, bo ma wartość
w chwili, gdy decyzja się odwróci — a odtworzenie go od zera kosztuje drugi raz tyle samo.
Lista zmian w schemacie, które za tym idą, jest w §9.

Przypomnienie z §1: to jest mechanika skasowanego „BOJO Cup" (migracje `029`/`030`,
usunięte migracją `151`). Tamten moduł zginął, bo był **osobnym produktem dla jednej
edycji zakładanej przez admina** — nie dlatego, że mechanika była zła.

### 12.1. Kapitan umawia mecz i zgłasza wynik

Dochodzi jedna rzecz, której w pozostałych trybach nie ma — **umówienie meczu**:

```
┌──────────────────────────────────┐
│  ⚠ MECZ DO ROZEGRANIA            │
│                                  │
│  Dziki  vs  Wilki                │
│  Kolejka 3 · do 31 marca         │
│  Zostały 4 dni                   │
│                                  │
│  Wilki proponują:                │
│  ┌──────────────────────────────┐│
│  │ czwartek 27.03, 20:00        ││
│  │ 📍 Hala Sportowa Grunwald    ││
│  │  [ Pasuje ]   [ Nie pasuje ] ││
│  └──────────────────────────────┘│
│                                  │
│  albo zaproponuj inny termin →   │
└──────────────────────────────────┘
```

Po meczu — zgłoszenie wyniku z potwierdzeniem rywala:

```
┌──────────────────────────────────┐
│  WPISZ WYNIK                     │
│  Dziki  [ 3 ] – [ 2 ]  Wilki     │
│                                  │
│  Strzelcy Dziki (opcjonalnie)    │
│  + dodaj                         │
│                                  │
│ ┌──────────────────────────────┐ │
│ │       Zgłoś wynik            │ │
│ └──────────────────────────────┘ │
│  Wilki muszą potwierdzić.        │
│  Bez potwierdzenia w 3 dni       │
│  wynik zatwierdza organizator.   │
└──────────────────────────────────┘
```

---

## 13. Co zmienia to, że pierwszy turniej prowadzi ktoś obcy

**Decyzja 2026-09-20: pierwszym prawdziwym turniejem w Bojo nie będzie nasz turniej.**
Będzie nim turniej kogoś, kto organizuje je i tak, a naszej aplikacji użyje do obsługi.

To brzmi jak szczegół operacyjny, a jest zmianą wymagań dla interfejsu. Turniej własny
wolno zrobić po łebkach, bo stoi się obok i naprawia na żywo. **Przy cudzym turnieju
nikogo obok nie ma** — o 11:40, gdy coś nie działa, organizator ma osiemdziesiąt osób
na boisku i telefon w ręku.

Cztery konsekwencje, których nie widać z samych scenariuszy:

1. **Każda operacja musi mieć odwrócenie w interfejsie.** „Cofnij ostatnie" w konsoli
   jest — ale ręczna korekta wyniku po zakończeniu meczu, cofnięcie walkowera i usunięcie
   drużyny po wygenerowaniu terminarza to dziś operacje albo niemożliwe, albo robione
   przez nas w SQL. Przy cudzym turnieju „napisz do nas, poprawimy" nie jest odpowiedzią.
2. **Puste stany muszą mówić, co zrobić.** „Terminarz jeszcze nie jest gotowy" jest
   opisem. „Wygeneruj terminarz — masz 8 drużyn, zajmie to chwilę" jest instrukcją.
   Organizator uczy się modułu w piątek wieczorem, sam, bez nas.
3. **Zero danych testowych na produkcji.** To był jeden z wprost wymienionych powodów
   wyłączenia flagi 2026-09-17 (`lib/features.ts`). Obcy organizator zobaczy listę
   `/turnieje` z naszymi `[TUR]`-ami obok swojego turnieju — i to jest pierwsza rzecz,
   po której oceni, czy to jest poważne narzędzie. Sprzątanie: `supabase/wyczysc-testowe.sql`.
4. **Potrzebna jest jedna strona „jak poprowadzić turniej w Bojo"** — nie dokumentacja,
   tylko pięć kroków z ekranami, do wysłania organizatorowi razem z zaproszeniem.
   Najbliższy istniejący wzorzec to [outreach-organizatorzy.md](./outreach-organizatorzy.md)
   (tam dla meczu) i [testy-przedpremierowe.md](./testy-przedpremierowe.md) (tam dla nas).

Piąta konsekwencja jest najważniejsza i nie jest kodem: **ten turniej trzeba obejrzeć.**
Cały dokument, który właśnie czytasz, jest rekonstrukcją z kodu. Jeden prawdziwy turniej
powie o tych ekranach więcej niż kolejna runda projektowania — pod warunkiem, że ktoś od
nas będzie tam tego dnia patrzył, nawet nie pomagając.
