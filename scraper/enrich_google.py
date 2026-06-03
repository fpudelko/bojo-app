"""
Boiska Poznań — Google Places Enrichment (free within credit)
=============================================================
Fills phone / website / opening_hours on EXISTING venues using the Google
Places API (Find Place + Place Details). Free within Google's $200/month credit
(~11k Place Details calls).

Run this BEFORE the Claude enrichment (enrich.py): Google reliably gives phone,
website and hours for free, leaving Claude to find only what Google can't —
e-mail and the reservation method — which makes the paid step cheaper.

Venues at the same address are batched into one Google lookup.

Usage:
    pip install httpx python-dotenv
    export GOOGLE_PLACES_API_KEY=AIza...
    export SUPABASE_URL=https://xxxx.supabase.co
    export SUPABASE_SERVICE_ROLE_KEY=eyJ...

    python enrich_google.py --limit 5 --dry-run   # preview, no writes
    python enrich_google.py --limit 50            # enrich 50 address groups
    python enrich_google.py                        # all venues missing phone/www

Flags:
    --limit N        process at most N address groups (0 = all)
    --dry-run        print findings, write nothing
    --require-all    only venues missing phone AND website (default: missing
                     either phone OR website)
    --concurrency N  parallel requests (default 5)
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
from typing import Any

import httpx
from dotenv import load_dotenv

from enrich import group_by_address, _sb_headers  # reuse helpers

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("enrich-google")

FIND_URL = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"
DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"
DETAIL_FIELDS = "formatted_phone_number,international_phone_number,website,opening_hours"


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
        # require_all: only venues missing BOTH (fewer); default: missing EITHER
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
# Google Places
# ---------------------------------------------------------------------------

async def lookup_group(
    client: httpx.AsyncClient, api_key: str, fields: list[dict[str, Any]],
) -> dict[str, Any] | None:
    """Find the place by name+address, then fetch contact details."""
    first = fields[0]
    name = first.get("name") or ""
    address = first.get("address") or ""
    query = f"{name} {address}".strip()
    if not query:
        return None

    find_params = {
        "input": query,
        "inputtype": "textquery",
        "fields": "place_id",
        "key": api_key,
        "language": "pl",
    }
    lat, lng = first.get("lat"), first.get("lng")
    if lat is not None and lng is not None:
        find_params["locationbias"] = f"point:{lat},{lng}"

    rf = await client.get(FIND_URL, params=find_params, timeout=20.0)
    rf.raise_for_status()
    fdata = rf.json()
    candidates = fdata.get("candidates") or []
    if fdata.get("status") not in ("OK",) or not candidates:
        return None
    place_id = candidates[0].get("place_id")
    if not place_id:
        return None

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
        groups = group_by_address(candidates)
        if args.limit:
            groups = groups[: args.limit]

        total_fields = sum(len(g) for g in groups)
        log.info("%d address groups (%d fields)%s", len(groups), total_fields,
                 " · DRY RUN" if args.dry_run else "")
        if not groups:
            log.info("Nothing to do."); return

        sem = asyncio.Semaphore(args.concurrency)
        totals = {"matched": 0, "patched_fields": 0, "details_calls": 0}

        async def worker(grp: list[dict[str, Any]]) -> None:
            address = grp[0].get("address") or "?"
            async with sem:
                try:
                    found = await lookup_group(client, api_key, grp)
                except Exception as exc:  # noqa: BLE001
                    log.warning("✗ [%d] %s — %s", len(grp), address[:50], exc)
                    return
                totals["details_calls"] += 1
                if not found:
                    log.info("· [%d] %s — brak dopasowania w Google", len(grp), address[:50])
                    return
                got = [c for c in ("phone", "website", "opening_hours") if found.get(c)]
                totals["matched"] += 1
                log.info("✓ [%d] %s | %s%s%s",
                         len(grp), address[:50],
                         f"tel={found['phone']} " if found.get("phone") else "",
                         f"www={found['website'][:40]} " if found.get("website") else "",
                         "godziny " if found.get("opening_hours") else "")
                if not args.dry_run:
                    totals["patched_fields"] += await write_back_group(client, base, key, grp, found)

        await asyncio.gather(*(worker(g) for g in groups))

        # Find Place + Details ≈ $17/1000 each → ~$34/1000 groups, free within $200/mo credit.
        cost = totals["details_calls"] / 1000 * 34
        log.info("─" * 60)
        log.info("Dopasowano %d/%d grup · zapisano dane w %d obiektach",
                 totals["matched"], len(groups), totals["patched_fields"])
        log.info("Zapytań Google: %d (~$%.2f, w ramach darmowego limitu $200/mc)",
                 totals["details_calls"], cost)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Google Places enrichment (free within credit)")
    p.add_argument("--limit", type=int, default=0, help="max address groups (0 = all)")
    p.add_argument("--dry-run", action="store_true", help="print findings, write nothing")
    p.add_argument("--require-all", action="store_true",
                   help="only venues missing phone AND website (default: either)")
    p.add_argument("--concurrency", type=int, default=5)
    return p.parse_args()


if __name__ == "__main__":
    asyncio.run(run(parse_args()))
