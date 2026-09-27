# Logo — warianty i decyzja (2026-09-13)

Logo Bojo jest robocze od startu projektu — `frontend/src/components/Logo.tsx`
niesie od początku komentarz `TODO: podmienić na finalną wersję od grafika`. Ten
dokument zapisuje, co rozważaliśmy zamiast gołej litery „B", co wybraliśmy jako
kolejny roboczy wariant i dlaczego — żeby przy kolejnej rundzie (albo przy
finalnej wersji od grafika) nie trzeba było tego wymyślać od nowa.

**TODO w `Logo.tsx` zostaje.** Wybór niżej to wciąż szkic rysowany krzywymi
z ręki, nie praca grafika — tylko lepszy punkt wyjścia niż systemowa litera.

## Ograniczenie, które rozstrzyga

Znak ocenia się przy **32px**, nie przy rozmiarze podglądu. Kafelek ma 110
jednostek geometrii SVG, więc przy 32px jedna jednostka to ok. 0,29px — detal
cieńszy niż ~4 jednostki nie istnieje wizualnie, zamienia się w szarą plamę.
32px to rozmiar, w którym użytkownik widzi znak najczęściej: favicon, ikona w
powiadomieniu systemowym.

## Wybrany wariant: „Boisko"

Litera „B" narysowana geometrycznie (obie komory jako koła, nie krój systemowy)
na tle linii środkowej boiska z kołem środkowym, w jaśniejszej zieleni
(`#1E7A4B`) niż tło kafelka (`#15663E`).

```svg
<svg viewBox="0 0 110 110" xmlns="http://www.w3.org/2000/svg">
  <rect width="110" height="110" rx="26" fill="#15663E"/>
  <g stroke="#1E7A4B" stroke-width="3" fill="none">
    <line x1="0" y1="55" x2="110" y2="55"/>
    <circle cx="57" cy="55" r="31"/>
  </g>
  <path d="M40 33 L40 77 L62 77 Q74 77 74 65.5 Q74 56 64 54.5 Q72 52.5 72 43.5 Q72 33 60 33 Z" fill="#ffffff"/>
  <circle cx="57" cy="46.5" r="4.5" fill="#15663E"/>
  <circle cx="58" cy="63.5" r="4.5" fill="#15663E"/>
</svg>
```

Koło środkowe ma promień 31 — większy niż przekątna litery od środka do rogu
(ok. 27,8 jednostki), więc litera mieści się w środku koła z zapasem zamiast
przecinać jego obwód. Wersja pierwsza (promień 24) tego nie spełniała; poprawiona
po uwadze przy przeglądzie.

**Dwa poziomy czytania, każdy w swoim rozmiarze:**
- Przy 512px (ikona instalacji, App Store-style podgląd) widać boisko — linię
  i koło środkowe.
- Przy 32px (favicon, powiadomienie) linia i koło gasną (0,87px), zostaje sama
  geometryczna litera. To wciąż zmiana względem poprzedniego znaku — litera
  przestaje być wzięta z systemowego kroju i staje się rysowana formą.

Zaimplementowane w:
- `frontend/src/components/Logo.tsx` — `LOGO_SVG_STRING` (favicon/inline) i
  komponent `LogoIcon`.
- `frontend/scripts/generuj-ikony.mjs` — `LITERA`, `DZIURA_GORA`, `DZIURA_DOL`,
  `LINIA_BOISKA`; `svgZwykle()` rysuje pełny motyw na zaokrąglonym kafelku,
  `svgMaskowalne()` ten sam motyw na pełnym tle: linia od krawędzi do
  krawędzi, koło i litera w skali 0.8 (strefa bezpieczna maski Androida).
- `frontend/src/app/layout.tsx` — favicon w karcie przeglądarki jako `data:` URI.
- Ikony PWA w `frontend/public/ikony/` — wygenerowane ponownie przez
  `node scripts/generuj-ikony.mjs` po zmianie.

