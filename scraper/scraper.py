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

POZNAN_BBOX = (52.25, 16.60, 52.60, 17.20)  # south, west, north, east
POZNAN_CENTER = "52.4064,16.9252"

OVERPASS_URLS = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
]

GOOGLE_PLACES_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"

SPORT_QUERIES = [
    "boisko piłka nożna Poznań",
    "kort tenisowy Poznań",
    "boisko koszykówka Poznań",
    "siłownia zewnętrzna Poznań",
    "boisko siatkówka Poznań",
]

OSM_SPORT_MAP = {
    "soccer": "piłka nożna",
    "football": "piłka nożna",
    "basketball": "koszykówka",
    "volleyball": "siatkówka",
    "tennis": "tenis",
    "futsal": "futsal",
    "multi": "wielofunkcyjne",
}

SURFACE_MAP = {
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
}


def split_bbox(
    bbox: tuple[float, float, float, float],
    rows: int = 2,
    cols: int = 2,
) -> list[tuple[float, float, float, float]]:
    south, west, north, east = bbox
    lat_step = (north - south) / rows
    lng_step = (east - west) / cols

    boxes = []
    for r in range(rows):
        for c in range(cols):
            s = south + r * lat_step
            n = south + (r + 1) * lat_step
            w = west + c * lng_step
            e = west + (c + 1) * lng_step
            boxes.append((s, w, n, e))

    return boxes


def build_overpass_query(bbox: tuple[float, float, float, float]) -> str:
    south, west, north, east = bbox

    return f"""
[out:json][timeout:25];
(
  node["leisure"="pitch"]({south},{west},{north},{east});
  way["leisure"="pitch"]({south},{west},{north},{east});
  node["sport"]({south},{west},{north},{east});
  way["sport"]({south},{west},{north},{east});
);
out center tags;
"""


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=8))
async def fetch_overpass(
    client: httpx.AsyncClient,
    url: str,
    query: str,
) -> dict[str, Any]:
    response = await client.post(
        url,
        data={"data": query},
        headers={
            "User-Agent": "sport-events-mvp/0.1 contact:your-email@example.com",
            "Accept": "application/json",
        },
    )

    if response.status_code != 200:
        log.error(
            "Overpass error %s from %s: %s",
            response.status_code,
            url,
            response.text[:1000],
        )

    response.raise_for_status()
    return response.json()


async def scrape_osm(bbox: tuple[float, float, float, float]) -> list[dict[str, Any]]:
    boxes = split_bbox(bbox, rows=2, cols=2)
    all_fields: list[dict[str, Any]] = []

    async with httpx.AsyncClient(timeout=45.0) as client:
        for small_bbox in boxes:
            query = build_overpass_query(small_bbox)

            data = None
            for url in OVERPASS_URLS:
                try:
                    log.info("Trying Overpass: %s bbox=%s", url, small_bbox)
                    data = await fetch_overpass(client, url, query)
                    break
                except Exception as exc:
                    log.warning("Overpass failed on %s: %s", url, exc)

            if data is None:
                log.error("All Overpass endpoints failed for bbox=%s", small_bbox)
                continue

            elements = data.get("elements", [])
            log.info("Found %d raw OSM elements in bbox=%s", len(elements), small_bbox)

            for el in elements:
                normalized = normalize_osm_element(el)
                if normalized:
                    all_fields.append(normalized)

    return deduplicate_fields(all_fields)


def normalize_osm_element(element: dict[str, Any]) -> dict[str, Any] | None:
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

    sport_raw = tags.get("sport", "").lower()

    # Odrzucamy rzeczy ewidentnie niesportowe lub zbyt ogólne.
    if not sport_raw and tags.get("leisure") != "pitch":
        return None

    name = (
        tags.get("name")
        or tags.get("name:pl")
        or tags.get("operator")
        or tags.get("ref")
        or f"Boisko OSM #{element.get('id', '')}"
    )

    sport_pl = OSM_SPORT_MAP.get(sport_raw, "inne")

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


