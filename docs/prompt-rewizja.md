# Prompt: „Rewizja przed startem"

Gotowy brief do wklejenia modelowi z najwyższej półki (Fable/Opus). Jedno zadanie
w czterech krokach, jeden dokument na wyjściu.

**Zanim uruchomisz:** zapisz sobie na boku własne trzy typy — gdzie ludzie odpadną,
co zabije projekt, co skasować z backlogu. Porównanie po fakcie jest jedynym sensownym
sposobem oceny, czy droższy model był wart pieniędzy.

**Nie chce Ci się zbierać plików?** Uruchom `node scripts/build-rewizja.mjs` —
skleja prompt z czterema dokumentami w jeden `rewizja-do-wklejenia.txt` (~54 tys.
znaków). Wklejasz całość jedną wiadomością i tyle.

**Co dokładnie tam wchodzi** (w tej kolejności, każde oznaczone nagłówkiem):

1. `docs/llm-context.md` — pisany dokładnie pod model czytający na zimno
2. `docs/wizja.md`
3. `docs/funkcje.md`
4. `BACKLOG.md`

Po każdej większej zmianie w tych dokumentach uruchom skrypt ponownie.

Wynik zapisz jako `docs/rewizja-RRRR-MM.md` i dopisz link w `docs/README.md`.

---

## Prompt

```
Jesteś doradcą produktowym, którego zatrudniono, żeby powiedział rzeczy niewygodne.
Płacę Ci za sąd, nie za podsumowanie tego, co już wiem.

KONTEKST
Bojo (bojo.pl) to działająca aplikacja webowa do organizowania amatorskich meczów.
Dwóch założycieli, jedno miasto (Poznań), zero użytkowników spoza kręgu znajomych.
Przed publicznym udostępnieniem. Poniżej wklejam cztery dokumenty: kontekst produktu,
wizję (dokument nadrzędny w projekcie), stan zbudowanych funkcji i backlog.

ZADANIE
Wykonaj cztery kroki PO KOLEI. Każdy kolejny krok MUSI wprost odwoływać się do ustaleń
poprzedniego — cytuj własne wnioski, nie zaczynaj od nowa. Jeśli krok 3 nie korzysta
z kroku 2, zrobiłeś to źle.

── KROK 1: OŚMIU LUDZI ──────────────────────────────────────────────────────
Wymyśl osiem konkretnych osób grających amatorsko w Poznaniu. Nie archetypy —
konkretni ludzie: imię, wiek, zawód, jak dziś organizują granie, co ich wkurza,
co by ich powstrzymało przed założeniem kolejnego konta.

Wśród nich musi być: organizator stałej ekipy, która działa dobrze i nie potrzebuje
Bojo; ktoś nowy w mieście bez znajomych; osoba grająca raz na miesiąc; oraz zarządca
obiektu.

Każdą przeprowadź przez pierwsze pięć minut kontaktu z Bojo — od zobaczenia linku
do momentu, w którym odpada albo zostaje. Podaj DOKŁADNY moment odpadnięcia
i powód. Odwołuj się do faktycznych funkcji z dokumentów, nie do wyobrażonych.

Na koniec: które odpadnięcia powtarzają się u więcej niż jednej osoby.

── KROK 2: NAJMOCNIEJSZY ZARZUT ─────────────────────────────────────────────
docs/wizja.md jest w tym projekcie dokumentem nadrzędnym — z założenia się go nie
kwestionuje. Zrób dokładnie to.

Zbuduj najmocniejszą możliwą argumentację, że centralne założenie wizji jest błędne.
Nie lista zastrzeżeń — jedna spójna teza, poparta powtarzającymi się odpadnięciami
z kroku 1.

Zasady: masz przekonywać, nie asekurować. Zero „z drugiej strony". Jeśli po napisaniu
uważasz, że teza jest słaba, powiedz to wprost na końcu i uzasadnij — to też jest wynik.

── KROK 3: PRE-MORTEM ───────────────────────────────────────────────────────
Jest sierpień 2027. Bojo nie wypaliło — założyciele odpuścili, domena wygasa.

Napisz historię, jak do tego doszło. Wymagania:
• narracja przyczynowa z datami kwartalnymi, nie lista ryzyk
• zacznij od odpadnięć z kroku 1 i tezy z kroku 2 jako pierwszych kostek domina
• uwzględnij realia z dokumentów: jedno środowisko produkcyjne, migracje uruchamiane
  ręcznie, katalog boisk o niepewnej jakości danych, dwóch ludzi po godzinach
• wskaż JEDEN moment, w którym inna decyzja odwróciłaby bieg — i jaka to decyzja

Zakazane: „brak product-market fit", „za mało marketingu", „skończyły się pieniądze"
jako przyczyny same w sobie. To są objawy. Chcę mechanizmu.

── KROK 4: CO BUDOWAĆ, CZEGO NIE ────────────────────────────────────────────
Na podstawie kroków 1–3:

(a) PIĘĆ rzeczy do zbudowania w następnej kolejności. Dla każdej: którą przyczynę
    z kroku 3 rozbraja i które odpadnięcie z kroku 1 usuwa. Jeśli nie rozbraja
    żadnej — nie należy do tej piątki.

(b) Przejdź BACKLOG.md pozycja po pozycji i wskaż wszystko do SKASOWANIA. Nie
    „odłożenia" — skasowania. Cytuj nazwy pozycji dosłownie. Przy każdej jedno zdanie:
    dlaczego nie służy celowi z wizji.

(c) Osobno: które ze zbudowanych, ale ukrytych za flagą funkcji usunąć z kodu całkiem.

Celuj w proporcje 5 do budowy i 25–35 do kasacji. Jeśli uważasz, że tyle skasować się
nie da, uzasadnij — ale domyślnie zakładam, że backlog dwuosobowego zespołu przed
startem jest w większości fikcją.

── FORMAT ───────────────────────────────────────────────────────────────────
Markdown, cztery sekcje odpowiadające krokom, po polsku.

• Konkret zamiast ogólników. Każde twierdzenie ma się odwoływać do nazwanej funkcji,
  pliku, tabeli albo pozycji backlogu z wklejonych dokumentów.
• Zero komplementów i zero rozgrzewki. Zaczynasz od pierwszej osoby z kroku 1.
• Zero rad, które pasowałyby do dowolnego startupu. Jeśli zdanie brzmi sensownie
  po podmianie „Bojo" na dowolną inną nazwę — usuń je.
• Gdy czegoś nie da się ustalić z dokumentów, napisz wprost „nie wynika z materiału"
  zamiast zgadywać.
• Na samym końcu dopisz sekcję „Czego nie wiem" — trzy pytania, na które odpowiedź
  zmieniłaby Twoje wnioski, i skąd wziąć na nie odpowiedź.
```

