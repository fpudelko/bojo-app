"""
Boiska Poznań — Photo Enrichment
=================================
Finds venue photos and stores references:

  Priority 1: Google Places API (needs GOOGLE_PLACES_API_KEY)
              → stores google_place_id + photo_reference in DB
              → displayed via /api/venue-photo?ref=<photo_reference>
              → LEGAL: never cache the image, proxy on demand

  Priority 2: Wikimedia Commons (free, no key)
              → stores direct CC-licensed image URL in photo_url

  Priority 3: Mapbox Satellite (needs MAPBOX_TOKEN)
              → stores satellite image URL in photo_url

Usage:
    python enrich_photos.py --dry-run --limit 10
    python enrich_photos.py --strategy google
    python enrich_photos.py --strategy wikimedia
    python enrich_photos.py --strategy satellite
    python enrich_photos.py                      # auto: google → wikimedia → satellite
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("enrich-photos")

GOOGLE_NEARBY_URL  = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
GOOGLE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"
WIKIMEDIA_API_URL  = "https://commons.wikimedia.org/w/api.php"
MAPBOX_STATIC_URL  = "https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static"

GOOGLE_SEARCH_RADIUS = 150   # metres — wider to catch parks/lakes


# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------

def _sb_headers(key: str, extra: dict[str, str] | None = None) -> dict[str, str]:
    h = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    if extra:
        h.update(extra)
    return h


async def fetch_venues(
    client: httpx.AsyncClient, base: str, key: str, limit: int,
) -> list[dict[str, Any]]:
    """Return venues that have coordinates but no photo yet."""
    # Select only columns guaranteed to exist (photo_url from migration 037).
    # google_place_id / photo_reference come from migration 038 — we try to
    # include them but fall back gracefully if the migration hasn't been applied.
    for select in (
        "id,name,lat,lng,address,photo_url,photo_reference,google_place_id",
        "id,name,lat,lng,address,photo_url",   # fallback: 038 not yet applied
    ):
        params: dict[str, str] = {
            "select": select,
            "photo_url": "is.null",
            "lat": "not.is.null",
            "lng": "not.is.null",
            "limit": str(limit) if limit else "10000",
            "order": "name.asc",
        }
        r = await client.get(f"{base}/rest/v1/fields", headers=_sb_headers(key), params=params)
        if r.status_code == 400:
            log.warning("Column not found in DB, retrying with reduced select (%s)", select)
            continue
        r.raise_for_status()
        all_venues = r.json()
        return [
            v for v in all_venues
            if not v.get("photo_reference") and not v.get("photo_url")
        ]
    raise RuntimeError("Failed to fetch venues — check Supabase columns (run migration 037)")


async def save_google(
    client: httpx.AsyncClient, base: str, key: str,
    field_id: str, place_id: str, photo_ref: str,
) -> bool:
    r = await client.patch(
        f"{base}/rest/v1/fields",
        headers=_sb_headers(key, {"Prefer": "return=minimal"}),
        params={"id": f"eq.{field_id}"},
        json={"google_place_id": place_id, "photo_reference": photo_ref, "photo_source": "google"},
    )
    return r.status_code in (200, 204)


async def save_url_photo(
    client: httpx.AsyncClient, base: str, key: str,
    field_id: str, url: str, source: str,
) -> bool:
    r = await client.patch(
        f"{base}/rest/v1/fields",
        headers=_sb_headers(key, {"Prefer": "return=minimal"}),
        params={"id": f"eq.{field_id}"},
        json={"photo_url": url, "photo_source": source},
    )
    return r.status_code in (200, 204)


# ---------------------------------------------------------------------------
# Priority 1: Google Places
# ---------------------------------------------------------------------------

_NEARBY_TYPES = ("stadium", "park", "gym", "sports_complex")


async def google_find(
    client: httpx.AsyncClient, lat: float, lng: float, api_key: str,
) -> tuple[str, str] | None:
    """Return (place_id, photo_reference) or None."""
    for ptype in _NEARBY_TYPES:
        r = await client.get(
            GOOGLE_NEARBY_URL,
            params={"location": f"{lat},{lng}", "radius": GOOGLE_SEARCH_RADIUS,
                    "type": ptype, "key": api_key},
        )
        if r.status_code != 200:
            continue
        results = r.json().get("results", [])
        if results:
            break
    else:
        return None

    place_id = results[0].get("place_id", "")
    if not place_id:
        return None

    dr = await client.get(
        GOOGLE_DETAILS_URL,
        params={"place_id": place_id, "fields": "photos", "key": api_key},
    )
    if dr.status_code != 200:
        return None
    photos = dr.json().get("result", {}).get("photos", [])
    if not photos:
        return None

    ref = photos[0].get("photo_reference", "")
    return (place_id, ref) if ref else None


# ---------------------------------------------------------------------------
# Priority 2: Wikimedia Commons (CC-licensed, safe to store URL)
# ---------------------------------------------------------------------------

async def wikimedia_find(
    client: httpx.AsyncClient, name: str, address: str | None,
) -> str | None:
    """Return a direct CC image URL from Wikimedia Commons, or None."""
    city = "Poznań"
    if address:
        parts = [p.strip() for p in address.split(",")]
        city_candidates = [p for p in parts[1:] if not p[:2].isdigit()]
        if city_candidates:
            city = city_candidates[-1].split()[0]

    r = await client.get(
        WIKIMEDIA_API_URL,
        params={"action": "query", "list": "search", "srsearch": f"{name} {city}",
                "srnamespace": "6", "format": "json", "srlimit": "3"},
    )
    if r.status_code != 200:
        return None
    hits = r.json().get("query", {}).get("search", [])
    if not hits:
        return None

    for hit in hits:
        ir = await client.get(
            WIKIMEDIA_API_URL,
            params={"action": "query", "titles": hit["title"],
                    "prop": "imageinfo", "iiprop": "url|mime", "format": "json"},
        )
        if ir.status_code != 200:
            continue
        for page in ir.json().get("query", {}).get("pages", {}).values():
            for info in page.get("imageinfo", []):
                if info.get("mime", "").startswith("image/"):
                    return info.get("url")
    return None


# ---------------------------------------------------------------------------
# Priority 3: Mapbox satellite (always available with token)
# ---------------------------------------------------------------------------

def satellite_url(lat: float, lng: float, token: str) -> str:
    return f"{MAPBOX_STATIC_URL}/{lng},{lat},17,0/800x500?access_token={token}"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def run(args: argparse.Namespace) -> None:
    base = os.environ["SUPABASE_URL"].rstrip("/")
    key  = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    gkey = os.environ.get("GOOGLE_PLACES_API_KEY", "")
    mbox = os.environ.get("MAPBOX_TOKEN", "")

    if not gkey and args.strategy in ("auto", "google"):
        log.warning("GOOGLE_PLACES_API_KEY not set — Google Photos skipped")
    if not mbox and args.strategy in ("auto", "satellite"):
        log.warning("MAPBOX_TOKEN not set — satellite fallback disabled")

    async with httpx.AsyncClient(
        headers={"User-Agent": "bojo-app-photo-enricher/1.0"}, timeout=30
    ) as client:
        venues = await fetch_venues(client, base, key, args.limit)
        log.info("Loaded %d venues without photo", len(venues))

        found = skipped = errors = 0

        for v in venues:
            fid  = v["id"]
            name = v.get("name", fid)
            lat  = float(v["lat"])
            lng  = float(v["lng"])
            addr = v.get("address", "")

            result_type: str | None = None
            ok = False

            # --- Google ---
            if gkey and args.strategy in ("auto", "google"):
                gresult = await google_find(client, lat, lng, gkey)
                if gresult:
                    place_id, photo_ref = gresult
                    if args.dry_run:
                        log.info("[DRY] Google  %s → place=%s ref=%s…", name, place_id, photo_ref[:20])
                        found += 1
                        continue
                    ok = await save_google(client, base, key, fid, place_id, photo_ref)
                    result_type = "google"

            # --- Wikimedia ---
            if not result_type and args.strategy in ("auto", "wikimedia"):
                wurl = await wikimedia_find(client, name, addr)
                if wurl:
                    if args.dry_run:
                        log.info("[DRY] Wiki    %s → %s", name, wurl[:60])
                        found += 1
                        continue
                    ok = await save_url_photo(client, base, key, fid, wurl, "wikimedia")
                    result_type = "wikimedia"

            # --- Satellite ---
            if not result_type and mbox and args.strategy in ("auto", "satellite"):
                surl = satellite_url(lat, lng, mbox)
                if args.dry_run:
                    log.info("[DRY] Sat     %s → %s", name, surl[:60])
                    found += 1
                    continue
                ok = await save_url_photo(client, base, key, fid, surl, "satellite")
                result_type = "satellite"

            if result_type:
                if ok:
                    found += 1
                    log.info("✓ %s  [%s]", name, result_type)
                else:
                    errors += 1
                    log.error("✗ save failed  %s", name)
            else:
                skipped += 1
                log.debug("no photo  %s", name)

        log.info("Done — found: %d | skipped: %d | errors: %d", found, skipped, errors)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--strategy", choices=["auto", "google", "wikimedia", "satellite"],
                   default="auto")
    p.add_argument("--limit", type=int, default=0)
    asyncio.run(run(p.parse_args()))


if __name__ == "__main__":
    main()
