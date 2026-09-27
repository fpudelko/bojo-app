# Diagnoza indeksowania: drzewa decyzji i zapytania

## Spis

1. Jak adres trafia do indeksu w Bojo
2. Drzewa decyzji dla przyczyn
3. Zapytania SQL (produkcja, tylko SELECT)
4. Statystyki indeksowania (Ustawienia → Statystyki indeksowania)
5. Oczekiwane skutki napraw i kiedy je mierzyć

## 1. Jak adres trafia do indeksu w Bojo

Najpierw **odkrycie**: sitemapy (treść, huby, sport+miasto, obiekty Tier 1+2), linki
wewnętrzne (huby → obiekty, strona obiektu → „pobliskie” obiekty, landing → wybrane
obiekty, strona meczu → obiekt po UUID) oraz linki zewnętrzne (prawie brak).

Potem **pobranie**: strona obiektu renderuje się na żądanie i zostaje w cache ISR na
tydzień (`revalidate = 604800` w `boisko/[id]/page.tsx`). Pierwsze pobranie przez robota
to render funkcji na Vercelu (plan darmowy, limit CPU). Wolne albo nieudane pobrania
Google odczytuje jako słaby serwer i zwalnia skanowanie całej witryny.

Na końcu **decyzja**: `noindex` (Tier 3, mecze miniony/prywatny), canonical (UUID →
slug) i ocena jakości (R1).

## 2. Drzewa decyzji dla przyczyn

**Strona zawiera przekierowanie**
- Przykłady to `/gracze` → zamierzone.
- Przykłady to obiekty z samą nazwą (`gsc-eksport.mjs --adresy`: wariant „historyczny”):
  - do ~2026-10-15: echo sitemapy sprzed PR #435, Google dochodzi do starych adresów;
  - później: skąd Google je bierze? Inspekcja → „odsyłające adresy” i „sitemapy”.
    Link wewnętrzny z samą nazwą to błąd (strażnik `linkiObiektuKanoniczne.test.ts`
    powinien go złapać; jeśli nie złapał, rozszerz wzorce testu).
- Coś innego → `curl -sIL` z własnej maszyny, sprawdź łańcuch.

**Alternatywna strona z prawidłowym tagiem kanonicznym**
- Przykłady `/boisko/<uuid>` → zamierzone (strona meczu linkuje po UUID).
- Przykłady z parametrami (`?zrodlo=…`, `?utm_…`) → zamierzone, jeśli canonical bez parametrów.
- Adres kanoniczny obiektu na tej liście → canonical wskazuje gdzie indziej: błąd w `generateMetadata()`.

**Duplikat, użytkownik nie oznaczył strony kanonicznej**
- Przykłady to obiekty → dwa wiersze `fields` z tą samą nazwą i adresem (zapytanie 3b).
  Naprawa w danych (scalenie albo ukrycie duplikatu), nie w kodzie strony.
- Przykłady to listy aplikacji (`/wydarzenia`, `/grupy`, `/mapa`) → brak
  `alternates.canonical` w ich `page.tsx`.

**Duplikat, Google wybrał inną stronę kanoniczną**
- Różnica tylko w hoście (`www`/bez) → `NEXT_PUBLIC_SITE_URL` na produkcji vs usługa GSC.
- Dwa różne obiekty o nazwie rodzajowej w tej samej miejscowości → Google widzi niemal
  identyczną treść. Dźwignia: fakty różnicujące w opisie (`content/opisObiektu.ts`:
  ulica, nawierzchnia, oświetlenie, potwierdzenia graczy), nie canonical.

**Strona wykluczona za pomocą tagu „noindex”**
- Obiekty → sprawdź `seo_tier` (zapytanie 3c). Tier 3 = zamierzone; Tier 1/2 z noindex = błąd.
- Mecze → miniony albo prywatny = zamierzone.
- Huby, treść, strona główna → **błąd pilny**.

**Zeskanowana, ale jeszcze nie zindeksowana / Wykryta, obecnie niezindeksowana**
- Udział R1 i trend (SKILL.md). Przykłady obiektów: który tier, jaki opis? Tier 2
  z nazwą rodzajową i bez nawierzchni to typowy „cienki” profil.
- „Wykryta…” rośnie → najpierw Statystyki indeksowania (sekcja 4): czas odpowiedzi,
  5xx, limit. Dopiero potem jakość.