---

## Zadanie osobne: język produktu

Uruchom **dopiero po** powyższym — nie ma sensu dopracowywać tonu w funkcjach, które
za tydzień znikną.

Materiał: same stringi widoczne dla użytkownika z `frontend/src`, bez wizji i backlogu.

```
Poniżej wszystkie komunikaty widoczne dla użytkownika w polskojęzycznej aplikacji
do organizowania amatorskich meczów: puste stany, błędy, potwierdzenia, etykiety
przycisków. Powstawały przez rok, w wielu podejściach, przez różne osoby.

Zadanie:
1. Nazwij, ile różnych „głosów" tu słyszysz i czym się różnią. Cytuj przykłady.
2. Wybierz jeden i uzasadnij, dlaczego pasuje do sportu amatorskiego w Polsce
   — a nie do aplikacji bankowej ani do produktu dla nastolatków.
3. Przepisz wszystko w tym jednym głosie. Format: tabela stare → nowe.
4. Osobno wskaż komunikaty, które kłamią albo mylą — obiecują coś, czego aplikacja
   nie robi, albo nazywają rzecz inaczej niż reszta interfejsu.

Zasady: bez wykrzykników, bez emoji w komunikatach błędów, bez zdrobnień.
Komunikat błędu ma mówić, co zrobić dalej, a nie że coś poszło nie tak.
```
