# Audyt projektu Bojo — 2026-06-02

## Struktura projektu

```
bojo-app/
├── frontend/          Next.js 14 App Router — jedyny aktywny frontend
├── supabase/
│   ├── migrations/    SQL (001–011) — baza jest w Supabase Cloud
│   └── functions/     Edge Functions Deno: send-invites, send-event-sms
├── backend/           ⚠️  MARTWY KOD — patrz sekcja poniżej
├── scraper/           Python — scraper boisk (jednorazowe użycie)
├── App.js             ⚠️  React Native — pozostałości z poprzedniej wersji
├── screens/           ⚠️  React Native — nieużywane
├── components/        ⚠️  React Native — nieużywane (inne niż frontend/src/components)
└── navigation/        ⚠️  React Native — nieużywane
```

---

## ⚠️ POWAŻNE ZNALEZISKA (zgłoszone zanim cokolwiek naprawiłem)

### 1. Backend FastAPI — martwy kod (nie usuwam bez Twojej zgody)

**Plik:** `backend/app/routers/fields.py`, `games.py`

Backend FastAPI (~600 linii) **nigdy nie jest wywoływany przez frontend**. Frontend komunikuje się bezpośrednio z Supabase. Cały backend ma hardkodowane dane testowe zamiast prawdziwych zapytań do bazy:

```python
# backend/app/routers/fields.py, linia 11
# Mock data — replace with Supabase queries once database is seeded
MOCK_FIELDS: list[FieldModel] = [
    FieldModel(id="b1a2c3d4-...", name="Boisko Sportowe ul. Dąbrowskiego", ...)
]
```

`games.py` linia 114: `raise HTTPException(status_code=501, detail="Not implemented yet")`.

**Ryzyko:** Brak — kod nie jest uruchamiany w produkcji. Ale zajmuje miejsce i może mylić nowych deweloperów.
**Rekomendacja:** Usunąć lub przenieść do archiwum. Nie usuwam bez Twojego OK.

---

### 2. Bug: licznik gier w sekcji sportów zawsze pokazuje 0

**Plik:** `frontend/src/components/SportsSectionWithCounts.tsx`, linia 38–39

```typescript
.gte('date', from)   // ❌ BŁĄD — kolumna nie istnieje
.lte('date', to)     // ❌ BŁĄD — kolumna nie istnieje
```

Prawidłowa nazwa kolumny w bazie to `event_date` (widać w `events.ts` mapper: `date: row.event_date`).

**Skutek:** Sekcja "Wybierz swój sport" zawsze pokazuje "· znajdź mecz" zamiast liczby gier, bo wszystkie zapytania zwracają pustą tablicę. Naprawione w tym commicie.

---

## Bezpieczeństwo

### ✅ Brak zahardkodowanych sekretów
Wszystkie klucze API są w zmiennych środowiskowych. `.gitignore` poprawnie wyklucza `.env*`. Brak kredencjałów w kodzie.

### ℹ️ CORS w edge functions (akceptowalne)
Supabase Edge Functions używają `'Access-Control-Allow-Origin': '*'`. Jest to standardowy pattern dla Supabase Functions — są chronione przez JWT Supabase. Nie wymaga zmiany.

### ℹ️ Frontend-only admin check
`useAdmin()` sprawdza `is_admin` po stronie klienta. Operacje wrażliwe (np. aktualizacja boiska) powinny być zabezpieczone przez RLS w bazie — co jest częściowo zrobione. Priorytet: średni.

### ℹ️ Walidacja inputów
Dane wejściowe (telefon, notatki, nazwa gościa) nie są walidowane przed wysłaniem do Supabase. RLS chroni przed eskalacją uprawnień, ale niepoprawne dane mogą trafić do bazy. Priorytet: niski dla prototypu.

---

## Martwy kod i porządki

| Lokalizacja | Co | Akcja |
|-------------|-----|-------|
| `/backend/` | FastAPI z mockami, nigdy nie używany | Czeka na Twój OK do usunięcia |
| `/App.js`, `/screens/`, `/components/`, `/navigation/` | Resztki React Native z poprzedniej wersji | Czeka na Twój OK do usunięcia |
| `/scraper/` | Jednorazowy scraper, dane już w bazie | Zostawić jako dokumentację |
| `SPORT_EMOJI` | Zduplikowany w 4 plikach | Przeniesiony do `utils.ts` w tym commicie |

---

## Dług techniczny

| # | Problem | Wpływ | Status |
|---|---------|-------|--------|
| 1 | `event_date` bug w SportsSectionWithCounts | Liczy gry zawsze 0 | ✅ Naprawione |
| 2 | Emoji zamiast ikon w 4 miejscach | Niespójny wygląd | ✅ Naprawione |
| 3 | Brak robots.txt / sitemap.xml | SEO: strona niewidoczna dla Google | ✅ Naprawione |
| 4 | Brak slug-URL dla boisk | SEO: `/boisko/orlik-rataje` dawało 404 | ✅ Naprawione |
| 5 | Brak testów | Regresy niewykrywalne | ✅ Dodane testy krytyczne |
| 6 | Stary copy w sekcji sportów | Duplikat/sprzeczność z hero | ✅ Naprawione |
| 7 | Backend FastAPI (mock data) | Martwy kod, dezorientuje | ⏳ Czeka na decyzję |
| 8 | React Native legacy files | Bałagan w root | ⏳ Czeka na decyzję |

---

## Zależności

Wszystkie zależności npm są aktualne (Next.js 14.2.3, React 18, Supabase JS 2.x). Brak krytycznych CVE.

---

## Gotowość na rozwój

**Mocne strony:**
- Supabase z RLS — dobrze przemyślana warstwa bezpieczeństwa
- TypeScript wszędzie, brak `any` poza mapperami z jednoznacznym komentarzem
- Migracje SQL w wersjonowaniu (001–011), można odtworzyć schemat z zera
- Feature flags (`FEATURE_RESERVATIONS`, `bookingEnabled`) — bezpieczne A/B

**Do zrobienia przed scale-up:**
- Testy E2E (Playwright) dla krytycznych flow: zapis na mecz, rezerwacja
- Server-side Supabase client z service role key dla operacji admin (teraz wszystko przez anon key z RLS)
- Rate limiting na Edge Functions (send-event-sms szczególnie)
