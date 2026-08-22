# Sesja przedpremierowa — jedna historia, dwa telefony, ~45 minut

Skrypt do przejścia PRZED wpuszczeniem ludzi. Nie jest to lista wszystkiego, co
aplikacja umie — od tego są [testy automatyczne](#co-sprawdza-automat-i-czego-tu-nie-ma).
To jest lista rzeczy, których **maszyna sprawdzić nie może**: prawdziwy telefon,
prawdziwe powiadomienie na zablokowanym ekranie, prawdziwa druga osoba i ocena
„czy to jest zrozumiałe".

**Dlaczego jedna ciągła historia, a nie 40 rozłącznych checków.** Błędy, które
bolą po starcie, siedzą na stykach: zapis działa, powiadomienie działa, ale
powiadomienie o zapisie przychodzi z cudzym imieniem. Takiego błędu nie widać,
gdy każdy krok sprawdza się osobno, na czystym stanie. Kolejność kroków niżej
jest kolejnością, w jakiej przejdzie je realna ekipa.

---

## 0. Przygotowanie (5 minut, dzień wcześniej)

1. **Migracje `120` i `121`** — Supabase → SQL Editor, w tej kolejności:
   `120` → poczekaj na deploy Vercela → `121`. Uzasadnienie w nagłówkach plików.
2. **Funkcje brzegowe** — Actions → „Wdróż funkcje brzegowe" → Run workflow.
   Bez tego kliknięcie powiadomienia push nie oznaczy go jako przeczytanego.
3. **Seed** — wklej `supabase/seed_przedpremiera.sql` do SQL Editora. Dostaniesz
   siedem stanów startowych i listę adresów na końcu. Zapisz ją — będzie
   potrzebna niżej.
4. **Drugi telefon i druga osoba.** Najlepiej ktoś, kto Bojo nie widział na oczy;
   drugie konto na Twoim drugim telefonie jest gorsze, ale wystarczy. Ważne, żeby
   to był **inny system niż Twój** (Ty iOS → oni Android, albo odwrotnie).
5. **Zainstaluj aplikację na obu telefonach** (dodaj do ekranu początkowego).
   Push na iOS działa **wyłącznie** po instalacji — w karcie przeglądarki nie
   przyjdzie i to nie jest błąd.

---

## 1. Historia (~45 minut)

Każdy krok ma **co zrobić** i **co ma się stać**. Jeśli coś się nie zgadza —
zapisz numer kroku i idź dalej; sesja ma pokazać wszystko, nie zatrzymać się na
pierwszej rysie.

### Krok 1 — obcy człowiek dostaje link (P1)

**Ty:** wyślij drugiej osobie link do meczu `P1` zwykłym WhatsAppem.
**Ona:** otwiera na telefonie, **nie mając konta**, i próbuje dołączyć.

Ma się stać: widzi mecz i skład bez logowania, a przy próbie zapisu dostaje
drogę do założenia konta i **wraca tam, skąd wyszła** — bez szukania meczu od
nowa.

> Policz kliknięcia od otwarcia linku do wejścia w skład i zapisz liczbę. To
> jest jedyna metryka z tej sesji, która realnie decyduje, czy ekipa się
> przeniesie.

### Krok 2 — pierwsze powiadomienie (P1)

**Ty:** patrz na swój telefon, gdy druga osoba dołącza.

Ma się stać: dzwonek pokazuje, że ktoś dołączył — z jej imieniem i nazwą meczu.
Jeśli aplikacja jest zamknięta, przychodzi push na zablokowany ekran.
Kliknięcie push otwiera **mecz**, nie stronę główną.

### Krok 3 — rozmowa (P1)

**Ty:** napisz coś w zakładce „Rozmowa".
**Ona:** ma dostać chmurkę na dolnej nawigacji i różową plakietkę przy zakładce.
Odpisuje.

Ma się stać przy okazji — i to jest ta rzecz zmieniona ostatnio, więc patrz
uważnie: po otwarciu klawiatury **pole do pisania siedzi tuż nad nią**, bez
pustego pasa pod spodem, a przy schowanej klawiaturze nie wchodzi pod pasek
gestów. Najnowsza wiadomość zostaje widoczna po otwarciu klawiatury.

### Krok 4 — komplet i kolejka (P2)

**Ona:** zapisuje się na mecz `P2`, który ma komplet.

Ma się stać: komunikat mówi **wprost o rezerwie** — nie „Dołączyłeś do meczu!".

**Ty:** usuń ze składu gościa „Marek".

Ma się stać: rezerwowa dostaje **ofertę** zwolnionego miejsca (powiadomienie
+ widoczny stan na meczu), a nie ciche wejście do składu. Auto-awansu nie ma
i to jest decyzja produktowa, nie brak.

### Krok 5 — prośba o akceptację (P3)

**Ona:** klika „Dołącz" na `P3`.

Ma się stać: widzi, że **czeka na decyzję**, i dowiaduje się, jak się o niej
dowie.

**Ty:** akceptuj — z dzwonka albo z `/moje-gry`.

Ma się stać: po jej stronie stan zmienia się bez szukania; przychodzi
powiadomienie.

### Krok 6 — pieniądze (P4)

Mecz `P4` zaczyna się za mniej niż godzinę i kosztuje 25 zł, ze zniżką dla
karty sportowej.

**Ona (przed zapisaniem):** otwiera okno dołączania, wybiera BLIK.

Ma się stać: **nie widzi numeru**, tylko zdanie, że zobaczy go po zapisaniu.
Numer telefonu organizatora nie należy do obcych — to jest zmiana z ostatniego
tygodnia i warto ją zobaczyć na własne oczy.

**Ona (po zapisaniu):** numer BLIK jest widoczny na karcie „Twoja płatność".

Sprawdź też cenę z zaznaczoną kartą sportową i bez — mają się różnić o 10 zł.

### Krok 7 — po meczu (P5)

**Ty:** na meczu `P5` (wczorajszym) wpisz wynik z golami, oznacz „Wszyscy
oddali", wyślij rozliczenie ekipie.

Ma się stać: wiadomość do wysłania da się **przeczytać bez tłumaczenia** — kwota
od osoby, kto zalega, numer do przelewu.

### Krok 8 — gość bez konta (P6)

**Ty:** przy gościu na `P6` wyślij zaproszenie do przejęcia wpisu.
**Ona:** otwiera link i przejmuje wpis.

Ma się stać: wchodzi do składu **jako ona**, a wpis gościa znika — nie powstaje
drugi wiersz obok.

### Krok 9 — ekipa (P7)

**Ty:** zaproś ją do ekipy kodem. Napisz coś na tablicy ekipy.

Ma się stać: widzi mecz `P7`, **mimo że jest prywatny** — bo należy do ekipy.
Dostaje powiadomienie o wpisie na tablicy.

### Krok 10 — wyjście awaryjne

**Ona:** wypisuje się z jednego meczu, wyłącza powiadomienia w profilu,
wylogowuje się.

Ma się stać: wszystkie trzy rzeczy są **do znalezienia bez pytania Ciebie**.

---

## 2. Dziesięć minut na „czy nie wygląda głupio"

To ocena, nie sprawdzenie — dlatego robi to człowiek.

- [ ] **Świeże konto, zero meczów, zero ekip** — czy pulpit mówi, co zrobić dalej?
- [ ] **Strona główna wylogowana**, gdy nie ma żadnych otwartych meczów w okolicy
      (dziś sekcja po prostu znika i landing robi się rzadki — [znany problem](../BACKLOG.md))
- [ ] **Tryb ciemny** na obu telefonach
- [ ] **Najmniejszy ekran, jaki masz pod ręką** — czy któryś przycisk ucieka poza kadr?
- [ ] **Obrót telefonu** na stronie meczu i w rozmowie
- [ ] **Katalog boisk** — wpisz swoją dzielnicę i zobacz, czy dane nie są śmieszne

---

## 3. Po sesji

1. **Posprzątaj bazę** — `supabase/wyczysc-testowe.sql`. Najpierw podgląd (liczy),
   potem odkomentowana sekcja kasująca. Sekcja trzecia wypisze mecze **bez
   markera**, czyli te zrobione ręką w trakcie klikania — te przejrzyj okiem.
2. **Sprawdź `/admin/bledy`.** Wszystko, co się wywróciło podczas sesji, jest tam
   — z adresem strony, przeglądarką i wersją aplikacji. Jeśli lista jest pusta,
   a coś Ci mignęło, to też jest informacja (o zbieraniu błędów, nie o aplikacji).
3. **Miękki start.** Wpuść **jedną** ekipę, tę najbardziej wyrozumiałą, i daj jej
   dzień. Jeśli coś jest zepsute, dowiesz się na ośmiu osobach zamiast na
   pięćdziesięciu — a kosztuje to zero pracy, tylko trochę cierpliwości.

---

## Co sprawdza automat i czego tu nie ma

Nie powtarzaj ręcznie tego, co i tak leci przy każdym PR-ze:

| Gdzie | Co pilnuje |
|---|---|
| `npm test` (722 testy) | logika domenowa: ceny, pojemność, kolejka, daty, treści |
| `supabase/test/rls.sql` | **kto co widzi w bazie** — rozmowa, numer BLIK, tablica ekipy, z perspektywy anonima, obcego, uczestnika i organizatora |
| `e2e/klikalnosc.spec.ts` | czy da się kliknąć — modale, warstwy, martwe przyciski |
| `e2e/scenariusze.spec.ts` | przejścia gracza na realnej bazie: dołączanie, rezerwa, bramkarze, prośby, płatności, rozmowa, numer BLIK |
| `e2e/wizualne.spec.ts` | zmiany wyglądu na wszystkich trasach (raport w PR-ze, nie bramka) |
| `scripts/baza-testowa.sh` | czy migracje aplikują się od zera + testy reguł dostępu |

Zostaje to, czego automat nie dosięga: prawdziwe powiadomienie na zablokowanym
ekranie, instalacja PWA, logowanie Google, klawiatura systemowa, druga żywa
osoba i ocena, czy komunikat jest zrozumiały dla kogoś, kto nie budował tej
aplikacji.

`supabase/seed_regresja.sql` (43 scenariusze `R01`–`R43`) zostaje jako materiał
dla testów automatycznych i do ręcznego dobicia konkretnego przypadku, gdy coś
się zepsuje — **nie** jako lista do odklikania przed startem.
