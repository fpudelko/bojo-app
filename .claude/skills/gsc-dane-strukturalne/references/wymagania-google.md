# Wymagania Google dla typów używanych w Bojo

Stan: research 2026-09-25/26 (Google Search Central, dokumentacja danych strukturalnych;
szczegóły i źródła w `../../gsc/references/nowosci-google.md`). Egzekwuje to
`../scripts/reguly-google.mjs`; zmiana tutaj bez zmiany tam to rozjazd.

„Wymagane” = brak → problem **krytyczny** w GSC, element nie kwalifikuje się do wyniku.
„Zalecane” = brak → problem **niekrytyczny**, element prawidłowy.

## Event (u nas `SportsEvent`)

- **Kwalifikacja:** wydarzenie w fizycznym miejscu, na które może przyjść publiczność.
  Wydarzenia wyłącznie online Google usunął z dokumentacji (czerwiec 2025). Nie
  oznaczaj jako wydarzenie promocji ani „wydarzeń” bez konkretnego terminu.
- **Wymagane:** `name`, `startDate`, `location` (`Place`) z `location.address`.
- **Zalecane:** `description`, `endDate`, `eventStatus`, `image`, `offers`
  (`availability`, `price`, `priceCurrency`, `url`, `validFrom`), `organizer`
  (`name`, `url`), `performer` (`name`), `location.name`; `previousStartDate` tylko
  przy zmianie terminu.
- **Formaty:** daty ISO 8601; bez strefy Google przyjmuje strefę miejsca (Polska:
  `+01:00` zimą, `+02:00` latem). `eventStatus`: `EventScheduled`, `EventCancelled`,
  `EventPostponed`, `EventRescheduled`, `EventMovedOnline`. `availability`: m.in.
  `InStock`, `SoldOut`, `PreOrder`, `LimitedAvailability`. Google przyjmuje pełny URL
  schema.org i krótką nazwę. `price` jako liczba albo tekst z kropką („20.00”), bez
  waluty; `priceCurrency` kodem ISO 4217 (`PLN`).
- **Obraz:** pełny URL, indeksowalny. Google zaleca kilka proporcji (16×9, 4×3, 1×1)
  i wysoką rozdzielczość. Bojo daje jedną kartę 1200×630 (`opengraph-image.tsx`).
- **Odwołany mecz:** zostaw na stronie, `eventStatus: EventCancelled` (Bojo tak robi).
  Nie usuwaj strony od razu, bo Google musi zobaczyć odwołanie.

Jak Bojo wypełnia pola (od PR #424): `description` = opis organizatora (≤ 300 znaków)
albo zdanie z faktów meczu; `image` = `/wydarzenia/<id>/opengraph-image`;
`performer` = `PerformingGroup` „Skład meczu: …”; `offers.validFrom` = `events.created_at`;
`offers.availability` = `SoldOut` (komplet, zapisy zamknięte, odwołany),
`LimitedAvailability` (≤ 2 wolne), `InStock`; `offers` tylko przy znanym koszcie
(`cost_grosz`); `organizer` = `@id` Organizacji Bojo z layoutu.

## BreadcrumbList

- **Wymagane:** `itemListElement`; każdy `ListItem` ma `position` (od 1, kolejno),
  `name` (albo `item.name`), `item` (pełny URL). `item` wolno pominąć tylko w ostatnim
  okruszku (bieżąca strona). Bojo tak robi (`breadcrumbsJsonLd()`, ostatni bez `path`).
- Zalecane co najmniej dwa okruszki.
- Od stycznia 2025 okruszki widać tylko w wynikach na komputerze.

## Organization (layout)

- Brak wymaganych; zalecane: `name`, `url`, `logo` (≥ 112×112, stały adres),
  `description`, `sameAs` (tylko realne profile: w Bojo świadomie puste, strategia 5a),
  `address`, `contactPoint`. Zasila logo w wynikach i panel wiedzy.
- `disambiguatingDescription` Bojo ma celowo: kolizja nazwy z potocznym „bojo”.

## WebSite (layout)

- Na stronie głównej zasila **nazwę witryny** w wynikach: `name`, `alternateName`
  (np. „Bojo.pl”), `url`. Pole wyszukiwania (`potentialAction` SearchAction) Google
  wycofał w listopadzie 2024: nie dodawać.

## LocalBusiness / SportsActivityLocation (strona obiektu)

- Wymagane (wg dokumentacji local business): `name`, `address`. Zalecane: `geo`, `url`,
  `telephone`, `openingHoursSpecification`, `image`, `priceRange`.
- **Brak raportu w GSC.** Wyniki lokalne zasila głównie Profil Firmy w Google.
  Znacznik pomaga zrozumieniu strony i modelom (GEO), a `amenityFeature`
  z potwierdzeń graczy (fosa F1) jest danymi, których nie ma nikt inny.
- Telefon obiektu: tylko gdy obiekt zgodził się na publikację (migracja `033`).

## ItemList (huby katalogu)

- Karuzela listy działa tylko dla kursów, filmów, przepisów i restauracji. Lista
  obiektów sportowych nie dostanie wyniku rozszerzonego. Znacznik zostaje jako opis
  struktury strony.

## FAQPage, HowTo

- HowTo: wynik wycofany we wrześniu 2023. FAQ: od 2023 tylko witryny rządowe i medyczne,
  w 2026 wycofany całkowicie (wynik, raport, test wyników rozszerzonych, API).
- Znaczniki mogą zostać: nie szkodzą i bywają czytane przez modele. Treść FAQ na
  stronie jest wartościowa dla ludzi i GEO niezależnie od znacznika.

## SoftwareApplication (layout)

- Wynik rozszerzony wymaga oceny (`aggregateRating` albo `review`) oraz `offers.price`.
  Bojo nie ma ocen, więc wyniku nie będzie. Nie dopisuj ocen bez prawdziwych opinii
  (fałszywe oceny łamią zasady Google i grożą ręcznym działaniem).
