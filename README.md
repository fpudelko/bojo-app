# ⚽ Bojo — Boiska Poznań

> Znajdź boisko w Poznaniu, zorganizuj mecz i zbierz skład. Aplikacja webowa, logowanie przez Google.

📖 **Nowy w projekcie? Zacznij od [PRZEWODNIK.md](./PRZEWODNIK.md)** — opis wszystkich funkcji (użytkownik + admin) w 5 minut.

---

## Architektura

Bez osobnego backendu — frontend rozmawia z Supabase bezpośrednio (chronione przez RLS).
Dane o boiskach uzupełniają skrypty Pythona uruchamiane ręcznie z GitHub Actions.

```
┌──────────────────┐        ┌──────────────────────┐
│   Frontend       │  REST  │      Supabase        │
│   Next.js 14     │ ─────▶ │  PostgreSQL + Auth   │
│   (Vercel)       │        │  (Google OAuth, RLS) │
│   Leaflet + OSM  │        └──────────▲───────────┘
└──────────────────┘                   │ service_role
                                        │
                          ┌─────────────┴────────────┐
                          │  Scraper (GitHub Actions) │
                          │  OSM + Google Places +    │
                          │  Claude (wzbogacanie)     │
                          └───────────────────────────┘
```

| Warstwa | Technologia |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Dane / Auth | Supabase (PostgreSQL, Google OAuth, Row Level Security) |
| Mapa | Leaflet + OpenStreetMap (bez tokenu); Mapbox tylko do miniaturek |
| Hosting | Vercel |
| Dane boisk | Python (`scraper/`) + Google Places API + Claude, w GitHub Actions |

---

## Uruchomienie lokalne

```bash
git clone <repo-url> && cd bojo-app
cp .env.example .env          # uzupełnij klucze Supabase (patrz .env.example)

cd frontend
npm install
npm run dev                   # http://localhost:3000
npm test                      # testy jednostkowe (Vitest)
npm run build                 # build produkcyjny
```

**Wymagania:** Node.js 18+, konto Supabase. Python 3.11+ tylko jeśli pracujesz przy scraperze.

---

## Baza danych

Schema i migracje: `supabase/migrations/`. Wgrywasz je w Supabase → SQL Editor
(kolejno wg numeracji). Dane startowe: `supabase/seed.sql`.

Najważniejsze tabele: `fields` (boiska), `events` (mecze), `event_participants`,
`recurring_events` (cykliczne), `bookings` (rezerwacje), `field_outreach` (CRM kontaktu),
`profiles` (użytkownicy + flaga `is_admin`).

---

## Dane o boiskach (scraper)

Uruchamiane ręcznie z **GitHub → Actions**. Kolejność i opis: patrz
[PRZEWODNIK.md, sekcja 4](./PRZEWODNIK.md#4-skąd-się-biorą-dane-o-boiskach).
Każdy workflow ma tryb `dry_run` (podgląd bez zapisu).

```
scraper.py         → import boisk (OSM + Google)
enrich_google.py   → telefon / strona / godziny (Google Places, darmowe)
enrich.py          → e-mail / operator / opis / rezerwacja (Claude web search)
enrich_booking.py  → wykrycie systemu rezerwacji ze strony WWW (Claude)
```

---

## Struktura projektu

```
bojo-app/
├── frontend/            # Aplikacja Next.js (całość UI + logika)
│   └── src/
│       ├── app/         # App Router — strony i trasy
│       ├── components/  # Komponenty React (mapa, layout, ui)
│       ├── lib/         # Klient Supabase, zapytania, walidacja
│       ├── config/      # Flagi funkcji
│       └── types/       # Typy TypeScript
├── scraper/             # Skrypty Pythona do danych o boiskach
├── supabase/migrations/ # Migracje SQL
├── .github/workflows/   # Importy/wzbogacanie danych (Actions)
└── PRZEWODNIK.md        # Opis funkcji dla współpracowników
```

---

## Licencja

MIT © 2026 Bojo
