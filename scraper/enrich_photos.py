"""
Boiska Poznań — Photo Enrichment
=================================
Finds usable venue photos and stores them in fields.photo_url:

  Priority 1: Google Places Photos (needs GOOGLE_PLACES_API_KEY)
              — real, high-quality venue photos
  Priority 2: Wikimedia Commons (free, no key)
              — CC-licensed photos, good for well-known venues
  Priority 3: Mapbox Satellite Static Image (needs MAPBOX_TOKEN)
              — aerial/satellite fallback for every venue

Usage:
    python enrich_photos.py --dry-run --limit 10
    python enrich_photos.py --strategy wikimedia   # skip Google
    python enrich_photos.py --strategy satellite   # satellite only
    python enrich_photos.py                         # all missing photos
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import urllib.parse
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("enrich-photos")

GOOGLE_NEARBY_URL  = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
GOOGLE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"
GOOGLE_PHOTO_URL   = "https://maps.googleapis.com/maps/api/place/photo"
WIKIMEDIA_API_URL  = "https://commons.wikimedia.org/w/api.php"
MAPBOX_STATIC_URL  = "https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static"

GOOGLE_SEARCH_RADIUS = 100   # metres
GOOGLE_PHOTO_MAXWIDTH = 1200


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
    """Return venues that have coordinates but no photo_url yet."""
    params: dict[str, str] = {
        "select": "id,name,lat,lng,address",
        "photo_url": "is.null",
        "not.lat": "is.null",
        "not.lng": "is.null",
        "limit": str(limit) if limit else "10000",
        "order": "name.asc",
    }
    r = await client.get(f"{base}/rest/v1/fields", headers=_sb_headers(key), params=params)
    r.raise_for_status()
    return r.json()


async def save_photo(
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

async def google_photo_url(
    client: httpx.AsyncClient, lat: float, lng: float,
    api_key: str,
) -> str | None:
    """Return a direct Google Places photo URL, or None."""
    # Nearby search to find the place
    r = await client.get(
        GOOGLE_NEARBY_URL,
        params={
            "location": f"{lat},{lng}",
            "radius": GOOGLE_SEARCH_RADIUS,
            "type": "stadium",
            "key": api_key,
        },
    )
    if r.status_code != 200:
        return None
    results = r.json().get("results", [])
    if not results:
        # Retry with 'park' type
        r = await client.get(
            GOOGLE_NEARBY_URL,
            params={"location": f"{lat},{lng}", "radius": GOOGLE_SEARCH_RADIUS,
                    "type": "park", "key": api_key},
        )
        results = r.json().get("results", []) if r.status_code == 200 else []
    if not results:
        return None

    place_id = results[0].get("place_id", "")
    if not place_id:
        return None

    # Get place details with photos
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
    if not ref:
        return None

    # Build the static photo URL
    params_photo = urllib.parse.urlencode({
        "maxwidth": GOOGLE_PHOTO_MAXWIDTH,
        "photo_reference": ref,
        "key": api_key,
    })
    # This URL redirects to the actual image; store as-is (browser follows redirect)
    return f"{GOOGLE_PHOTO_URL}?{params_photo}"


# ---------------------------------------------------------------------------
# Priority 2: Wikimedia Commons
# ---------------------------------------------------------------------------

async def wikimedia_photo_url(
    client: httpx.AsyncClient, name: str, address: str | None,
) -> str | None:
    """Search Wikimedia Commons for a CC-licensed venue photo."""
    city = "Poznań"
    if address:
        # Try to extract city from address (last word after comma)
        parts = [p.strip() for p in address.split(",")]
        if len(parts) >= 2:
            city = parts[-1].split()[0] if parts[-1].split() else city

    search_term = f"{name} {city}"

    # Search for files
    r = await client.get(
        WIKIMEDIA_API_URL,
        params={
            "action": "query",
            "list": "search",
            "srsearch": search_term,
            "srnamespace": "6",  # File namespace
            "format": "json",
            "srlimit": "3",
        },
    )
    if r.status_code != 200:
        return None
    hits = r.json().get("query", {}).get("search", [])
    if not hits:
        return None

    # Get image info for the first hit
    title = hits[0]["title"]
    ir = await client.get(
        WIKIMEDIA_API_URL,
        params={
            "action": "query",
            "titles": title,
            "prop": "imageinfo",
            "iiprop": "url|mime",
            "format": "json",
        },
    )
    if ir.status_code != 200:
        return None
    pages = ir.json().get("query", {}).get("pages", {})
    for page in pages.values():
        for info in page.get("imageinfo", []):
            mime = info.get("mime", "")
            if mime.startswith("image/") and "url" in info:
                return info["url"]
    return None


# ---------------------------------------------------------------------------
# Priority 3: Mapbox satellite fallback
# ---------------------------------------------------------------------------

def mapbox_satellite_url(lat: float, lng: float, token: str) -> str:
    return f"{MAPBOX_STATIC_URL}/{lng},{lat},17,0/800x600?access_token={token}"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def run(args: argparse.Namespace) -> None:
    base = os.environ["SUPABASE_URL"].rstrip("/")
    key  = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    gkey = os.environ.get("GOOGLE_PLACES_API_KEY", "")
    mbox = os.environ.get("MAPBOX_TOKEN", "")

    if not gkey and args.strategy in ("auto", "google"):
        log.warning("GOOGLE_PLACES_API_KEY not set — skipping Google Photos")
    if not mbox and args.strategy in ("auto", "satellite"):
        log.warning("MAPBOX_TOKEN not set — satellite fallback disabled")

    async with httpx.AsyncClient(
        headers={"User-Agent": "bojo-app-photo-enricher/1.0"}, timeout=30
    ) as client:
        venues = await fetch_venues(client, base, key, args.limit)
        log.info("Loaded %d venues without photo", len(venues))

        found = skipped = errors = 0

        for v in venues:
            field_id = v["id"]
            name     = v.get("name", field_id)
            lat      = float(v["lat"])
            lng      = float(v["lng"])
            addr     = v.get("address", "")

            photo_url    = None
            photo_source = None

            # --- Google ---
            if gkey and args.strategy in ("auto", "google") and not photo_url:
                try:
                    photo_url = await google_photo_url(client, lat, lng, gkey)
                    if photo_url:
                        photo_source = "google"
                        log.info("Google  %s", name)
                except Exception as e:
                    log.warning("Google error %s: %s", name, e)

            # --- Wikimedia ---
            if args.strategy in ("auto", "wikimedia") and not photo_url:
                try:
                    photo_url = await wikimedia_photo_url(client, name, addr)
                    if photo_url:
                        photo_source = "wikimedia"
                        log.info("Wikimedia %s", name)
                except Exception as e:
                    log.warning("Wikimedia error %s: %s", name, e)

            # --- Satellite fallback ---
            if mbox and args.strategy in ("auto", "satellite") and not photo_url:
                photo_url    = mapbox_satellite_url(lat, lng, mbox)
                photo_source = "satellite"
                log.info("Satellite %s", name)

            if not photo_url:
                skipped += 1
                log.debug("No photo  %s", name)
                continue

            if args.dry_run:
                log.info("[DRY RUN] %s → %s (%s)", name, photo_url[:80], photo_source)
                found += 1
                continue

            ok = await save_photo(client, base, key, field_id, photo_url, photo_source)
            if ok:
                found += 1
            else:
                errors += 1
                log.error("Save failed %s", name)

        log.info("Done — photos: %d | skipped: %d | errors: %d", found, skipped, errors)


def main() -> None:
    p = argparse.ArgumentParser(description="Find and store venue photos.")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument(
        "--strategy",
        choices=["auto", "google", "wikimedia", "satellite"],
        default="auto",
        help="Photo source priority (default: auto = Google → Wikimedia → satellite)",
    )
    p.add_argument("--limit", type=int, default=0, help="Max venues (0 = all)")
    asyncio.run(run(p.parse_args()))


if __name__ == "__main__":
    main()
