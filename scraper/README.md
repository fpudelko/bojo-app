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

## Wzbogacanie danych przez AI (`enrich.py`)

Dla obiektów bez danych kontaktowych skrypt `enrich.py` przeszukuje internet
(narzędzie web search Claude) po nazwie + adresie i uzupełnia: telefon, e-mail,
WWW, operatora, godziny otwarcia oraz **sposób rezerwacji**.

⚠️ **Płatne** (Claude API + web search). Najpierw przetestuj na kilku obiektach
z `--limit` i `--dry-run`.

Wyniki zapisywane są do:
- `fields` → telefon, email, www, operator, godziny (tylko jeśli puste — nie nadpisuje)
- `field_outreach` → `booking_system`, `ai_summary`, `ai_enriched_at` (widoczne w panelu `/admin/outreach`)

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export SUPABASE_URL=https://xxxx.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=eyJ...

python enrich.py --limit 5 --dry-run   # podgląd na 5 obiektach, bez zapisu
python enrich.py --limit 20            # realnie wzbogać 20 obiektów
python enrich.py                       # wszystkie jeszcze nieprzetworzone
```

| Zmienna | Opis | Wymagana |
|---------|------|----------|
| `ANTHROPIC_API_KEY` | Klucz API Claude | Tak |
| `ANTHROPIC_MODEL` | Model (domyślnie `claude-haiku-4-5-20251001`) | Opcjonalna |

| Flaga | Opis |
|-------|------|
| `--limit N` | przetwórz maks. N obiektów |
| `--dry-run` | wypisz wyniki, nic nie zapisuj |
| `--all` | przetwórz ponownie też już wzbogacone |
| `--require-empty` | tylko obiekty bez telefonu **i** e-maila |
| `--concurrency N` | równoległe zapytania (domyślnie 4) |
| `--model ID` | model Claude |

Domyślnie pomija obiekty już wzbogacone (`ai_enriched_at` ustawione), więc można
uruchamiać przyrostowo. Web search ≈ $10/1000 wyszukań — skrypt na końcu pokazuje
zużycie tokenów i szacunkowy koszt.
