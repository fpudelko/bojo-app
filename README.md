# ⚽ Boiska Poznań

> Agregator boisk sportowych w Poznaniu — znajdź boisko, zarezerwuj termin i szukaj graczy do gry.

## Opis projektu

**Boiska Poznań** to aplikacja webowa umożliwiająca mieszkańcom Poznania:

- **Przeglądanie mapy boisk** — boiska piłkarskie, korty tenisowe, boiska do koszykówki, siatkówki i futsalu na interaktywnej mapie Mapbox
- **Filtrowanie** po rodzaju sportu, dostępności i odległości
- **Szukam graczy** — tablica ogłoszeń do organizowania gier (ogłoszenia z liczbą potrzebnych graczy)
- **Scrapowanie danych** z Google Places API i OpenStreetMap

---

## Architektura

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BOISKA POZNAŃ                                │
├──────────────────────┬──────────────────────┬───────────────────────┤
│     FRONTEND         │      BACKEND         │      DANE             │
│   (Next.js 14)       │    (FastAPI)         │   (Supabase)          │
│                      │                      │                       │
│  ┌───────────────┐   │  ┌────────────────┐  │  ┌─────────────────┐  │
│  │  App Router   │   │  │  /health       │  │  │  fields (table) │  │
│  │  /            │──▶│  │  /fields       │◀─┤  │  games  (table) │  │
│  │  /mapa        │   │  │  /games        │  │  │  RLS policies   │  │
│  │  /gracze      │   │  │                │  │  └─────────────────┘  │
│  └───────────────┘   │  └────────────────┘  │                       │
│                      │         │            │  ┌─────────────────┐  │
│  ┌───────────────┐   │  ┌──────▼───────┐   │  │  Redis (cache)  │  │
│  │  Mapbox GL JS │   │  │  Supabase    │   │  │  port 6379      │  │
│  │  MapView      │   │  │  client      │   │  └─────────────────┘  │
│  └───────────────┘   │  └──────────────┘   │                       │
│                      │                      │                       │
│  port: 3000          │  port: 8000          │                       │
└──────────────────────┴──────────────────────┴───────────────────────┘
                                  │
                        ┌─────────▼─────────┐
                        │   SCRAPER (cron)  │
                        │  Google Places +  │
                        │  OpenStreetMap    │
                        └───────────────────┘
```

---

## Wymagania

| Narzędzie | Minimalna wersja |
|-----------|-----------------|
| Node.js   | 18+             |
| Python    | 3.11+           |
| Docker    | 24+             |
| Docker Compose | 2.x      |
| Konto Supabase | —         |
| Token Mapbox   | —         |

---

## Instalacja i uruchomienie

### 1. Klonowanie i konfiguracja zmiennych środowiskowych

```bash
git clone <repo-url>
cd bojo-app
cp .env.example .env
# Uzupełnij wartości w .env
```

### 2. Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
# Aplikacja dostępna na http://localhost:3000
```

### 3. Backend (FastAPI)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Linux/macOS
# .venv\Scripts\activate         # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# API dostępne na http://localhost:8000
# Dokumentacja: http://localhost:8000/docs
```

### 4. Uruchomienie przez Docker Compose (zalecane)

```bash
# Skopiuj .env.example do .env i uzupełnij wartości
cp .env.example .env

# Uruchom wszystkie usługi
docker-compose up --build

# Usługi:
#  Frontend:  http://localhost:3000
#  Backend:   http://localhost:8000
#  Redis:     localhost:6379
```

### 5. Migracja bazy danych (Supabase)

W panelu Supabase przejdź do SQL Editor i wykonaj:

```bash
# Migracja schematu
cat supabase/migrations/001_initial_schema.sql

# Dane testowe
cat supabase/seed.sql
```

### 6. Scraper danych

```bash
cd scraper
pip install -r requirements.txt
cp ../.env.example .env
# Uzupełnij GOOGLE_PLACES_API_KEY i dane Supabase
python scraper.py
```

---

## Zmienne środowiskowe

| Zmienna | Opis | Wymagana |
|---------|------|----------|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Token publiczny Mapbox GL JS | Tak |
| `NEXT_PUBLIC_API_URL` | URL backendu FastAPI | Tak |
| `SUPABASE_URL` | URL projektu Supabase | Tak |
| `SUPABASE_ANON_KEY` | Klucz publiczny (anon) Supabase | Tak |
| `SUPABASE_SERVICE_ROLE_KEY` | Klucz serwisowy Supabase (backend/scraper) | Tak |
| `GOOGLE_PLACES_API_KEY` | Klucz Google Places API (scraper) | Opcjonalna |
| `REDIS_URL` | URL Redis do cache'owania danych | Tak |

---

## Endpointy API

| Metoda | Endpoint | Opis |
|--------|----------|------|
| `GET` | `/health` | Status serwisu |
| `GET` | `/fields` | Lista boisk z filtrami |
| `GET` | `/fields/{id}` | Szczegóły boiska |
| `GET` | `/games` | Lista ogłoszeń graczy |
| `POST` | `/games` | Utwórz nowe ogłoszenie |

### Parametry GET /fields

| Parametr | Typ | Opis |
|----------|-----|------|
| `sport` | string | Filtr po sporcie (np. `piłka nożna`) |
| `available` | bool | Tylko dostępne boiska |
| `lat` | float | Szerokość geograficzna centrum wyszukiwania |
| `lng` | float | Długość geograficzna centrum wyszukiwania |
| `radius_km` | float | Promień wyszukiwania w km (domyślnie 10) |
| `limit` | int | Liczba wyników (domyślnie 50) |
| `offset` | int | Offset stronicowania |

### Parametry GET /games

| Parametr | Typ | Opis |
|----------|-----|------|
| `field_id` | string | Filtr po boisku |
| `sport` | string | Filtr po sporcie |
| `limit` | int | Liczba wyników (domyślnie 20) |

---

## Struktura projektu

```
bojo-app/
├── frontend/           # Next.js 14 + Tailwind CSS + Mapbox
│   └── src/
│       ├── app/        # App Router (strony)
│       ├── components/ # Komponenty React
│       ├── lib/        # Supabase client, API helpers
│       └── types/      # TypeScript interfaces
├── backend/            # FastAPI + Python 3.11
│   └── app/
│       ├── routers/    # Endpointy API
│       ├── models.py   # Pydantic models
│       ├── config.py   # Konfiguracja (Settings)
│       └── database.py # Klient Supabase
├── supabase/
│   ├── migrations/     # Migracje SQL
│   └── seed.sql        # Dane testowe
├── scraper/            # Scraper Google Places + OSM
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Licencja

MIT © 2024 Boiska Poznań