**Dopisane po wdrożeniu (2026-09-26): dwa miejsca, w których logo zostało stare.**

1. Favicon w `layout.tsx` to trzecia, osobna kopia SVG — pierwsza zmiana jej
   nie ruszyła. Naprawione w PR #423.
2. Pierwsza wersja `svgMaskowalne()` rysowała samą literę, „żeby linia nie
   kolidowała z przycięciem". To był błąd rozumowania: na ekranie głównym
   Androida widać WYŁĄCZNIE wariant maskowalny, więc zainstalowana apka
   pokazywała gołe B, gdy favicon miał już boisko. Linia wychodząca poza
   maskę wygląda jak linia boiska wychodząca z kadru, czyli dokładnie tak,
   jak powinna.

Do tego zainstalowana apka nie pobiera nowego obrazka spod starego adresu.
Adresy ikon w manifeście niosą `?v=WERSJA_IKON` (`app/manifest.ts`) —
**zmieniasz obrazek, podbijasz wersję.** Telefon z apką dodaną jako zwykły
skrót (bez WebAPK) i tak nie odświeży ikony; wtedy pomaga tylko usunięcie
i ponowne dodanie do ekranu głównego.

`ikonyPwa.test.ts` pilnuje, żeby ścieżka litery w generatorze i w faviconie
nie rozjechała się z `Logo.tsx`, że wariant maskowalny ma linię i koło boiska
oraz że adresy ikon w manifeście niosą wersję.

## Warianty rozważane i odrzucone

### Obecne (punkt odniesienia)

Zwykła litera „B" na kafelku, bez żadnego motywu w tle. Bezpieczne w każdym
rozmiarze, ale nie mówi nic poza pierwszą literą nazwy.

```svg
<svg viewBox="0 0 110 110" xmlns="http://www.w3.org/2000/svg">
  <rect width="110" height="110" rx="26" fill="#15663E"/>
  <path d="M40 33 L40 77 L62 77 Q74 77 74 65.5 Q74 56 64 54.5 Q72 52.5 72 43.5 Q72 33 60 33 Z M51 42 L59 42 Q63 42 63 46.5 Q63 51 59 51 L51 51 Z M51 59 L60 59 Q65 59 65 64 Q65 68 60 68 L51 68 Z" fill="#ffffff" fill-rule="evenodd"/>
</svg>
```

### Linia

Ta sama linia + koło co „Boisko", ale za literą systemową (nie geometryczną).
Odrzucona: przy 32px linia i koło znikają, więc znak degraduje się dokładnie
do wariantu „Obecne" — w rozmiarze, w którym użytkownik patrzy na znak
najczęściej, nic się nie zmienia.

### Geometryczne

Sama geometryczna litera (obie komory jako koła), bez linii i koła w tle.
To jest „Boisko" minus motyw boiska — poprawne jako fallback (i faktycznie
działa jako niego: to jest dokładnie to, co zostaje z „Boiska" przy 32px), ale
samo w sobie nie wykorzystuje przestrzeni dużego rozmiaru (512px).

### Kropki

Litera złożona z dziesięciu kropek — tylu, ilu graczy trzeba zwołać na piątkę.
Najlepsze uzasadnienie produktowe z czterech wariantów: nie „B jak Bojo", tylko
„skład się zebrał". Odrzucona z powodu czysto technicznego: przy 32px przerwa
między kropkami spada do ok. 0,58px i litera zlewa się w plamę — znak przestaje
być czytelny dokładnie tam, gdzie musi działać najlepiej. Dałoby się to ratować
osobną, uproszczoną wersją na małe rozmiary, ale dwie wersje jednego znaku to
w praktyce dwa znaki do utrzymania.

Odrzucony też bez osobnej sekcji: piąty wariant z linią środkową *wyciętą* w
literze (zielona szczelina na białym B) — pasek 5 jednostek to przy 32px
1,45px, czytelne jako błąd renderowania, nie jako decyzja projektowa.
