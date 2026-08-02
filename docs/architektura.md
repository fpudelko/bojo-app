# Architektura

Jak dane płyną przez system i gdzie leży logika. Modele domenowe → [domena.md](./domena.md).
Schemat bazy → [baza-danych.md](./baza-danych.md).

---

## Zasada podstawowa: nie ma własnego backendu

Frontend rozmawia z Supabase **bezpośrednio**. Nie ma serwera aplikacyjnego, nie ma
warstwy API, nie ma kontrolerów. Autoryzacja jest w całości po stronie bazy —
**Row Level Security**.

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

**Konsekwencja dla piszącego kod:** nie da się „dodać endpointu". Nowa operacja na danych
to funkcja w `frontend/src/lib/` + odpowiednia polityka RLS w migracji. Jeśli operacja
wymaga uprawnień, których użytkownik nie ma, potrzebna jest funkcja `SECURITY DEFINER`
w bazie (RPC), a nie obejście po stronie klienta.

| Warstwa | Technologia |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Dane / Auth | Supabase (PostgreSQL, Google OAuth + e-mail, RLS) |
| Mapa | Leaflet + OpenStreetMap (bez tokenu); Mapbox tylko do miniaturek |
| Hosting | Vercel |
| E-mail | Resend (przez Edge Functions) |
| SMS | SMSAPI.pl (główny) + Twilio (zapasowy) |
| Dane boisk | Python (`scraper/`) + Google Places API + Claude, w GitHub Actions |

---

## Warstwy w `frontend/src/`

```
app/          App Router — strony i trasy (45 tras z page.tsx)
components/   Komponenty React
lib/          Logika domenowa i cała komunikacja z Supabase (30 modułów)
config/       Flagi funkcji zależne od env
types/        Typy TypeScript
```

**Komponenty nie omijają `lib/`.** Zapytanie do Supabase mieszkające w komponencie to
błąd — logika ma być w `lib/`, żeby dało się ją przetestować i żeby reguły domenowe
(np. liczenie pojemności meczu) nie rozjechały się między miejscami wywołania.

### Jedyny wyjątek: `app/api/geocode/`

Serwerowy proxy do Nominatim. Istnieje z jednego powodu: **przeglądarka nie może ustawić
nagłówka `User-Agent`**, a Nominatim go wymaga. To nie jest zalążek backendu — nie
dokładać tam kolejnych tras.

### Mappery jako granica typów

`lib/events.ts` i `lib/api.ts` zawierają mappery (`toEvent`, `toField`, …) tłumaczące
wiersz z bazy (`snake_case`) na obiekt TypeScript (`camelCase`). To jedyne miejsce, gdzie
kształt bazy dotyka aplikacji.

⚠️ **Dziś rzutowanie bez walidacji runtime.** Jeśli baza zwróci coś innego, niż mówi typ,
nikt tego nie wyłapie. Zod jest na liście długu technicznego
([strategia.md §5](./strategia.md#5-dług-techniczny)).

⚠️ **Pułapka nazw:** kolumny w bazie to `cost_grosz` i `sports_card_discount_grosz`
(bez „e" na końcu), a pola TS to `costGrosze` i `sportsCardDiscountGrosze`. Mapper jest
jedynym miejscem, gdzie te dwie konwencje się spotykają.

---

## Renderowanie

App Router, mieszanka server i client components:

- **Server components** — strony publiczne, indeksowalne: `/boisko/[id]`, `/boiska/[sport]`.
  Tu generowane są metadane i JSON-LD.
- **Client components** (`'use client'`) — wszystko interaktywne: `EventDetailClient.tsx`,
  `VenueExplorer.tsx`, formularze.

Sesja użytkownika żyje w `lib/auth.tsx` (kontekst Reacta nad Supabase Auth).

---

## Edge Functions (Deno, po stronie Supabase)

Trzy, wszystkie do komunikacji wychodzącej — czyli do rzeczy, których klient nie może
zrobić bezpiecznie, bo wymagają sekretów:

| Funkcja | Rola |
|---|---|
| `notify-game-alert` | E-mail przez Resend o nowej grze pasującej do alertu (`game_alerts`) |
| `send-event-sms` | SMS przez SMSAPI z fallbackiem na Twilio |
| `send-invites` | Zaproszenia do meczów cyklicznych |

---

## Dane o boiskach (scraper)

Python w `scraper/`, uruchamiany **ręcznie** z GitHub → Actions (11 workflowów).
Zapisuje do bazy przez `service_role`, czyli z pominięciem RLS.

```
scraper.py         → import boisk (OSM + Google, odsiewanie duplikatów po GPS)
enrich_google.py   → telefon / strona / godziny (Google Places)
enrich.py          → e-mail / operator / opis / rezerwacja (Claude web search)
enrich_booking.py  → wykrycie systemu rezerwacji ze strony WWW (Claude)
classify.py        → klasyfikacja typu obiektu
enrich_photos.py   → zdjęcia
enrich_geocode.py  → uzupełnianie współrzędnych
fix_coords.py      → korekta błędnych współrzędnych
analyze_venues.py  → analiza zdjęć satelitarnych
```

Każdy workflow ma tryb `dry_run` — podgląd bez zapisu. Wyniki trafiają do `fields`
(dane boiska) i `field_outreach` (status kontaktu + dane od AI).

---

## Środowiska i wdrożenie

**Jest tylko jedno środowisko — produkcja.** Każdy merge do `master` idzie na żywo.
Rozdzielenie dev/prod to priorytet techniczny #1
([strategia.md §4](./strategia.md#4-rozdzielenie-środowisk-dev--prod)).

Domena kanoniczna: **`bojo.pl`**, ustawiana przez `NEXT_PUBLIC_SITE_URL`. Wszystkie
miejsca w kodzie (`layout.tsx`, `robots.ts`, `sitemap.ts`) mają ten sam fallback — jeśli
dodajesz kolejne, użyj tej samej wartości.

**Migracje uruchamia się ręcznie** w Supabase → SQL Editor. Nic nie robi tego
automatycznie — szczegóły i pułapki w [baza-danych.md](./baza-danych.md).
