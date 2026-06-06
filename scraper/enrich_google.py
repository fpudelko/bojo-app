"""
Boiska Poznań — Google Places Enrichment (free within credit)
=============================================================
Fills phone / website / opening_hours on EXISTING venues using the Google
Places API (Nearby Search + Place Details). Free within Google's $200/month
credit (~11k Place Details calls).

OSM data often has generic names ("Boisko sportowe") and incomplete addresses,
so we use the venue's precise coordinates for discovery instead of name/address.
Venues at the same map location are batched into one Google lookup.

Run this BEFORE the Claude enrichment (enrich.py): Google reliably gives phone,
website and hours for free, leaving Claude to find only e-mail and the booking
method — making the paid step cheaper.

Usage:
    pip install httpx python-dotenv
    export GOOGLE_PLACES_API_KEY=AIza...
    export SUPABASE_URL=https://xxxx.supabase.co
    export SUPABASE_SERVICE_ROLE_KEY=eyJ...

    python enrich_google.py --limit 5 --dry-run   # preview, no writes
    python enrich_google.py --limit 50            # enrich 50 location groups
    python enrich_google.py                        # all venues missing phone/www

Flags:
    --limit N        process at most N location groups (0 = all)
    --dry-run        print findings, write nothing
    --require-all    only venues missing phone AND website (default: missing
                     either phone OR website)
    --concurrency N  parallel requests (default 5)
    --radius N       search radius in metres around each venue (default 200)
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
from typing import Any

import httpx
from dotenv import load_dotenv

from enrich import _sb_headers  # reuse Supabase helper

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("enrich-google")

NEARBY_URL  = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
TEXT_URL    = "https://maps.googleapis.com/maps/api/place/textsearch/json"
DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"
DETAIL_FIELDS = "formatted_phone_number,international_phone_number,website,opening_hours"

# Grid cell size for location-based grouping.
# 3 decimal places ≈ 111m; venues that close together share one API call.
LOC_PRECISION = 3

# Google Places types tried in order for the Nearby fallback.
# 'stadium' covers sports halls; 'park' covers outdoor fields/orliki.
_NEARBY_TYPES = ("stadium", "park", "gym")

# Generic OSM names that are useless for Text Search — fall back to Nearby only.
import re as _re
_GENERIC = _re.compile(
    r'^(boisko|boiska|orlik|kort|hala\s+sport|sala\s+gimn|'
    r'kompleks\s+sport|obiekt\s+sport|boisko\s+[—\-])',
    _re.I,
)


# ---------------------------------------------------------------------------
# Location-based grouping (replaces address grouping for coordinate-rich OSM data)
# ---------------------------------------------------------------------------

def group_by_location(fields: list[dict[str, Any]], precision: int = LOC_PRECISION) -> list[list[dict[str, Any]]]:
    """Group venues by rounded lat/lng so co-located pitches share one lookup."""
    buckets: dict[tuple, list[dict[str, Any]]] = {}
    for f in fields:
        lat = f.get("lat")
        lng = f.get("lng")
        if lat is not None and lng is not None:
            key: tuple = (round(float(lat), precision), round(float(lng), precision))
        else:
            # No coordinates — use a unique key so it is processed individually
            key = ("noloc", f.get("id", ""))
        buckets.setdefault(key, []).append(f)
    groups = list(buckets.values())
    # Largest co-location clusters first, then by lat
    groups.sort(key=lambda g: (-len(g), g[0].get("lat") or 0))
    return groups


# ---------------------------------------------------------------------------
# Supabase
# ---------------------------------------------------------------------------

async def fetch_candidates(
    client: httpx.AsyncClient, base: str, key: str, *, require_all: bool,
) -> list[dict[str, Any]]:
    r = await client.get(
        f"{base}/rest/v1/fields",
        headers=_sb_headers(key),
        params={"select": "id,name,address,lat,lng,phone,website,opening_hours", "limit": "10000"},
    )
    r.raise_for_status()
    fields = r.json()
    out = []
    for f in fields:
        has_phone = bool(f.get("phone"))
        has_web = bool(f.get("website"))
        missing = (not has_phone and not has_web) if require_all else (not has_phone or not has_web)
        if missing:
            out.append(f)
    return out


async def write_back_group(
    client: httpx.AsyncClient, base: str, key: str,
    fields: list[dict[str, Any]], found: dict[str, Any],
) -> int:
    """Fill-if-empty on every field in the group. Returns # of fields patched."""
    patched = 0
    for f in fields:
        patch: dict[str, Any] = {}
        for col in ("phone", "website", "opening_hours"):
            val = found.get(col)
            if val and not f.get(col):
                patch[col] = val
        if not patch:
            continue
        rp = await client.patch(
            f"{base}/rest/v1/fields",
            headers=_sb_headers(key, {"Prefer": "return=minimal"}),
            params={"id": f"eq.{f['id']}"},
            json=patch,
        )
        if rp.status_code in (200, 204):
            patched += 1
        else:
            log.error("  patch %s failed %s: %s", f.get("name"), rp.status_code, rp.text[:150])
    return patched


# ---------------------------------------------------------------------------
# Google Places — Nearby Search + Place Details
# ---------------------------------------------------------------------------

