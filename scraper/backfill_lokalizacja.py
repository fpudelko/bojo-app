"""
Bojo — jednorazowy backfill `city`/`voivodeship` dla już zaimportowanych boisk
================================================================================

Migracja `112_seo_tier_i_lokalizacja.sql` dodaje kolumny `city`/`voivodeship`
do `fields`, potrzebne pod tierowanie indeksacji (SEO/GEO). Katalog ma dziś
32 684 wiersze, prawie wszystkie z `source='osm'` — ale miejscowość importer
(`import_osm_pbf.py`) dotąd liczył tylko po to, żeby wkleić ją w wolny tekst
`address` (`nearest_place()`, patrz `import_osm_pbf.py:483`), nigdy nie
zapisując jej jako osobnej kolumny. Adres bywa niejednoznaczny do odparsowania
z powrotem (169 duplikatów nazw, format "ul. X, Miejscowość" ALBO sama
miejscowość bez przecinka) — więc zamiast zgadywać z tekstu, ten skrypt
liczy miejscowość DOKŁADNIE TAK SAMO jak import: z tego samego pliku .osm.pbf,
tym samym najbliższym węzłem `place=`.

Nie potrzeba żadnej geometrii administracyjnej dla województwa — wycinki
Geofabrik są już podzielone na województwa, więc `voivodeship` to po prostu
`--region` tego przebiegu. Stąd import i backfill mają identyczny kształt
CLI: uruchamia się per województwo, tak jak `import_osm_pbf.py`.

Zapis idzie przez ten sam upsert co import (`on_conflict=source,external_id`,
`Prefer: resolution=merge-duplicates`), tylko z węższym payloadem — PostgREST
aktualizuje wyłącznie podane kolumny, więc reszta wiersza (nazwa, sport,
zdjęcia, komentarze użytkowników…) zostaje nietknięta. To ma być UPDATE
istniejących wierszy, nie tworzenie nowych — ale sam upsert tego nie
gwarantuje: dla `external_id` bez dopasowania PostgREST robi INSERT z tylko
tymi czterema kolumnami, a `name`/`address`/`lat`/`lng` są NOT NULL, więc cały
batch (do 500 rekordów, wysyłane jednym multi-row INSERT-em) odrzuca się
naraz. Świeży plik `.osm.pbf` nie jest gwarantowany identyczny z tym, na
którym stał oryginalny import. Dlatego PRZED wysyłką skrypt pobiera zbiór
`external_id` już obecnych w bazie (`source='osm'`) i odrzuca rekordy bez
dopasowania — dopiero to czyni upsert faktycznym UPDATE-only.

Migracja `112` ma trigger `BEFORE UPDATE OF city ON fields`, więc zapisanie
`city` tutaj automatycznie przelicza `seo_tier` tego wiersza — nie trzeba
osobnego kroku po backfillu.

Uruchomienie (jak import_osm_pbf.py — ręcznie, per województwo):
    pip install -r requirements.txt
    python backfill_lokalizacja.py --region wielkopolskie --dry-run
    python backfill_lokalizacja.py --region wielkopolskie

Wymagane zmienne (tylko przy zapisie):
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""

from __future__ import annotations

import argparse
import logging
import math
import os
import sys

import httpx

from import_osm_pbf import (
    Collector,
    GEOFABRIK,
    PLACE_RANK,
    WOJEWODZTWA,
    pobierz,
    sports_pl,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("backfill-lokalizacja")


def nearest_place(places: list, lat: float, lng: float) -> str | None:
    """Kopia `nearest_place()` z `import_osm_pbf.py:483` — tam jest domknięciem
    wewnątrz `main()`, więc nie da się jej zaimportować wprost. Trzymać w kroku
    z oryginałem: ten sam ranking miasto > miasteczko > wieś (`PLACE_RANK`),
    ten sam promień 25 km, ta sama waga odległości."""
    best, best_score = None, 1e9
    for p in places:
        dlat = (p.lat - lat) * 111.32
        dlng = (p.lng - lng) * 111.32 * math.cos(math.radians(lat))
        d = math.hypot(dlat, dlng)
        if d > 25:
            continue
        score = d * (1 + 0.35 * PLACE_RANK.get(p.tags.get("place", "village"), 3))
        if score < best_score:
            best, best_score = p, score
    return best.tags["name"] if best else None


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Backfill city/voivodeship dla boisk już zaimportowanych z .osm.pbf")
    ap.add_argument("--region", default="lubelskie",
                     help="województwo, nazwa wycinka Geofabrik: " + ", ".join(WOJEWODZTWA))
    ap.add_argument("--pbf", help="lokalny plik .osm.pbf zamiast pobierania")
    ap.add_argument("--dry-run", action="store_true", help="tylko raport, nic nie zapisuje")
    ap.add_argument("--limit", type=int, default=0, help="maks. wierszy do zapisu (0 = wszystkie)")
    args = ap.parse_args()

    if not args.pbf and args.region not in WOJEWODZTWA:
        log.error("Nieznany region: %s", args.region)
        log.error("Dostępne: %s", ", ".join(WOJEWODZTWA))
        return 1

    path = args.pbf
    if not path:
        path = f"/tmp/{args.region}-latest.osm.pbf"
        if not os.path.exists(path):
            pobierz(args.region, path)
    log.info("Plik: %s (%.0f MB)", path, os.path.getsize(path) / 1e6)

    log.info("Czytam plik — jedno przejście…")
    col = Collector()
    col.apply_file(path, locations=True)
    log.info("Znalezione: %d boisk, %d miejscowości", len(col.pitches), len(col.places))

    places = [p for p in col.places if p.lat is not None]

    records: list[dict[str, str]] = []
    brak_miejscowosci = 0
    for p in col.pitches:
        if p.coords:
            lat = sum(c[1] for c in p.coords) / len(p.coords)
            lng = sum(c[0] for c in p.coords) / len(p.coords)
        elif p.lat is not None:
            lat, lng = p.lat, p.lng
        else:
            continue

        # Sam filtr sportu zespołowego, żeby pominąć dokładnie te obiekty,
        # które import odrzucił i których nie ma w bazie — reszta jest bez
        # znaczenia (nazwa, kontekst…), bo tu tylko dopisujemy lokalizację.
        if not sports_pl(p.tags):
            continue

        city = (p.tags.get("addr:city") or "").strip() or nearest_place(places, lat, lng)
        if not city:
            brak_miejscowosci += 1
            continue

        records.append({
            "source": "osm",
            "external_id": f"osm:{p.osm_id}",
            "city": city,
            "voivodeship": args.region,
        })

    log.info("── RAPORT (%s) ─────────────────────────────", args.region)
    log.info("   boisk z miejscowością:    %d", len(records))
    log.info("   boisk bez miejscowości:   %d (pominięte)", brak_miejscowosci)
    log.info("── PRÓBKA 10 ────────────────────────────────")
    for r in records[:10]:
        log.info("   %s | %s | %s", r["external_id"], r["city"], r["voivodeship"])

    if args.dry_run:
        log.info("DRY RUN — nic nie zapisano.")
        return 0

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        log.error("Brak SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — nie mam gdzie zapisać.")
        return 1

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        # merge-duplicates: PostgREST aktualizuje WYŁĄCZNIE kolumny podane
        # w payloadzie (source, external_id, city, voivodeship) — reszta
        # wiersza (nazwa, zdjęcia, komentarze) zostaje nietknięta.
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }

    # Pre-fetch — patrz docstring modułu, akapit o NOT NULL i atomowości batcha.
    znane_id: set[str] = set()
    with httpx.Client(timeout=60) as client:
        offset = 0
        while True:
            r = client.get(
                f"{url}/rest/v1/fields",
                params={"source": "eq.osm", "select": "external_id", "limit": 1000, "offset": offset},
                headers={"apikey": key, "Authorization": f"Bearer {key}"},
            )
            r.raise_for_status()
            page = r.json()
            znane_id.update(row["external_id"] for row in page if row["external_id"])
            if len(page) < 1000:
                break
            offset += 1000
    log.info("W bazie jest %d obiektów source=osm z external_id.", len(znane_id))

    do_zapisu = [rec for rec in records if rec["external_id"] in znane_id]
    bez_dopasowania = len(records) - len(do_zapisu)
    if bez_dopasowania:
        log.info("   pominięto %d — external_id spoza bazy (nie tworzymy nowych wierszy tutaj)", bez_dopasowania)

    to_write = do_zapisu[: args.limit] if args.limit else do_zapisu
    endpoint = f"{url}/rest/v1/fields?on_conflict=source,external_id"
    written = 0
    with httpx.Client(timeout=120) as client:
        for i in range(0, len(to_write), 500):
            batch = to_write[i:i + 500]
            r = client.post(endpoint, json=batch, headers=headers)
            if r.status_code >= 300:
                log.error("Batch %d: HTTP %s — %s", i // 500, r.status_code, r.text[:400])
                return 1
            written += len(batch)
            log.info("   zapisano %d / %d", written, len(to_write))

    log.info("Gotowe: %d wierszy zaktualizowanych.", written)
    return 0


if __name__ == "__main__":
    sys.exit(main())
