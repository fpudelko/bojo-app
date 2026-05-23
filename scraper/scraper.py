"""
Boiska Poznań — Field Scraper
==============================
Scrapes sports fields from:
  1. OpenStreetMap via Overpass API (free, no key required)
  2. Google Places API Text Search (requires GOOGLE_PLACES_API_KEY)

Results are normalized to the same schema and upserted to Supabase.
Existing records are matched by (source, external_id) — safe to re-run.

Usage:
    pip install -r requirements.txt
    cp ../.env.example .env  # fill in credentials
    python scraper.py
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any

import httpx
from dotenv import load_dotenv
from tenacity import retry, stop_after_attempt, wait_exponential

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

POZNAN_BBOX = (52.32, 16.73, 52.52, 17.07)  # south, west, north, east
POZNAN_CENTER = "52.4064,16.9252"

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
GOOGLE_PLACES_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"

SPORT_QUERIES = [
    "boisko piłka nożna Poznań",
    "kort tenisowy Poznań",
    "boisko koszykówka Poznań",
    "siłownia zewnętrzna Poznań",
    "boisko siatkówka Poznań",
]

OSM_SPORT_MAP: dict[str, str] = {
    "soccer": "piłka nożna",
    "football": "piłka nożna",
    "basketball": "koszykówka",
    "volleyball": "siatkówka",
    "tennis": "tenis",
    "futsal": "futsal",
    "multi": "wielofunkcyjne",
}

SURFACE_MAP: dict[str, str] = {
    "grass": "grass",
    "natural_grass": "grass",
    "artificial": "artificial",
    "artifical_turf": "artificial",
    "astroturf": "artificial",
    "tartan": "hardcourt",
    "asphalt": "concrete",
    "concrete": "concrete",
    "clay": "clay",
    "compacted": "concrete",
}


# ---------------------------------------------------------------------------
# OpenStreetMap (Overpass API)
# ---------------------------------------------------------------------------


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def scrape_osm(bbox: tuple[float, float, float, float]) -> list[dict[str, Any]]:
    """
    Fetch sports pitches from OpenStreetMap via Overpass API.

    Uses Overpass QL to find all nodes, ways and relations tagged with
    leisure=pitch in the given bounding box.
    """
    south, west, north, east = bbox
    query = f"""
    [out:json][timeout:30];
    (
      node["leisure"="pitch"]({south},{west},{north},{east});
      way["leisure"="pitch"]({south},{west},{north},{east});
      relation["leisure"="pitch"]({south},{west},{north},{east});
    );
    out center;
    """

    async with httpx.AsyncClient(timeout=40.0) as client:
        response = await client.post(OVERPASS_URL, data={"data": query})
        response.raise_for_status()
        data = response.json()

    elements: list[dict] = data.get("elements", [])
    fields = []
    for el in elements:
        normalized = normalize_osm_element(el)
        if normalized:
            fields.append(normalized)

    return fields


def normalize_osm_element(element: dict[str, Any]) -> dict[str, Any] | None:
    """Convert an OSM element (node/way/relation) to our Field schema."""
    tags: dict[str, str] = element.get("tags", {})

    # Determine lat/lng — nodes have them directly; ways/relations have 'center'
    if element.get("type") == "node":
        lat = element.get("lat")
        lng = element.get("lon")
    else:
        center = element.get("center", {})
        lat = center.get("lat")
        lng = center.get("lon")

    if not lat or not lng:
        return None

    name = (
        tags.get("name")
        or tags.get("name:pl")
        or tags.get("ref")
        or f"Boisko OSM #{element.get('id', '')}"
    )

    osm_sport = tags.get("sport", "").lower()
    sport_pl = OSM_SPORT_MAP.get(osm_sport, "inne")

    surface_raw = tags.get("surface", "").lower()
    surface = SURFACE_MAP.get(surface_raw, "")

    is_indoor = tags.get("indoor", "no").lower() in ("yes", "true", "1")
    if tags.get("building"):
        is_indoor = True

    address_parts = [
        tags.get("addr:street", ""),
        tags.get("addr:housenumber", ""),
        tags.get("addr:city", "Poznań"),
    ]
    address = " ".join(p for p in address_parts if p).strip() or "Poznań"

    return {
        "name": name,
        "address": address,
        "lat": float(lat),
        "lng": float(lng),
        "sport": [sport_pl],
        "available": True,
        "surface": surface,
        "is_indoor": is_indoor,
        "phone": tags.get("contact:phone") or tags.get("phone"),
        "website": tags.get("website") or tags.get("contact:website"),
        "source": "osm",
        "external_id": f"osm:{element['type']}/{element['id']}",
    }


# ---------------------------------------------------------------------------
# Google Places API
# ---------------------------------------------------------------------------


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def scrape_google_places(
    query: str,
    location: str,
    api_key: str,
    radius: int = 15000,
) -> list[dict[str, Any]]:
    """
    Fetch sports fields from Google Places API (Text Search endpoint).

    Handles pagination via next_page_token (up to 3 pages = 60 results per query).
    """
    params = {
        "query": query,
        "location": location,
        "radius": radius,
        "key": api_key,
        "language": "pl",
    }

    all_results: list[dict] = []

    async with httpx.AsyncClient(timeout=20.0) as client:
        while True:
            response = await client.get(GOOGLE_PLACES_URL, params=params)
            response.raise_for_status()
            data = response.json()

            status = data.get("status")
            if status not in ("OK", "ZERO_RESULTS"):
                log.warning("Google Places returned status=%s for query=%r", status, query)
                break

            results = data.get("results", [])
            all_results.extend(results)

            next_token = data.get("next_page_token")
            if not next_token or len(all_results) >= 60:
                break

            # Google requires a short delay before using next_page_token
            await asyncio.sleep(2)
            params = {"pagetoken": next_token, "key": api_key}

    fields = [normalize_google_place(r) for r in all_results]
    return [f for f in fields if f is not None]


def normalize_google_place(place: dict[str, Any]) -> dict[str, Any] | None:
    """Convert a Google Places result to our Field schema."""
    geometry = place.get("geometry", {}).get("location", {})
    lat = geometry.get("lat")
    lng = geometry.get("lng")

    if not lat or not lng:
        return None

    name = place.get("name", "")
    address = place.get("formatted_address", place.get("vicinity", "Poznań"))
    place_id = place.get("place_id", "")

    # Heuristic sport detection from name/types
    name_lower = name.lower()
    types = place.get("types", [])
    sport: list[str] = []

    if any(kw in name_lower for kw in ("piłk", "futsal", "soccer", "football")):
        sport.append("piłka nożna")
    if any(kw in name_lower for kw in ("tenis", "tennis", "kort")):
        sport.append("tenis")
    if any(kw in name_lower for kw in ("koszykówka", "basketball", "basket")):
        sport.append("koszykówka")
    if any(kw in name_lower for kw in ("siatkówka", "volleyball")):
        sport.append("siatkówka")
    if "gym" in types or "stadium" in types:
        sport.append("inne")
    if not sport:
        sport = ["inne"]

    is_indoor = any(kw in name_lower for kw in ("hala", "sala", "indoor", "kryty", "kryta"))

    return {
        "name": name,
        "address": address,
        "lat": float(lat),
        "lng": float(lng),
        "sport": sport,
        "available": True,
        "surface": "",
        "is_indoor": is_indoor,
        "phone": None,
        "website": None,
        "source": "google_places",
        "external_id": f"gp:{place_id}",
    }


# ---------------------------------------------------------------------------
# Supabase upsert
# ---------------------------------------------------------------------------


async def upsert_fields(
    fields: list[dict[str, Any]],
    supabase_url: str,
    service_key: str,
) -> None:
    """
    Upsert a list of fields into Supabase.
    Deduplicates by (source, external_id) — existing records are updated in place.
    """
    if not fields:
        log.info("No fields to upsert.")
        return

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    endpoint = f"{supabase_url}/rest/v1/fields"

    # Batch in groups of 100 to avoid payload limits
    BATCH_SIZE = 100
    total_upserted = 0

    async with httpx.AsyncClient(timeout=30.0) as client:
        for i in range(0, len(fields), BATCH_SIZE):
            batch = fields[i : i + BATCH_SIZE]
            response = await client.post(
                endpoint,
                json=batch,
                headers={**headers, "Prefer": "resolution=merge-duplicates,return=minimal"},
            )
            if response.status_code not in (200, 201):
                log.error(
                    "Supabase upsert error (batch %d): %s — %s",
                    i // BATCH_SIZE + 1,
                    response.status_code,
                    response.text[:200],
                )
            else:
                total_upserted += len(batch)
                log.info(
                    "Upserted batch %d/%d (%d fields)",
                    i // BATCH_SIZE + 1,
                    -(-len(fields) // BATCH_SIZE),
                    len(batch),
                )

    log.info("Total upserted: %d fields", total_upserted)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


async def main() -> None:
    load_dotenv()

    api_key = os.getenv("GOOGLE_PLACES_API_KEY", "")
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    # --- OSM scrape ---
    log.info("Scraping OpenStreetMap (bbox=%s)...", POZNAN_BBOX)
    try:
        osm_fields = await scrape_osm(POZNAN_BBOX)
        log.info("  Found %d fields from OSM", len(osm_fields))
    except Exception as exc:
        log.error("OSM scrape failed: %s", exc)
        osm_fields = []

    # --- Google Places scrape ---
    if api_key:
        log.info("Scraping Google Places (%d queries)...", len(SPORT_QUERIES))
        google_fields: list[dict] = []
        for sport_query in SPORT_QUERIES:
            try:
                results = await scrape_google_places(sport_query, POZNAN_CENTER, api_key)
                log.info("  Query %r → %d results", sport_query, len(results))
                google_fields.extend(results)
            except Exception as exc:
                log.error("Google Places query %r failed: %s", sport_query, exc)
        log.info("  Total from Google Places: %d fields", len(google_fields))
    else:
        log.warning("GOOGLE_PLACES_API_KEY not set — skipping Google Places scrape.")
        google_fields = []

    all_fields = osm_fields + google_fields
    log.info("Grand total: %d fields to upsert", len(all_fields))

    if not all_fields:
        log.warning("Nothing to upsert.")
        return

    if supabase_url and service_key:
        await upsert_fields(all_fields, supabase_url, service_key)
        log.info("Done!")
    else:
        log.warning(
            "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — printing first 10 results:"
        )
        for field in all_fields[:10]:
            log.info(
                "  - [%s] %s @ (%.4f, %.4f) sport=%s",
                field.get("source"),
                field.get("name"),
                field.get("lat", 0),
                field.get("lng", 0),
                field.get("sport"),
            )


if __name__ == "__main__":
    asyncio.run(main())
