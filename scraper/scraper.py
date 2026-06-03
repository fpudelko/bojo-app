"""
Boiska Poznań — Field Scraper
==============================
Scrapes sports fields from:
  1. OpenStreetMap via Overpass API (free, no key required)
     Uses OSM administrative boundary areas instead of a raw BBOX so the
     coverage follows the actual city / county borders.
     Default areas: miasto Poznań + powiat poznański.
  2. Google Places API Text Search (requires GOOGLE_PLACES_API_KEY)

Only team/group sports are imported (soccer, basketball, volleyball, futsal,
handball, beach volleyball, hockey, rugby, multi-sport). Individual sports
(tennis, athletics, cycling, golf, etc.) are filtered out.

Results are upserted to Supabase on (source, external_id).
Manual rows (source=manual) are never touched.

Usage:
    pip install -r requirements.txt
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

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# OSM administrative areas to scrape.
# Each tuple: (area name as in OSM, admin_level).
# miasto Poznań is admin_level=6; powiat poznański (ring county) is also 6.
OSM_AREAS: list[tuple[str, str]] = [
    ("Poznań", "6"),
    ("powiat poznański", "6"),
]

POZNAN_CENTER = "52.4064,16.9252"

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
GOOGLE_PLACES_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"

SPORT_QUERIES = [
    "boisko piłka nożna Poznań",
    "boisko koszykówka Poznań",
    "boisko siatkówka Poznań",
    "boisko siatkówka plażowa Poznań",
    "boisko futsal Poznań",
    "hala sportowa Poznań",
    # Booking-focused: venues that advertise online/phone reservations
    "rezerwacja boiska Poznań",
    "wynajem boiska Poznań",
    "boisko do wynajęcia Poznań",
    "centrum sportowe rezerwacja Poznań",
    "kompleks sportowy Poznań",
    "orlik Poznań",
]

# Team/group sports only — individual sports (tennis, athletics, golf…) are excluded.
TEAM_SPORTS = {
    "soccer",
    "football",
    "basketball",
    "volleyball",
    "beach_volleyball",
    "futsal",
    "handball",
    "team_handball",
    "rugby",
    "hockey",
    "field_hockey",
    "ice_hockey",
    "american_football",
    "baseball",
    "cricket",
    "multi",
}

OSM_SPORT_MAP: dict[str, str] = {
    "soccer": "piłka nożna",
    "football": "piłka nożna",
    "basketball": "koszykówka",
    "volleyball": "siatkówka",
    "beach_volleyball": "siatkówka plażowa",
    "futsal": "futsal",
    "handball": "piłka ręczna",
    "team_handball": "piłka ręczna",
    "rugby": "rugby",
    "hockey": "hokej",
    "field_hockey": "hokej na trawie",
    "ice_hockey": "hokej",
    "american_football": "futbol amerykański",
    "baseball": "baseball",
    "cricket": "krykiet",
    "multi": "wielofunkcyjne",
}

# Normalized surface codes (stored in DB)
SURFACE_MAP: dict[str, str] = {
    "grass": "grass",
    "natural_grass": "grass",
    "artificial": "artificial",
    "artificial_turf": "artificial",
    "artifical_turf": "artificial",
    "astroturf": "artificial",
    "tartan": "hardcourt",
    "asphalt": "concrete",
    "concrete": "concrete",
    "clay": "clay",
    "compacted": "concrete",
    "paving_stones": "concrete",
    "rubber": "hardcourt",
    "synthetic": "artificial",
    "wood": "hardcourt",
    "sand": "sand",
}

# Polish display labels used when building descriptive names for unnamed pitches
SURFACE_DISPLAY: dict[str, str] = {
    "grass": "trawa naturalna",
    "artificial": "sztuczna trawa",
    "hardcourt": "tartan / asfalt",
    "clay": "mączka ceglana",
    "concrete": "beton",
    "sand": "piasek",
}


# ---------------------------------------------------------------------------
# OpenStreetMap (Overpass API)
# ---------------------------------------------------------------------------


def _build_area_query(areas: list[tuple[str, str]]) -> str:
    """Build an Overpass QL query that unions all given admin areas.

    Area declarations must be top-level statements (outside any union block).
    Each (area, leisure_type, element_type) combination is a separate entry
    inside the union block.
    """
    # Top-level area declarations
    area_decls = "\n".join(
        f'area["name"="{name}"]["admin_level"="{level}"]->.a{i};'
        for i, (name, level) in enumerate(areas)
    )
    # Union: every combination of area × element_type × leisure_type
    leisure_types = ["pitch", "sports_centre"]
    element_types = ["node", "way", "relation"]
    union_parts = "\n".join(
        f'  {el}["leisure"="{lt}"](area.a{i});'
        for i in range(len(areas))
        for lt in leisure_types
        for el in element_types
    )
    return f"""[out:json][timeout:90];
{area_decls}
(
{union_parts}
);
out center;
"""


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=15))
async def scrape_osm(areas: list[tuple[str, str]]) -> list[dict[str, Any]]:
    """Fetch team-sport pitches and sport centres from OSM for given admin areas."""
    query = _build_area_query(areas)
    log.debug("Overpass query:\n%s", query)

    async with httpx.AsyncClient(timeout=100.0) as client:
        response = await client.post(
            OVERPASS_URL,
            data={"data": query},
            headers={"User-Agent": "bojo-app-scraper/1.0 (https://github.com/fpudelko/bojo-app)"},
        )
        response.raise_for_status()
        data = response.json()

    elements: list[dict] = data.get("elements", [])
    fields = [n for el in elements if (n := normalize_osm_element(el))]
    log.info("OSM: %d elements → %d team-sport fields after filtering", len(elements), len(fields))
    return fields


def build_osm_name(tags: dict[str, str], sport_pl: str, surface_normalized: str) -> str:
    """
    Human-readable name for an OSM pitch.
    Uses explicit name tags first; falls back to descriptive name from sport + surface.
    """
    explicit = (
        tags.get("name")
        or tags.get("name:pl")
        or tags.get("official_name")
        or tags.get("operator")
    )
    if explicit:
        return explicit

    if sport_pl and sport_pl not in ("inne", "wielofunkcyjne"):
        parts = [f"Boisko — {sport_pl}"]
    else:
        parts = ["Boisko sportowe"]

    surface_label = SURFACE_DISPLAY.get(surface_normalized, "")
    if surface_label:
        parts.append(surface_label)

    return " · ".join(parts)


# Normalized operator type labels (stored in DB)
OPERATOR_TYPE_MAP: dict[str, str] = {
    "public":       "gmina / miasto",
    "government":   "gmina / miasto",
    "municipal":    "gmina / miasto",
    "community":    "stowarzyszenie",
    "ngo":          "stowarzyszenie",
    "association":  "stowarzyszenie",
    "private":      "prywatny",
    "commercial":   "prywatny",
    "company":      "prywatny",
    "educational":  "szkoła / uczelnia",
    "school":       "szkoła / uczelnia",
    "university":   "szkoła / uczelnia",
    "sports":       "klub sportowy",
    "club":         "klub sportowy",
}


def wikimedia_to_url(value: str) -> str | None:
    """Convert OSM wikimedia_commons tag (e.g. 'File:Foo.jpg') to a direct image URL."""
    if value.startswith("File:"):
        filename = value[5:].replace(" ", "_")
        return f"https://commons.wikimedia.org/wiki/Special:FilePath/{filename}?width=800"
    return None


def normalize_osm_element(element: dict[str, Any]) -> dict[str, Any] | None:
    """Convert an OSM element to our Field schema. Returns None for non-team sports."""
    tags: dict[str, str] = element.get("tags", {})

    if element.get("type") == "node":
        lat = element.get("lat")
        lng = element.get("lon")
    else:
        center = element.get("center", {})
        lat = center.get("lat")
        lng = center.get("lon")

    if lat is None or lng is None:
        return None

    # Skip individual sports (tennis, athletics, golf, etc.)
    # Pitches with no sport tag are kept — they're usually multi-purpose orliki.
    sport_raw = tags.get("sport", "").lower()
    if sport_raw and sport_raw not in TEAM_SPORTS:
        return None

    sport_pl = OSM_SPORT_MAP.get(sport_raw, "wielofunkcyjne" if not sport_raw else "inne")

    surface_raw = tags.get("surface", "").lower()
    surface = SURFACE_MAP.get(surface_raw, "")

    is_indoor = tags.get("indoor", "no").lower() in ("yes", "true", "1") or bool(tags.get("building"))

    suburb = tags.get("addr:suburb") or tags.get("addr:quarter") or tags.get("addr:neighbourhood") or ""
    address_parts = [
        tags.get("addr:street", ""),
        tags.get("addr:housenumber", ""),
        suburb,
        tags.get("addr:city", ""),
    ]
    address = ", ".join(p for p in address_parts if p).strip() or "Poznań"
    postcode = tags.get("addr:postcode")

    # Operator / manager info
    operator = (
        tags.get("operator")
        or tags.get("name:operator")
        or tags.get("brand")
    )
    op_type_raw = (tags.get("operator:type") or "").lower().strip()
    # Also infer from amenity / leisure tags
    if not op_type_raw:
        amenity = tags.get("amenity", "").lower()
        if amenity in ("school", "college", "university"):
            op_type_raw = "educational"
    operator_type = OPERATOR_TYPE_MAP.get(op_type_raw) if op_type_raw else None

    # Image URL — prefer direct tag, fall back to wikimedia_commons
    image_url = tags.get("image") or None
    if not image_url:
        wmc = tags.get("wikimedia_commons") or tags.get("image:wikimedia")
        if wmc:
            image_url = wikimedia_to_url(wmc)

    def yes_no(tag: str) -> bool | None:
        v = tags.get(tag, "").lower()
        if v in ("yes", "true", "1"): return True
        if v in ("no", "false", "0"): return False
        return None

    capacity_raw = tags.get("capacity")
    try:
        capacity = int(capacity_raw) if capacity_raw else None
    except ValueError:
        capacity = None

    return {
        "name": build_osm_name(tags, sport_pl, surface),
        "address": address,
        "lat": float(lat),
        "lng": float(lng),
        "sport": [sport_pl],
        "available": True,
        "surface": surface,
        "is_indoor": is_indoor,
        "phone": tags.get("contact:phone") or tags.get("phone"),
        "website": tags.get("website") or tags.get("contact:website"),
        "operator": operator,
        "operator_type": operator_type,
        "email": tags.get("contact:email") or tags.get("email"),
        "description": tags.get("description") or tags.get("description:pl"),
        "image_url": image_url,
        "opening_hours": tags.get("opening_hours"),
        "postcode": postcode,
        "lit": yes_no("lit"),
        "access": tags.get("access") or None,
        "fee": yes_no("fee"),
        "has_changing_rooms": yes_no("changing_rooms"),
        "has_shower": yes_no("shower"),
        "has_toilets": yes_no("toilets"),
        "capacity": capacity,
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
    """Fetch sports fields from Google Places Text Search (up to 60 results per query)."""
    params = {"query": query, "location": location, "radius": radius, "key": api_key, "language": "pl"}
    all_results: list[dict] = []

    async with httpx.AsyncClient(timeout=20.0) as client:
        while True:
            response = await client.get(GOOGLE_PLACES_URL, params=params)
            response.raise_for_status()
            data = response.json()

            status = data.get("status")
            if status not in ("OK", "ZERO_RESULTS"):
                log.warning("Google Places status=%s for query=%r", status, query)
                break

            all_results.extend(data.get("results", []))
            next_token = data.get("next_page_token")
            if not next_token or len(all_results) >= 60:
                break

            await asyncio.sleep(2)
            params = {"pagetoken": next_token, "key": api_key}

    return [f for f in (normalize_google_place(r) for r in all_results) if f]


def normalize_google_place(place: dict[str, Any]) -> dict[str, Any] | None:
    geometry = place.get("geometry", {}).get("location", {})
    lat, lng = geometry.get("lat"), geometry.get("lng")
    if lat is None or lng is None:
        return None

    place_id = place.get("place_id", "")
    if not place_id:
        return None

    name = place.get("name", "")
    address = place.get("formatted_address", place.get("vicinity", "Poznań"))
    name_lower = name.lower()

    sport: list[str] = []
    if any(kw in name_lower for kw in ("piłk", "futsal", "soccer", "football", "orlik")):
        sport.append("piłka nożna")
    if any(kw in name_lower for kw in ("koszykówka", "basketball", "basket")):
        sport.append("koszykówka")
    if any(kw in name_lower for kw in ("siatkówka plażowa", "beach volley")):
        sport.append("siatkówka plażowa")
    elif any(kw in name_lower for kw in ("siatkówka", "volleyball")):
        sport.append("siatkówka")
    if any(kw in name_lower for kw in ("piłka ręczna", "handball")):
        sport.append("piłka ręczna")
    if not sport:
        sport = ["wielofunkcyjne"]

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


def deduplicate(fields: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for f in fields:
        key = f.get("external_id", "")
        if key and key not in seen:
            seen.add(key)
            out.append(f)
    return out


async def upsert_fields(fields: list[dict[str, Any]], supabase_url: str, service_key: str) -> None:
    if not fields:
        log.info("No fields to upsert.")
        return

    # Use UPSERT on (source, external_id) — safer than DELETE+INSERT:
    # • preserves manager_id, is_bookable, booking_type set by venue owners
    # • preserves linked events / games / bookings (no FK cascade)
    # • idempotent: re-runs just update scraped columns in-place
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    endpoint = f"{supabase_url}/rest/v1/fields?on_conflict=source,external_id"

    BATCH = 100
    total = 0
    async with httpx.AsyncClient(timeout=30.0) as client:
        for i in range(0, len(fields), BATCH):
            batch = fields[i : i + BATCH]
            r = await client.post(endpoint, json=batch, headers=headers)
            if r.status_code in (200, 201):
                total += len(batch)
                log.info("Upserted batch %d (%d fields)", i // BATCH + 1, len(batch))
            else:
                log.error("Upsert error batch %d: %s — %s", i // BATCH + 1, r.status_code, r.text[:300])

    log.info("Total upserted: %d fields", total)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


async def main() -> None:
    load_dotenv()

    api_key = os.getenv("GOOGLE_PLACES_API_KEY", "")
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    log.info("Scraping OSM areas=%s …", OSM_AREAS)
    try:
        osm_fields = await scrape_osm(OSM_AREAS)
        log.info("OSM: %d team-sport fields", len(osm_fields))
    except Exception as exc:
        log.error("OSM scrape failed: %s", exc)
        osm_fields = []

    google_fields: list[dict[str, Any]] = []
    if api_key:
        log.info("Scraping Google Places (%d queries)…", len(SPORT_QUERIES))
        for q in SPORT_QUERIES:
            try:
                results = await scrape_google_places(q, POZNAN_CENTER, api_key)
                log.info("  %r → %d results", q, len(results))
                google_fields.extend(results)
            except Exception as exc:
                log.error("Google Places %r failed: %s", q, exc)
    else:
        log.warning("GOOGLE_PLACES_API_KEY not set — skipping Google Places.")

    all_fields = deduplicate(osm_fields + google_fields)
    log.info("Grand total: %d fields to upsert", len(all_fields))

    if not all_fields:
        log.warning("Nothing to upsert.")
        return

    if supabase_url and service_key:
        await upsert_fields(all_fields, supabase_url, service_key)
        log.info("Done.")
    else:
        log.warning("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — dry run.")
        for f in all_fields[:20]:
            log.info("  [%s] %s @ %.5f, %.5f sport=%s", f["source"], f["name"], f["lat"], f["lng"], f["sport"])


if __name__ == "__main__":
    asyncio.run(main())
