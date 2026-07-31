# Bojo — kontekst dla Claude Code

Kontekst projektu i pułapki, które warto znać przed pierwszą zmianą.
Opis funkcji dla ludzi: [PRZEWODNIK.md](./PRZEWODNIK.md). Architektura: [README.md](./README.md).

## Szybki start

```bash
cd frontend
npm install
npm run dev            # http://localhost:3000
```

Wymaga `.env` w katalogu głównym (skopiuj z `.env.example`) z kluczami Supabase.

## Weryfikacja zmian — uruchamiaj przed każdym commitem

```bash
cd frontend
npx tsc --noEmit       # typecheck — musi być czysto
npm test               # Vitest, 38 testów
```

`npm run lint` **nie działa** bez interaktywnej konfiguracji ESLint — pomijaj.

## Architektura w skrócie

- **Brak własnego backendu.** Frontend (Next.js 14 App Router) rozmawia z Supabase bezpośrednio, dostęp pilnowany przez RLS.
- Logika domenowa siedzi w `frontend/src/lib/` (`events.ts`, `groups.ts`, `api.ts`, `payments.ts`…). Komponenty tego nie omijają.
- Wyjątek: `frontend/src/app/api/geocode/` — serwerowy proxy do Nominatim (przeglądarka nie może ustawić `User-Agent`).
- Interfejs jest **po polsku**. Komentarze w kodzie po angielsku.

## Pułapki, które już nas ugryzły

**Migracje SQL uruchamia się RĘCZNIE.** Pliki w `supabase/migrations/` (numerowane) trzeba wkleić do Supabase → SQL Editor. Nic nie robi tego automatycznie. Dodanie kolumny w migracji ≠ kolumna istnieje w bazie — jeśli apka rzuca błędem o nieznanej kolumnie, najpewniej migracja nie została puszczona.

**RLS po cichu unieważnia UPDATE.** Gdy polityka RLS nie pasuje, Postgres nie zgłasza błędu — po prostu aktualizuje 0 wierszy i zwraca sukces. Objaw: „przycisk nic nie robi". Realny przypadek: brakowało polityki pozwalającej użytkownikowi zmienić własny wpis w `event_participants` (naprawione w `053`). Jeśli zapis „nie działa" bez błędu — najpierw sprawdź polityki, nie kod.

**`truncate` w kontenerze flex wymaga `min-w-0`.** Bez tego element odmawia się skurczyć poniżej szerokości treści i rozpycha całą kartę w bok, zamiast obciąć tekst.

**Nie ma auto-awansu z listy rezerwowej.** To świadoma decyzja produktowa, nie brak: gdy ktoś się wypisze, rezerwowy nie wskakuje automatycznie — ktoś musi go powiadomić. Nie „naprawiaj" tego.

**Martwy kod:** `components/map/MapView.tsx`, `LeafletMapImpl.tsx`, `EventsMapView.tsx`, `EventsMapImpl.tsx` — nic ich nie importuje. Aktywna mapa to `VenueExplorer.tsx` (strona `/mapa`) i pickery lokalizacji.

## Modele domenowe warte poznania przed zmianami

**Relacja użytkownik ↔ wydarzenie to DWIE niezależne osie** (`lib/events.ts`):
- `isOrganizer` — czyj to mecz (trwała cecha)
- `status` — `none | invited | pending | observing | reserve | playing`

Można organizować mecz i w nim grać, albo organizować bez grania. Nie zwijaj tego do jednej etykiety. `invited` jest zarezerwowane pod przyszłe zaproszenia — jeszcze nic go nie ustawia.

**Płatności** (`lib/payments.ts`): organizator wybiera akceptowane metody i karty sportowe. Kwota zniżki jest **opcjonalna** — `null` znaczy „zniżka jest, ale zapytaj organizatora", nie „brak zniżki". Zawsze licz cenę przez `priceForParticipant()`, nie odejmuj ręcznie.

**RSVP „Obserwuję"** to w bazie `rsvp = 'maybe'`. Nie zajmuje miejsca, nie liczy się do statystyk gracza ani do historii meczów.

## Dane testowe

`supabase/seed_test_data.sql` — 20 wydarzeń pokrywających wszystkie kombinacje ustawień. Uruchamiany ręcznie w SQL Editor, bezpieczny do wielokrotnego użycia (czyści po markerze `[TEST]` w opisie). Konta testowe tworzy `supabase/seed-test-users.sql` (`test1..test10@example.com`, hasło `test1234`).

## Konwencje

- Commity i wiadomości do użytkownika po polsku.
- Migracje: kolejny numer + krótka nazwa, np. `058_nazwa_zmiany.sql`, z komentarzem **dlaczego** powstała.
- Nie commituj `.env` (jest w `.gitignore`).
