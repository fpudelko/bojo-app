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

## Odwrotny scraper rezerwacji (`scrape_booking.py`) — strony rezerwacji → obiekty

Działa **od drugiej strony** niż `scraper.py`: zaczyna od stron z rezerwacjami,
wyciąga z nich **gdzie jest boisko** (nazwa + adres + link do rezerwacji),
geokoduje adres na współrzędne, dopasowuje do istniejących obiektów albo **dodaje
nowe — od razu widoczne na mapie** (`source='booking'`, `map_visibility='public'`).

Źródła (providerzy), wybierane flagą `--source`:

| Źródło | Co robi |
|--------|---------|
| `ai` | Claude z web search szuka stron „rezerwacja boiska Poznań", wchodzi na nie i wyciąga obiekty + URL rezerwacji |
| `platforms` | znane platformy (Playarena, Activenow, Hally, ZagrajwMieście…) — pobiera listy obiektów, Claude wyciąga dane |
| `posir` | strony miejskie / POSiR z orlikami i halami |
| `all` | wszystkie powyższe (domyślnie) |

Każdy obiekt: forward-geocode (Nominatim) → dopasowanie (geo + adres) → albo
uzupełnienie `fields.booking_url` istniejącego obiektu, albo dodanie nowego.
Idempotentny i bezpieczny do ponownego uruchamiania.

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export SUPABASE_URL=https://xxxx.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=eyJ...

python scrape_booking.py --source all --dry-run   # podgląd
python scrape_booking.py --source ai --limit 20    # tylko odkrywanie AI
python scrape_booking.py                           # wszystko, zapis
```

> ⚠️ Listy URL w `PLATFORM_SEEDS` / `POSIR_SEEDS` to punkt startowy — zweryfikuj
> i dopisz aktualne adresy katalogów. Ekstrakcja działa na treści strony
> (Claude), więc jest odporna na zmiany layoutu HTML.

| Flaga | Opis |
|-------|------|
| `--source {ai,platforms,posir,all}` | źródło danych |
| `--limit N` | maks. obiektów (0 = wszystkie) |
| `--dry-run` | podgląd, bez zapisu |
| `--no-add` | nie twórz nowych, tylko wzbogacaj istniejące |
| `--concurrency N` | równoległe pobierania stron (domyślnie 3) |

## Wzbogacanie z Google Places (`enrich_google.py`) — darmowe

Dla istniejących obiektów pobiera z Google **telefon, stronę WWW i godziny
otwarcia** (Find Place + Place Details). **Darmowe** w ramach kredytu Google
$200/mc (~11 tys. zapytań). Google **nie udostępnia** e-maila ani sposobu
rezerwacji — to dorobi `enrich.py` (Claude).

Kolejność: **najpierw `enrich_google.py` (free), potem `enrich.py` (Claude)** —
Claude dobierze tylko to, czego Google nie dał, więc płatny krok jest tańszy.

```bash
export GOOGLE_PLACES_API_KEY=AIza...
export SUPABASE_URL=https://xxxx.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=eyJ...

python enrich_google.py --limit 5 --dry-run   # podgląd, bez zapisu
python enrich_google.py                        # wszystkie bez telefonu/www
```

Obiekty pod tym samym adresem łączone są w jedno zapytanie. Skrypt jest
idempotentny (uzupełnia tylko puste pola), więc można uruchamiać wielokrotnie.

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
