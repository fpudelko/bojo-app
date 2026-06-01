# Boiska Poznań — Scraper

Skrypt Python scrapujący boiska sportowe z:
- **OpenStreetMap** (Overpass API) — bezpłatnie, bez klucza API
- **Google Places API** — wymaga klucza `GOOGLE_PLACES_API_KEY`

Wyniki są normalizowane i wgrywane do Supabase (upsert po kluczu `source + external_id`).

## Uruchomienie

```bash
cd scraper
pip install -r requirements.txt

# Skopiuj i uzupełnij zmienne środowiskowe
cp ../.env.example .env

# Uruchom scraper
python scraper.py
```

## Zmienne środowiskowe

| Zmienna | Opis | Wymagana |
|---------|------|----------|
| `SUPABASE_URL` | URL projektu Supabase | Tak |
| `SUPABASE_SERVICE_ROLE_KEY` | Klucz serwisowy (pomija RLS) | Tak |
| `GOOGLE_PLACES_API_KEY` | Klucz Google Places API | Opcjonalna |

Bez `GOOGLE_PLACES_API_KEY` scraper pobierze dane wyłącznie z OpenStreetMap.

## Jak działa

1. Overpass API: zapytanie Overpass QL `leisure=pitch` dla bbox Poznania (52.32–52.52°N, 16.73–17.07°E)
2. Google Places: Text Search dla kilku zapytań (piłka nożna, tenis, koszykówka...)
3. Normalizacja do wspólnego schematu `Field`
4. Upsert do tabeli `fields` w Supabase (bezpieczny ponowny run)

## Harmonogram (cron)

Aby scraper uruchamiał się automatycznie co noc:

```bash
# crontab -e
0 2 * * * cd /path/to/bojo-app/scraper && python scraper.py >> /var/log/boiska-scraper.log 2>&1
```
