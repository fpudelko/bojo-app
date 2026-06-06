"""
Boiska Poznań — Geocode Enrichment  (Nominatim / OSM, DARMOWE)
===============================================================
Uzupełnia pola `address`, `postcode` i `district` (dzielnica/osiedle)
dla obiektów, które mają współrzędne (lat/lng) ale brakuje im adresu
lub dzielnicy.

Używa Nominatim — bezpłatnego geocodera OpenStreetMap.
Limit zapytań: 1/sek (polityka Nominatim) → ~25 min dla 1426 obiektów.

Uruchomienie:
    pip install httpx python-dotenv
    export SUPABASE_URL=https://xxxx.supabase.co
    export SUPABASE_SERVICE_ROLE_KEY=eyJ...

    python enrich_geocode.py --dry-run           # podgląd, bez zapisu
    python enrich_geocode.py --limit 20          # pierwsze 20
    python enrich_geocode.py                      # wszystkie brakujące
    python enrich_geocode.py --overwrite          # nadpisz też istniejące dane
    python enrich_geocode.py --missing-district   # tylko brakujące dzielnice

Wynik:
    fields.address    "ul. Roosevelta 18"
    fields.postcode   "60-829"
    fields.district   "Jeżyce"  (osiedle lub dzielnica z Nominatim)
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import re
import time
from typing import Any

import httpx
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("geocode")

PHOTON_URL    = "https://photon.komoot.io/reverse"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
USER_AGENT    = "bojo-app-venue-enricher/1.0 (contact: admin@bojo.app)"

# ---------------------------------------------------------------------------
# Nominatim helpers
# ---------------------------------------------------------------------------

# Polish street prefixes we want to normalise
_PREFIX_MAP = {
    "ulica": "ul.",
    "ul ": "ul. ",
    "aleja": "al.",
    "aleje": "al.",
    "al ": "al. ",
    "plac": "pl.",
    "pl ": "pl. ",
    "os ": "os. ",
    "osiedle": "os.",
    "rondo": "rondo",
    "park": "park",
    "skwer": "skwer",
}

# Poznań has 5 main dzielnice and ~42 osiedla.
# We prefer the granular osiedle name stored in `suburb`.
# These canonical names override the raw Nominatim value to ensure
# consistent capitalisation / spelling.
_KNOWN_DISTRICTS = {
    # Dzielnica Grunwald
    "grunwald": "Grunwald",
    "łazarz": "Łazarz",
    "junikowo": "Junikowo",
    "kwiatowe": "Kwiatowe",
    "świerczewo": "Świerczewo",
    "wilda": "Wilda",
    "dębiec": "Dębiec",
    # Dzielnica Jeżyce
    "jeżyce": "Jeżyce",
    "sołacz": "Sołacz",
    "wola": "Wola",
    "winiary": "Winiary",
    "podolany": "Podolany",
    "strzeszyn": "Strzeszyn",
    "ogrody": "Ogrody",
    "golęcin": "Golęcin",
    "krzyżowniki-smochowice": "Krzyżowniki-Smochowice",
    "smochowice": "Krzyżowniki-Smochowice",
    "krzyżowniki": "Krzyżowniki-Smochowice",
    # Dzielnica Nowe Miasto
    "nowe miasto": "Nowe Miasto",
    "główna": "Główna",
    "chartowo": "Chartowo",
    "rataje": "Rataje",
    "starołęka": "Starołęka",
    "minikowo": "Minikowo",
    "maltańskie": "Maltańskie",
    "żegrze": "Żegrze",
    "antoninek-zieliniec-kobylepole": "Antoninek",
    "zieliniec": "Antoninek",
    "kobylepole": "Antoninek",
    "antoninek": "Antoninek",
    "osiedle piastowskie": "Piastowskie",
    "piastowskie": "Piastowskie",
    "osiedle oświecenia": "Oświecenia",
    "oświecenia": "Oświecenia",
    "osiedle jagiellońskie": "Jagiellońskie",
    "jagiellońskie": "Jagiellońskie",
    "osiedle lecha": "Lecha",
    "lecha": "Lecha",
    "osiedle rusa": "Rusa",
    "rusa": "Rusa",
    "osiedle tysiąclecia": "Tysiąclecia",
    "tysiąclecia": "Tysiąclecia",
    "osiedle orła białego": "Orła Białego",
    "orła białego": "Orła Białego",
    "osiedle przemysława": "Przemysława",
    "przemysława": "Przemysława",
    "osiedle jana iii sobieskiego": "Jana III Sobieskiego",
    "jana iii sobieskiego": "Jana III Sobieskiego",
    "osiedle stefana batorego": "Stefana Batorego",
    "stefana batorego": "Stefana Batorego",
    "osiedle władysława iv": "Władysława IV",
    "władysława iv": "Władysława IV",
    # Dzielnica Stare Miasto
    "stare miasto": "Stare Miasto",
    "centrum": "Centrum",
    "śródka": "Śródka",
    "ostrów tumski": "Ostrów Tumski",
    "zawady": "Zawady",
    "winogrady": "Winogrady",
    "piątkowo": "Piątkowo",
    "naramowice": "Naramowice",
    "morasko-radojewo": "Morasko-Radojewo",
    "morasko": "Morasko-Radojewo",
    "radojewo": "Morasko-Radojewo",
    "szeląg": "Szeląg",
    "szczepankowo": "Szczepankowo-Spławie-Krzesinki",
    # Dzielnica Wilda (already in Grunwald section above)
}

# Broader dzielnica fallback when suburb is not recognised
_CITY_DISTRICTS = {
    "grunwald": "Grunwald",
    "jeżyce": "Jeżyce",
    "nowe miasto": "Nowe Miasto",
    "stare miasto": "Stare Miasto",
    "wilda": "Wilda",
}


def _normalise_district(suburb: str | None, city_district: str | None) -> str | None:
    """Return a clean dzielnica name from Nominatim suburb / city_district fields."""
    for raw in (suburb, city_district):
        if not raw:
            continue
        key = raw.strip().lower()
        # direct lookup
        if key in _KNOWN_DISTRICTS:
            return _KNOWN_DISTRICTS[key]
        # strip "osiedle " prefix then try again
        without_prefix = re.sub(r'^osiedle\s+', '', key).strip()
        if without_prefix in _KNOWN_DISTRICTS:
            return _KNOWN_DISTRICTS[without_prefix]
        # broader dzielnica fallback
        if key in _CITY_DISTRICTS:
            return _CITY_DISTRICTS[key]
        # if neither, just capitalise the raw value (handles villages outside Poznań)
        return raw.strip().title()
    return None


def _build_address(addr: dict[str, str]) -> str | None:
    """
    Format a Nominatim address dict into a clean Polish street address.
    Returns None if we can't form a meaningful address.

    Output examples:
      "ul. Roosevelta 18"
      "al. Niepodległości 16"
      "os. Bolesława Chrobrego 117"
    """
    street = (
        addr.get("road")
        or addr.get("pedestrian")
        or addr.get("path")
        or addr.get("footway")
        or ""
    ).strip()
    house = addr.get("house_number", "").strip()

    if not street:
        return None

    # Normalise prefix
    low = street.lower()
    for full, short in _PREFIX_MAP.items():
        if low.startswith(full):
            street = short + " " + street[len(full):].strip()
            break
    else:
        # No recognised prefix — for streets named without ul./al., add "ul."
        # unless it's already capitalised (e.g. "Plac Wiosny Ludów")
        if not any(street.lower().startswith(p) for p in ("ul.", "al.", "pl.", "os.", "rondo", "park", "skwer")):
            street = "ul. " + street

    return f"{street} {house}".strip() if house else street


def _is_city_only(address: str | None) -> bool:
    """True if the address is just a city name / clearly not a street-level address."""
    if not address:
        return True
    a = address.strip().lower()
    # Pure city names or very short strings without numbers
    if a in ("poznań", "luboń", "mosina", "swarzędz", "komorniki", "dopiewo", "tarnowo podgórne"):
        return True
    if len(a) < 6:
        return True
    # Has no digits → likely no house number, still might be a street though
    return False


# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------

def _sb_headers(key: str, extra: dict[str, str] | None = None) -> dict[str, str]:
    h = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    if extra:
        h.update(extra)
    return h


async def fetch_candidates(
    client: httpx.AsyncClient, base: str, key: str,
    *,
    overwrite: bool,
    missing_district_only: bool,
) -> list[dict[str, Any]]:
    r = await client.get(
        f"{base}/rest/v1/fields",
        headers=_sb_headers(key),
        params={
            "select": "id,name,address,postcode,lat,lng,district",
            "lat": "not.is.null",
            "limit": "10000",
        },
    )
    r.raise_for_status()
    fields = r.json()

    out = []
    skipped = 0
    for f in fields:
        if f.get("lat") is None or f.get("lng") is None:
            continue
        has_good_address = bool(f.get("address")) and not _is_city_only(f.get("address"))
        has_district = bool(f.get("district"))

        if missing_district_only:
            if has_district and not overwrite:
                skipped += 1
                continue
        else:
            if has_good_address and has_district and not overwrite:
                skipped += 1
                continue

        out.append(f)

    if skipped:
        log.info("Pominięto %d obiektów z pełnymi danymi (użyj --overwrite, żeby nadpisać)", skipped)
    return out


async def patch_field(
    client: httpx.AsyncClient, base: str, key: str,
    field_id: str, patch: dict[str, Any],
) -> bool:
    rp = await client.patch(
        f"{base}/rest/v1/fields",
        headers=_sb_headers(key, {"Prefer": "return=minimal"}),
        params={"id": f"eq.{field_id}"},
        json=patch,
    )
    if rp.status_code not in (200, 204):
        log.error("  patch %s failed %s: %s", field_id, rp.status_code, rp.text[:150])
        return False
    return True


# ---------------------------------------------------------------------------
# Rate-limit helper  (shared between photon + Nominatim)
# ---------------------------------------------------------------------------

_last_call: list[float] = [0.0]
_MIN_INTERVAL = 1.1   # seconds between ANY geocode request


async def _throttle() -> None:
    elapsed = time.monotonic() - _last_call[0]
    if elapsed < _MIN_INTERVAL:
        await asyncio.sleep(_MIN_INTERVAL - elapsed)
    _last_call[0] = time.monotonic()


# ---------------------------------------------------------------------------
# photon.komoot.io  (primary — permissive rate limits, same OSM data)
# ---------------------------------------------------------------------------

async def _photon_reverse(
    client: httpx.AsyncClient, lat: float, lng: float,
) -> dict[str, Any] | None:
    """Reverse geocode via photon.komoot.io. Returns normalised address dict or None."""
    await _throttle()
    try:
        r = await client.get(
            PHOTON_URL,
            params={"lat": str(lat), "lon": str(lng), "limit": "1", "lang": "pl"},
            headers={"User-Agent": USER_AGENT},
            timeout=15.0,
        )
        if r.status_code == 429:
            log.warning("  photon 429 — czekam 30s")
            await asyncio.sleep(30)
            return None
        if r.status_code != 200:
            return None
        features = r.json().get("features") or []
        if not features:
            return None
        props = features[0].get("properties", {})
        # Normalise to the same dict shape as Nominatim's `address` block
        return {
            "road":          props.get("street", ""),
            "house_number":  props.get("housenumber", ""),
            "postcode":      props.get("postcode", ""),
            # photon returns osiedle/dzielnica in "district" or "locality"
            "suburb":        props.get("district") or props.get("locality") or "",
            "city_district": "",   # photon doesn't split this further
            "_source":       "photon",
        }
    except Exception as exc:
        log.debug("  photon error %.5f,%.5f — %s", lat, lng, exc)
        return None


# ---------------------------------------------------------------------------
# Nominatim  (fallback — strict 1 req/sec; 429 handled with backoff)
# ---------------------------------------------------------------------------

async def _nominatim_reverse(
    client: httpx.AsyncClient, lat: float, lng: float,
) -> dict[str, Any] | None:
    """Reverse geocode via Nominatim with exponential backoff on 429."""
    for attempt in range(3):
        await _throttle()
        try:
            r = await client.get(
                NOMINATIM_URL,
                params={
                    "lat": str(lat), "lon": str(lng),
                    "format": "jsonv2", "addressdetails": "1",
                    "zoom": "18", "accept-language": "pl",
                },
                headers={"User-Agent": USER_AGENT},
                timeout=15.0,
            )
            if r.status_code == 429:
                wait = int(r.headers.get("Retry-After", 60 * (2 ** attempt)))
                log.warning("  Nominatim 429 — czekam %ds (próba %d/3)", wait, attempt + 1)
                await asyncio.sleep(wait)
                continue
            if r.status_code != 200:
                return None
            data = r.json()
            if "address" not in data:
                return None
            addr = data["address"]
            addr["_source"] = "nominatim"
            return addr
        except Exception as exc:
            log.debug("  Nominatim error %.5f,%.5f — %s", lat, lng, exc)
            return None
    return None


# ---------------------------------------------------------------------------
# Combined reverse geocoder  (photon first, Nominatim fallback)
# ---------------------------------------------------------------------------

async def reverse_geocode(
    client: httpx.AsyncClient, lat: float, lng: float,
) -> dict[str, Any] | None:
    """Reverse geocode preferring a result that includes a house number.

    photon is fast but frequently omits the house number for a point dropped in
    the middle of a pitch; Nominatim (zoom 18) resolves the building more often.
    So we try photon first, and if it gives a street WITHOUT a number we still
    consult Nominatim and keep whichever actually has a house number — that's the
    whole point of "numery, nie tylko ulice".
    """
    photon = await _photon_reverse(client, lat, lng)
    if photon and photon.get("house_number"):
        return photon  # already complete — no need to bother Nominatim

    # photon missing a number (or empty) → ask Nominatim too
    nomi = await _nominatim_reverse(client, lat, lng)
    if nomi and nomi.get("house_number"):
        return nomi
    # neither has a number — return whatever has a street/postcode
    if photon and (photon.get("road") or photon.get("postcode")):
        return photon
    return nomi


def parse_result(addr: dict[str, Any], field: dict[str, Any], overwrite: bool) -> dict[str, Any]:
    """
    Extract address, postcode, district from a normalised address dict.
    Works with output from both _photon_reverse and _nominatim_reverse.
    """
    patch: dict[str, Any] = {}

    # --- Address ---
    has_good_address = bool(field.get("address")) and not _is_city_only(field.get("address"))
    if not has_good_address or overwrite:
        new_addr = _build_address(addr)
        if new_addr:
            patch["address"] = new_addr

    # --- Postcode ---
    if not field.get("postcode") or overwrite:
        pc = (addr.get("postcode") or "").strip()
        if pc:
            patch["postcode"] = pc

    # --- District ---
    if not field.get("district") or overwrite:
        suburb = addr.get("suburb") or addr.get("neighbourhood") or addr.get("quarter")
        city_district = addr.get("city_district")
        district = _normalise_district(suburb, city_district)
        if district:
            patch["district"] = district

    return patch


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def run(args: argparse.Namespace) -> None:
    load_dotenv()
    base = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    if not (base and key):
        log.error("Ustaw SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY"); return

    async with httpx.AsyncClient() as client:
        candidates = await fetch_candidates(
            client, base, key,
            overwrite=args.overwrite,
            missing_district_only=args.missing_district,
        )
        if args.limit:
            candidates = candidates[: args.limit]

        total = len(candidates)
        log.info(
            "%d obiektów do przetworzenia%s%s",
            total,
            " (tylko dzielnice)" if args.missing_district else "",
            " · DRY RUN" if args.dry_run else f" · szacowany czas ~{total // 60 + 1} min",
        )
        if not total:
            log.info("Nic do zrobienia."); return

        stats = {"patched": 0, "no_result": 0, "no_change": 0,
                 "with_number": 0, "street_only": 0, "district": 0}

        for i, field in enumerate(candidates, 1):
            lat, lng = float(field["lat"]), float(field["lng"])
            name = field.get("name") or "?"

            data = await reverse_geocode(client, lat, lng)
            if data is None:
                log.warning("[%d/%d] ✗ %s — brak odpowiedzi geocodera", i, total, name[:50])
                stats["no_result"] += 1
                continue

            patch = parse_result(data, field, args.overwrite)
            if not patch:
                stats["no_change"] += 1
                log.debug("[%d/%d] · %s — bez zmian", i, total, name[:50])
                continue

            # track address quality so the log shows how many got a house number
            if "address" in patch:
                if re.search(r"\d", patch["address"]):
                    stats["with_number"] += 1
                else:
                    stats["street_only"] += 1
            if "district" in patch:
                stats["district"] += 1

            source = data.get("_source", "?")
            log.info(
                "[%d/%d] ✓ %s [%s] | %s",
                i, total, name[:40], source,
                "  ".join(f"{k}={v}" for k, v in patch.items() if not k.startswith("_")),
            )

            if not args.dry_run:
                await patch_field(client, base, key, field["id"], patch)
                stats["patched"] += 1
            else:
                stats["patched"] += 1  # count as "would patch" in dry-run

        log.info("─" * 60)
        log.info(
            "Gotowe: %d/%d zaktualizowano · %d bez wyników · %d bez zmian%s",
            stats["patched"], total, stats["no_result"], stats["no_change"],
            " (DRY RUN — nic nie zapisano)" if args.dry_run else "",
        )
        log.info(
            "Adresy: %d z numerem domu · %d tylko ulica · dzielnice: %d",
            stats["with_number"], stats["street_only"], stats["district"],
        )


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Uzupełnia adres, kod pocztowy i dzielnicę dla obiektów z lat/lng"
    )
    p.add_argument("--limit",            type=int, default=0,
                   help="przetwórz max N obiektów (0 = wszystkie)")
    p.add_argument("--dry-run",          action="store_true",
                   help="wyświetl zmiany, nie zapisuj")
    p.add_argument("--overwrite",        action="store_true",
                   help="nadpisz istniejący adres/dzielnicę nowym wynikiem z Nominatim")
    p.add_argument("--missing-district", action="store_true",
                   help="tylko obiekty bez dzielnicy (zachowaj istniejące adresy)")
    return p.parse_args()


if __name__ == "__main__":
    asyncio.run(run(parse_args()))