def deduplicate_fields(fields: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen = set()
    result = []

    for field in fields:
        key = field.get("external_id")
        if key in seen:
            continue

        seen.add(key)
        result.append(field)

    return result


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=8))
async def scrape_google_places(
    query: str,
    location: str,
    api_key: str,
    radius: int = 15000,
) -> list[dict[str, Any]]:
    params = {
        "query": query,
        "location": location,
        "radius": radius,
        "key": api_key,
        "language": "pl",
    }

    all_results: list[dict[str, Any]] = []

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
    lat = geometry.get("lat")
    lng = geometry.get("lng")

    if lat is None or lng is None:
        return None

    name = place.get("name", "")
    address = place.get("formatted_address", place.get("vicinity", "Poznań"))
    place_id = place.get("place_id", "")

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

    is_indoor = any(
        kw in name_lower
        for kw in ("hala", "sala", "indoor", "kryty", "kryta")
    )

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


async def upsert_fields(
    fields: list[dict[str, Any]],
    supabase_url: str,
    service_key: str,
) -> None:
    if not fields:
        log.info("No fields to upsert.")
        return

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }
    endpoint = f"{supabase_url}/rest/v1/fields"

    sources = sorted({f.get("source") for f in fields if f.get("source")})

    async with httpx.AsyncClient(timeout=30.0) as client:
        for source in sources:
            del_resp = await client.delete(
                f"{endpoint}?source=eq.{source}",
                headers={**headers, "Prefer": "return=minimal"},
            )

            if del_resp.status_code not in (200, 204):
                log.warning(
                    "Delete source=%s returned %s: %s",
                    source,
                    del_resp.status_code,
                    del_resp.text[:300],
                )
            else:
                log.info("Cleared existing rows for source=%s", source)

    batch_size = 100
    total_upserted = 0

    async with httpx.AsyncClient(timeout=30.0) as client:
        for i in range(0, len(fields), batch_size):
            batch = fields[i : i + batch_size]

            response = await client.post(
                endpoint,
                json=batch,
                headers={**headers, "Prefer": "return=minimal"},
            )

            if response.status_code not in (200, 201):
                log.error(
                    "Supabase insert error batch %d: %s — %s",
                    i // batch_size + 1,
                    response.status_code,
                    response.text[:500],
                )
            else:
                total_upserted += len(batch)
                log.info("Inserted batch %d (%d fields)", i // batch_size + 1, len(batch))

    log.info("Total inserted: %d fields", total_upserted)


async def main() -> None:
    load_dotenv()

    api_key = os.getenv("GOOGLE_PLACES_API_KEY", "")
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    log.info("Scraping OpenStreetMap bbox=%s...", POZNAN_BBOX)

    try:
        osm_fields = await scrape_osm(POZNAN_BBOX)
        log.info("Found %d normalized fields from OSM", len(osm_fields))
    except Exception as exc:
        log.error("OSM scrape failed completely: %s", exc)
        osm_fields = []

    google_fields: list[dict[str, Any]] = []

    if api_key:
        log.info("Scraping Google Places...")
        for sport_query in SPORT_QUERIES:
            try:
                results = await scrape_google_places(
                    sport_query,
                    POZNAN_CENTER,
                    api_key,
                )
                log.info("Google query %r -> %d results", sport_query, len(results))
                google_fields.extend(results)
            except Exception as exc:
                log.error("Google Places query failed %r: %s", sport_query, exc)
    else:
        log.warning("GOOGLE_PLACES_API_KEY not set — skipping Google Places.")

    all_fields = deduplicate_fields(osm_fields + google_fields)

    log.info("Grand total: %d fields to upsert", len(all_fields))

    if not all_fields:
        log.warning("Nothing to upsert.")
        return

    if supabase_url and service_key:
        await upsert_fields(all_fields, supabase_url, service_key)
        log.info("Done.")
    else:
        log.warning("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.")
        log.info("Printing first 20 results:")

        for field in all_fields[:20]:
            log.info(
                "- [%s] %s @ %.5f, %.5f sport=%s",
                field["source"],
                field["name"],
                field["lat"],
                field["lng"],
                field["sport"],
            )


if __name__ == "__main__":
    asyncio.run(main())
