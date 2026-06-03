"""
Boiska Poznań — Website Booking Extractor
==========================================
For venues that already have a website URL, fetches the HTML and asks Claude
(NO web search — cheapest option, ~$0.005/venue) to detect the reservation
system and extract the booking URL.

Run AFTER enrich.py — it may have found websites for venues that had none.

Pipeline:
    scraper.py          → import venues (OSM + Google, with geo dedup)
    enrich_google.py    → phone/website from Google Nearby Search
    enrich.py           → Claude web search → phone/email/website/operator
    enrich_booking.py   → Claude reads HTML → booking_system + booking_url  ← this

Results go to field_outreach: booking_system, booking_url, booking_provider.
Never overwrites an already-set booking_system (unless --all is passed).

Usage:
    pip install httpx python-dotenv
    export ANTHROPIC_API_KEY=sk-ant-...
    export SUPABASE_URL=https://xxxx.supabase.co
    export SUPABASE_SERVICE_ROLE_KEY=eyJ...

    python enrich_booking.py --limit 5 --dry-run
    python enrich_booking.py --limit 50
    python enrich_booking.py            # all venues with website + unknown booking

Flags:
    --limit N       process at most N venues (0 = all)
    --dry-run       print results, write nothing
    --all           re-process venues that already have booking_system set
    --concurrency N parallel requests (default 4)
    --model ID      Claude model (default: env ANTHROPIC_MODEL or haiku 4.5)
    --fetch-timeout S  HTTP timeout for fetching website HTML (default 12)
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any

import httpx
from dotenv import load_dotenv

from enrich import _sb_headers  # reuse Supabase helper

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("enrich-booking")

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
DEFAULT_MODEL = "claude-haiku-4-5-20251001"

# Known external booking platforms — detected by domain in href/text
KNOWN_PLATFORMS: dict[str, str] = {
    "hally.pl":         "Hally",
    "booksy.com":       "Booksy",
    "calendly.com":     "Calendly",
    "rezerwuj.pl":      "Rezerwuj.pl",
    "planyo.com":       "Planyo",
    "sportbooking":     "SportBooking",
    "imsport.pl":       "iMSport",
    "aktivist.pl":      "Aktivist",
    "sport.miejski.pl": "Sport Miejski",
    "biletyna.pl":      "Biletyna",
}

BOOKING_RECORD_TOOL = {
    "name": "record_booking",
    "description": (
        "Record the reservation/booking system found on this sports venue's website. "
        "Only fill fields you actually found — use null when unknown."
    ),
    "input_schema": {
        "type": "object",
        "required": ["booking_system"],
        "properties": {
            "booking_system": {
                "type": "string",
                "enum": ["telefon", "email", "wlasny_system", "zewnetrzny", "brak", "nieznany"],
                "description": (
                    "'wlasny_system' — own online booking form/calendar on their site; "
                    "'zewnetrzny' — external platform (Hally, Booksy, Calendly, etc.); "
                    "'telefon' — phone reservations only; "
                    "'email' — email reservations; "
                    "'brak' — no reservations needed / free access; "
                    "'nieznany' — cannot determine from the page"
                ),
            },
            "booking_url": {
                "type": ["string", "null"],
                "description": "Direct URL to reservation form, calendar or external platform page.",
            },
            "booking_provider": {
                "type": ["string", "null"],
                "description": "Name of external platform if applicable (e.g. 'Hally', 'Booksy').",
            },
            "notes": {
                "type": ["string", "null"],
                "description": "One-sentence summary of how reservations work on this site.",
            },
        },
    },
}


# ---------------------------------------------------------------------------
# HTML fetch + clean
# ---------------------------------------------------------------------------

def _strip_html(raw: str) -> str:
    """Remove script/style blocks and tags; collapse whitespace."""
    raw = re.sub(r"<script[^>]*>.*?</script>", " ", raw, flags=re.DOTALL | re.IGNORECASE)
    raw = re.sub(r"<style[^>]*>.*?</style>", " ", raw, flags=re.DOTALL | re.IGNORECASE)
    raw = re.sub(r"<[^>]+>", " ", raw)
    return re.sub(r"\s+", " ", raw).strip()


def _quick_detect(raw_html: str) -> tuple[str, str] | None:
    """Fast regex check for known booking platforms before calling Claude."""
    lower = raw_html.lower()
    for domain, name in KNOWN_PLATFORMS.items():
        if domain in lower:
            # Try to extract the href pointing to that platform
            pattern = rf'href=["\']([^"\']*{re.escape(domain)}[^"\']*)["\']'
            m = re.search(pattern, raw_html, re.IGNORECASE)
            url = m.group(1) if m else None
            return ("zewnetrzny", name, url)
    return None


async def fetch_html(client: httpx.AsyncClient, url: str, timeout: float) -> str | None:
    try:
        r = await client.get(
            url, timeout=timeout, follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; bojo-enricher/1.0)"},
        )
        if r.status_code == 200:
            return r.text[:200_000]  # cap before stripping
    except Exception as exc:
        log.debug("fetch %s: %s", url, exc)
    return None


# ---------------------------------------------------------------------------
# Supabase
# ---------------------------------------------------------------------------

async def fetch_candidates(
    client: httpx.AsyncClient, base: str, key: str, *, reprocess: bool,
) -> list[dict[str, Any]]:
    """Return fields with a website that need booking analysis."""
    r = await client.get(
        f"{base}/rest/v1/fields",
        headers=_sb_headers(key),
        params={"select": "id,name,website,address", "website": "not.is.null", "limit": "10000"},
    )
    r.raise_for_status()
    fields = {f["id"]: f for f in r.json() if f.get("website")}

    if not fields:
        return []

    # Fetch existing outreach rows so we know which already have booking_system
    ro = await client.get(
        f"{base}/rest/v1/field_outreach",
        headers=_sb_headers(key),
        params={"select": "field_id,booking_system", "limit": "10000"},
    )
    ro.raise_for_status()
    outreach_map = {row["field_id"]: row for row in ro.json()}

    out = []
    for fid, f in fields.items():
        o = outreach_map.get(fid, {})
        bs = o.get("booking_system")
        if not reprocess and bs and bs not in ("nieznany", None):
            continue
        out.append(f)

    return out


async def save_result(
    client: httpx.AsyncClient, base: str, key: str,
    field_id: str, result: dict[str, Any],
) -> bool:
    now = datetime.now(timezone.utc).isoformat()
    patch = {
        "booking_system": result.get("booking_system", "nieznany"),
        "ai_enriched_at": now,
    }
    if result.get("booking_url"):
        patch["booking_url"] = result["booking_url"]
    if result.get("booking_provider"):
        patch["booking_provider"] = result["booking_provider"]
    if result.get("notes"):
        patch["ai_summary"] = result["notes"]

    # Upsert into field_outreach (insert if not exists, update if exists)
    patch["field_id"] = field_id
    rp = await client.post(
        f"{base}/rest/v1/field_outreach",
        headers=_sb_headers(key, {"Prefer": "resolution=merge-duplicates,return=minimal"}),
        params={"on_conflict": "field_id"},
        json=patch,
    )
    return rp.status_code in (200, 201, 204)


# ---------------------------------------------------------------------------
# Claude analysis
# ---------------------------------------------------------------------------

async def analyze_with_claude(
    client: httpx.AsyncClient,
    venue: dict[str, Any],
    html_text: str,
    model: str,
    api_key: str,
) -> dict[str, Any]:
    name = venue.get("name", "")
    website = venue.get("website", "")
    # Keep first 30k chars — enough to detect booking widgets; ~7k tokens for Haiku
    content = html_text[:30_000]

    prompt = (
        f'Przeanalizuj treść strony internetowej obiektu sportowego "{name}" ({website}).\n\n'
        "Określ, jak obiekt przyjmuje rezerwacje:\n"
        "- wlasny_system: ma własny formularz/kalendarz online\n"
        "- zewnetrzny: przekierowuje do zewnętrznej platformy (Hally, Booksy, Calendly itp.)\n"
        "- telefon: rezerwacje wyłącznie telefonicznie\n"
        "- email: rezerwacje przez e-mail\n"
        "- brak: wolny wstęp / brak rezerwacji\n"
        "- nieznany: nie można określić\n\n"
        "Jeśli widzisz link do systemu rezerwacji lub zewnętrzną platformę, podaj URL.\n\n"
        f"Treść strony:\n{content}"
    )

    payload = {
        "model": model,
        "max_tokens": 512,
        "tools": [BOOKING_RECORD_TOOL],
        "tool_choice": {"type": "any"},
        "messages": [{"role": "user", "content": prompt}],
    }
    headers = {
        "x-api-key": api_key,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
    }
    r = await client.post(ANTHROPIC_URL, json=payload, headers=headers, timeout=30.0)
    r.raise_for_status()
    data = r.json()

    for block in data.get("content", []):
        if block.get("type") == "tool_use" and block.get("name") == "record_booking":
            inp = block.get("input", {})
            # Token tracking
            usage = data.get("usage", {})
            return {**inp, "_tokens_in": usage.get("input_tokens", 0), "_tokens_out": usage.get("output_tokens", 0)}

    return {"booking_system": "nieznany", "_tokens_in": 0, "_tokens_out": 0}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def run(args: argparse.Namespace) -> None:
    load_dotenv()
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    base = os.getenv("SUPABASE_URL", "").rstrip("/")
    sb_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    model = args.model or os.getenv("ANTHROPIC_MODEL", DEFAULT_MODEL)

    if not api_key:
        log.error("ANTHROPIC_API_KEY not set."); return
    if not (base and sb_key):
        log.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set."); return

    async with httpx.AsyncClient() as client:
        candidates = await fetch_candidates(client, base, sb_key, reprocess=args.all)
        if args.limit:
            candidates = candidates[: args.limit]

        log.info("%d venues with website to analyse%s",
                 len(candidates), " · DRY RUN" if args.dry_run else "")
        if not candidates:
            log.info("Nothing to do."); return

        sem = asyncio.Semaphore(args.concurrency)
        totals = {"quick": 0, "claude": 0, "no_html": 0, "saved": 0,
                  "tok_in": 0, "tok_out": 0}

        async def worker(venue: dict[str, Any]) -> None:
            url = venue.get("website", "")
            name = venue.get("name", "?")
            async with sem:
                raw_html = await fetch_html(client, url, args.fetch_timeout)
                if not raw_html:
                    totals["no_html"] += 1
                    log.info("✗ %s — nie można pobrać %s", name[:40], url[:50])
                    return

                # Fast path: known platform detected by regex
                quick = _quick_detect(raw_html)
                if quick:
                    sys, provider, burl = quick
                    result = {"booking_system": sys, "booking_provider": provider,
                              "booking_url": burl, "notes": f"Wykryto platformę {provider}"}
                    totals["quick"] += 1
                    log.info("⚡ %s → %s (%s)%s", name[:40], sys, provider,
                             f" {burl[:50]}" if burl else "")
                else:
                    text = _strip_html(raw_html)
                    result = await analyze_with_claude(client, venue, text, model, api_key)
                    totals["claude"] += 1
                    totals["tok_in"] += result.pop("_tokens_in", 0)
                    totals["tok_out"] += result.pop("_tokens_out", 0)
                    sys = result.get("booking_system", "nieznany")
                    burl = result.get("booking_url", "")
                    log.info("✓ %s → %s%s", name[:40], sys,
                             f" {burl[:50]}" if burl else "")

                if not args.dry_run:
                    ok = await save_result(client, base, sb_key, venue["id"], result)
                    if ok:
                        totals["saved"] += 1

        await asyncio.gather(*(worker(v) for v in candidates))

        # Haiku pricing: $0.80/1M input, $4.00/1M output (as of 2025)
        cost = totals["tok_in"] / 1_000_000 * 0.80 + totals["tok_out"] / 1_000_000 * 4.00
        log.info("─" * 60)
        log.info("Quick-detect: %d · Claude: %d · brak HTML: %d · zapisano: %d",
                 totals["quick"], totals["claude"], totals["no_html"], totals["saved"])
        if totals["claude"]:
            log.info("Tokeny: %d in / %d out · koszt ≈ $%.4f",
                     totals["tok_in"], totals["tok_out"], cost)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Extract booking system from venue websites")
    p.add_argument("--limit", type=int, default=0, help="max venues (0 = all)")
    p.add_argument("--dry-run", action="store_true", help="print results, write nothing")
    p.add_argument("--all", action="store_true", help="re-process already analysed venues")
    p.add_argument("--concurrency", type=int, default=4)
    p.add_argument("--model", default="", help="Claude model ID")
    p.add_argument("--fetch-timeout", type=float, default=12.0,
                   help="HTTP timeout for website fetch (seconds)")
    return p.parse_args()


if __name__ == "__main__":
    asyncio.run(run(parse_args()))