async def _place_details(
    client: httpx.AsyncClient, api_key: str, place_id: str,
) -> dict[str, Any] | None:
    rd = await client.get(
        DETAILS_URL,
        params={"place_id": place_id, "fields": DETAIL_FIELDS, "key": api_key, "language": "pl"},
        timeout=20.0,
    )
    rd.raise_for_status()
    ddata = rd.json()
    if ddata.get("status") != "OK":
        return None
    res = ddata.get("result", {})
    hours = res.get("opening_hours", {}).get("weekday_text")
    return {
        "phone": res.get("formatted_phone_number") or res.get("international_phone_number"),
        "website": res.get("website"),
        "opening_hours": "\n".join(hours) if hours else None,
    }


async def lookup_group(
    client: httpx.AsyncClient, api_key: str,
    fields: list[dict[str, Any]], radius: int,
) -> dict[str, Any] | None:
    """Find the closest sports venue within `radius` metres of the group's coordinates."""
    first = fields[0]
    lat, lng = first.get("lat"), first.get("lng")
    if lat is None or lng is None:
        return None

    loc_str = f"{lat},{lng}"
    name = first.get("name", "")
    address = first.get("address", "")

    # ── Step 1: Text Search for non-generic named venues ──────────────────────
    if name and not _GENERIC.match(name):
        query = f"{name}, {address}" if address else name
        rt = await client.get(
            TEXT_URL,
            params={
                "query": query,
                "location": loc_str,
                "radius": radius * 5,   # bias, not hard filter
                "key": api_key,
                "language": "pl",
            },
            timeout=20.0,
        )
        rt.raise_for_status()
        tdata = rt.json()
        if tdata.get("status") == "OK":
            results = tdata.get("results") or []
            if results:
                place_id = results[0].get("place_id")
                if place_id:
                    return await _place_details(client, api_key, place_id)

    # ── Step 2: Nearby Search — try each type in sequence ─────────────────────
    for ptype in _NEARBY_TYPES:
        rn = await client.get(
            NEARBY_URL,
            params={
                "location": loc_str,
                "radius": radius,
                "type": ptype,
                "key": api_key,
                "language": "pl",
            },
            timeout=20.0,
        )
        rn.raise_for_status()
        ndata = rn.json()
        results = ndata.get("results") or []
        if ndata.get("status") == "OK" and results:
            place_id = results[0].get("place_id")
            if place_id:
                return await _place_details(client, api_key, place_id)

    return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def run(args: argparse.Namespace) -> None:
    load_dotenv()
    api_key = os.getenv("GOOGLE_PLACES_API_KEY", "")
    base = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    if not api_key:
        log.error("GOOGLE_PLACES_API_KEY not set."); return
    if not (base and key):
        log.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set."); return

    async with httpx.AsyncClient() as client:
        candidates = await fetch_candidates(client, base, key, require_all=args.require_all)
        groups = group_by_location(candidates)
        if args.limit:
            groups = groups[: args.limit]

        total_fields = sum(len(g) for g in groups)
        log.info("%d location groups (%d fields), radius=%dm%s",
                 len(groups), total_fields, args.radius,
                 " · DRY RUN" if args.dry_run else "")
        if not groups:
            log.info("Nothing to do."); return

        sem = asyncio.Semaphore(args.concurrency)
        totals = {"matched": 0, "patched_fields": 0, "details_calls": 0}

        async def worker(grp: list[dict[str, Any]]) -> None:
            first = grp[0]
            loc = f"{first.get('lat'):.5f},{first.get('lng'):.5f}" if first.get("lat") else "?"
            async with sem:
                try:
                    found = await lookup_group(client, api_key, grp, args.radius)
                except Exception as exc:  # noqa: BLE001
                    log.warning("✗ [%d] %s — %s", len(grp), loc, exc)
                    return
                totals["details_calls"] += 1
                if not found or not any(found.values()):
                    log.info("· [%d] %s — brak wyników w promieniu %dm", len(grp), loc, args.radius)
                    return
                got = [c for c in ("phone", "website", "opening_hours") if found.get(c)]
                totals["matched"] += 1
                log.info("✓ [%d] %s | %s%s%s",
                         len(grp), loc,
                         f"tel={found['phone']} " if found.get("phone") else "",
                         f"www={found['website'][:40]} " if found.get("website") else "",
                         "godziny " if found.get("opening_hours") else "")
                if not args.dry_run:
                    totals["patched_fields"] += await write_back_group(client, base, key, grp, found)

        await asyncio.gather(*(worker(g) for g in groups))

        # Nearby Search ≈ $32/1000 + Details $17/1000 ≈ $49/1000 groups, free in $200/mo credit
        cost = totals["details_calls"] / 1000 * 49
        log.info("─" * 60)
        log.info("Dopasowano %d/%d grup · zapisano dane w %d obiektach",
                 totals["matched"], len(groups), totals["patched_fields"])
        log.info("Zapytań Google: %d (~$%.2f, w ramach darmowego limitu $200/mc)",
                 totals["details_calls"], cost)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Google Places enrichment (free within credit)")
    p.add_argument("--limit", type=int, default=0, help="max location groups (0 = all)")
    p.add_argument("--dry-run", action="store_true", help="print findings, write nothing")
    p.add_argument("--require-all", action="store_true",
                   help="only venues missing phone AND website (default: either)")
    p.add_argument("--concurrency", type=int, default=5)
    p.add_argument("--radius", type=int, default=200, help="search radius in metres (default 200)")
    return p.parse_args()


if __name__ == "__main__":
    asyncio.run(run(parse_args()))
