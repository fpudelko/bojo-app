"""
Boiska Poznań — Fix GPS Coordinates (Forward Geocoding)
========================================================
Finds venues where stored lat/lng is wrong by forward-geocoding
their address via Nominatim. Updates coordinates when the discrepancy
exceeds a configurable threshold.

Usage:
    python fix_coords.py --dry-run              # show mismatches, no writes
    python fix_coords.py --threshold 0.5        # flag when >500 m off
    python fix_coords.py --source manual        # only manually-entered venues
    python fix_coords.py --limit 20             # first 20 venues
    python fix_coords.py                         # fix all mismatches (default 1 km)
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import math
import os
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("fix-coords")

NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search"
USER_AGENT       = "bojo-app-venue-enricher/1.0 (contact: admin@bojo.app)"
RATE_DELAY       = 1.1   # Nominatim policy: max 1 req/sec
DEFAULT_THRESHOLD_KM = 1.0


# ---------------------------------------------------------------------------
# Maths
# ---------------------------------------------------------------------------

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (math.sin(d_lat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(d_lon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ---------------------------------------------------------------------------
# Nominatim forward geocoding
# ---------------------------------------------------------------------------

async def forward_geocode(
    client: httpx.AsyncClient, address: str
) -> tuple[float, float] | None:
    """Return (lat, lon) for an address, or None."""
    query = address if "polska" in address.lower() else address + ", Polska"
    r = await client.get(
        NOMINATIM_SEARCH,
        params={"q": query, "format": "json", "limit": 1, "countrycodes": "pl"},
    )
    if r.status_code != 200:
        log.warning("Nominatim HTTP %s for: %s", r.status_code, address)
        return None
    data = r.json()
    if not data:
        log.warning("No result for: %s", address)
        return None
    return round(float(data[0]["lat"]), 5), round(float(data[0]["lon"]), 5)


# ---------------------------------------------------------------------------
# Supabase
# ---------------------------------------------------------------------------

def _sb_headers(key: str, extra: dict[str, str] | None = None) -> dict[str, str]:
    h = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    if extra:
        h.update(extra)
    return h


async def fetch_venues(
    client: httpx.AsyncClient, base: str, key: str,
    source: str | None, limit: int,
) -> list[dict[str, Any]]:
    params: dict[str, str] = {
        "select": "id,name,address,lat,lng,source",
        "address": "not.is.null",
        "lat": "not.is.null",
        "lng": "not.is.null",
        "limit": str(limit) if limit else "10000",
        "order": "name.asc",
    }
    if source:
        params["source"] = f"eq.{source}"
    r = await client.get(f"{base}/rest/v1/fields", headers=_sb_headers(key), params=params)
    r.raise_for_status()
    return r.json()


async def patch_coords(
    client: httpx.AsyncClient, base: str, key: str,
    field_id: str, lat: float, lng: float,
) -> bool:
    r = await client.patch(
        f"{base}/rest/v1/fields",
        headers=_sb_headers(key, {"Prefer": "return=minimal"}),
        params={"id": f"eq.{field_id}"},
        json={"lat": lat, "lng": lng},
    )
    return r.status_code in (200, 204)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def run(args: argparse.Namespace) -> None:
    base = os.environ["SUPABASE_URL"].rstrip("/")
    key  = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    async with httpx.AsyncClient(
        headers={"User-Agent": USER_AGENT}, timeout=30
    ) as client:
        venues = await fetch_venues(client, base, key, args.source, args.limit)
        log.info("Loaded %d venues with address + coordinates", len(venues))

        fixed = skipped = errors = 0

        for v in venues:
            addr  = v["address"]
            c_lat = float(v["lat"])
            c_lng = float(v["lng"])

            await asyncio.sleep(RATE_DELAY)
            result = await forward_geocode(client, addr)

            if not result:
                errors += 1
                continue

            n_lat, n_lng = result
            dist = haversine_km(c_lat, c_lng, n_lat, n_lng)

            if dist < args.threshold:
                skipped += 1
                log.debug("OK  %.3f km  %s", dist, v.get("name"))
                continue

            name = v.get("name", v["id"])
            log.info(
                "MISMATCH  %.2f km  %s\n"
                "          stored  : %.5f, %.5f\n"
                "          geocoded: %.5f, %.5f",
                dist, name, c_lat, c_lng, n_lat, n_lng,
            )

            if args.dry_run:
                fixed += 1
                continue

            ok = await patch_coords(client, base, key, v["id"], n_lat, n_lng)
            if ok:
                fixed += 1
                log.info("  ✓ Updated %s", name)
            else:
                errors += 1
                log.error("  ✗ Failed  %s", name)

        verb = "Would fix" if args.dry_run else "Fixed"
        log.info("Done — %s: %d | OK: %d | Errors: %d", verb, fixed, skipped, errors)


def main() -> None:
    p = argparse.ArgumentParser(description="Forward-geocode venue addresses and fix wrong lat/lng.")
    p.add_argument("--dry-run",   action="store_true", help="Print mismatches without writing")
    p.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD_KM,
                   help="Distance in km to trigger update (default: 1.0)")
    p.add_argument("--source",    help="Only venues with this source value (e.g. manual, osm)")
    p.add_argument("--limit",     type=int, default=0,
                   help="Max venues to process (0 = all)")
    asyncio.run(run(p.parse_args()))


if __name__ == "__main__":
    main()