**Nie znaleziono (404)**
- Obiekt usunięty albo ukryty (`map_visibility`) → zamierzone, jeśli nie ma go w sitemapie.
- Hub miasta poniżej progu → zamierzone (i poza sitemapą, `paryHubowMiastSportu()`).
- Adres z naszej sitemapy albo linku → błąd.

**Soft 404 / Zindeksowana bez treści**
- Robot dostał pusty HTML. `node scripts/audyt-robota.mjs --baza https://www.bojo.pl --boisko <slug>`
  z własnej maszyny (kontrakt HTML dla robota: h1, opis, linki).

**Błąd serwera (5xx)**
- Logi Vercela dla ścieżki i dnia z wykresu; status Supabase. Powtarzalne 5xx na
  `/boisko/*` przy pierwszym renderze = limit funkcji albo zapytanie za ciężkie.

**Zablokowana przez robots.txt / Zindeksowana, chociaż zablokowana**
- Adres z listy `DISALLOW` → zamierzone. Druga wersja („zindeksowana, chociaż…”) →
  kolejność noindex-przed-blokadą (SKILL.md, „Czego nie robić”).

## 3. Zapytania SQL (produkcja, tylko SELECT)

a) Ile obiektów MA być w sitemapach, po województwach:

```sql
select voivodeship, count(*) from fields
where map_visibility = 'public' and seo_tier in (1, 2)
group by 1 order by 2 desc;
```

b) Duplikaty (kandydaci na „Duplikat bez canonical”):

```sql
select name, address, count(*), array_agg(id) from fields
where map_visibility = 'public' group by 1, 2 having count(*) > 1 order by 3 desc limit 20;
```

c) Obiekt z adresu kanonicznego (końcówka = pierwsze 12 znaków hex `id` bez myślników):

```sql
select id, name, seo_tier, map_visibility from fields
where replace(id::text, '-', '') like '<12 znaków końcówki>%';
```

d) Kolizje adresów historycznych (ile obiektów dzieli adres z samej nazwy).
Przybliżenie `slugify()` w SQL; wynik z 2026-09-26: 32 096 wpisów → 10 608 adresów.

```sql
with s as (
  select trim(both '-' from regexp_replace(translate(lower(name), 'ąćęłńóśźż', 'acelnoszz'), '[^a-z0-9]+', '-', 'g')) slug
  from fields where map_visibility = 'public' and seo_tier in (1, 2) and name is not null)
select count(*) wpisy, count(distinct slug) adresy from s;
```

e) Mecze publiczne przyszłe (tyle stron meczów może być w indeksie):

```sql
select count(*) from events where visibility = 'public' and event_date >= current_date and coalesce(status, '') <> 'cancelled';
```

## 4. Statystyki indeksowania

GSC → Ustawienia → Statystyki indeksowania. Czytaj:

- **Stan hosta** (robots.txt, DNS, połączenie z serwerem): cokolwiek innego niż
  zielone oznacza, że Google ogranicza skanowanie.
- **Średni czas odpowiedzi**: rośnie → pierwsze rendery ISR na Vercelu, zimne starty,
  ciężkie zapytania. Przy katalogu 32 tys. stron to bezpośrednio liczba pobrań dziennie.
- **Według odpowiedzi**: udział 5xx, 404, przekierowań (po PR #435 udział 307 powinien spadać).
- **Według celu**: „wykrywanie” (nowe adresy) vs „odświeżanie”. Po poprawce sitemapy
  wykrywanie powinno chwilowo urosnąć.

## 5. Oczekiwane skutki napraw i kiedy je mierzyć

| Naprawa | Czego się spodziewać | Kiedy sprawdzić |
|---|---|---|
| PR #435 (sitemapa i huby na adresach kanonicznych, 2026-09-26) | Mapy witryn: wpisy bez zmian liczbowo; Strony: „przekierowanie” najpierw może urosnąć, potem spada; zaindeksowane rosną wraz z odkrywaniem ~21 tys. obiektów; Statystyki: więcej „wykrywania” | 2026-10-10 i 2026-10-24 |
| (wzór na przyszłość) każda zmiana `noindex`/canonical | zmiana w raporcie dopiero po ponownym skanowaniu stron; przy tygodniowym ISR i małym limicie skanowania to tygodnie | +14 i +28 dni |
