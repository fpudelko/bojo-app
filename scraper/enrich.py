"""
Boiska Poznań — AI Venue Enrichment
===================================
For each venue lacking contact data, ask Claude (with the web search tool) to
find: phone, email, website, how to make a reservation (booking method),
operator/manager, and opening hours — by searching the web for the venue's
name + address.

Findings are written back to Supabase:
  • fields              → phone, email, website, operator, opening_hours
                          (fill-if-empty only — never clobbers existing data)
  • field_outreach      → booking_system, ai_summary, ai_enriched_at

Costs money (Claude API + web search). Test with --limit first.

Usage:
    pip install -r requirements.txt
    export ANTHROPIC_API_KEY=sk-ant-...
    export SUPABASE_URL=https://xxxx.supabase.co
    export SUPABASE_SERVICE_ROLE_KEY=eyJ...

    python enrich.py --limit 5 --dry-run   # preview on 5 venues, no writes
    python enrich.py --limit 20            # really enrich 20 venues
    python enrich.py                       # enrich everything not done yet

Flags:
    --limit N        only process N venues (default: all)
    --dry-run        print findings, write nothing
    --all            re-process even already-enriched venues
    --require-empty  only venues missing phone AND email (default: skip those
                     already AI-enriched, regardless of contact completeness)
    --concurrency N  parallel requests (default 4)
    --model ID       Claude model (default: env ANTHROPIC_MODEL or haiku 4.5)
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

import httpx
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("enrich")

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
DEFAULT_MODEL = "claude-haiku-4-5-20251001"

# Map the model's booking-method guess onto our DB enum.
BOOKING_ENUM = {"telefon", "email", "wlasny_system", "zewnetrzny", "brak", "inny", "nieznany"}

# ---------------------------------------------------------------------------
# Claude tool definitions
# ---------------------------------------------------------------------------

WEB_SEARCH_TOOL = {
    "type": "web_search_20250305",
    "name": "web_search",
    "max_uses": 4,
}

RECORD_TOOL = {
    "name": "record_findings",
    "description": (
        "Record the verified contact and reservation information you found for "
        "this sports venue. Only fill a field if you actually found it in the "
        "search results — use null when unknown. Never invent data."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "phone": {"type": ["string", "null"], "description": "Public phone number, digits/spaces as written."},
            "email": {"type": ["string", "null"], "description": "Public contact email."},
            "website": {"type": ["string", "null"], "description": "Official website URL."},
            "operator": {"type": ["string", "null"], "description": "Who runs it: school, club, company, city unit, etc."},
            "opening_hours": {"type": ["string", "null"], "description": "Opening hours as plain text, if found."},
            "booking_system": {
                "type": "string",
                "enum": sorted(BOOKING_ENUM),
                "description": (
                    "How reservations are made: 'telefon' (by phone), 'email', "
                    "'wlasny_system' (their own online booking system), "
                    "'zewnetrzny' (external booking platform), 'brak' (no booking / "
                    "walk-in / open access), 'inny' (other), 'nieznany' (couldn't tell)."
                ),
            },
            "confidence": {
                "type": "string",
                "enum": ["high", "medium", "low"],
                "description": "How sure you are this is the right venue and data.",
            },
            "summary": {
                "type": "string",
                "description": (
                    "1-3 sentences in Polish: what this place is and how to book it. "
                    "This is shown to the outreach team."
                ),
            },
        },
        "required": ["booking_system", "confidence", "summary"],
    },
}

PROMPT = """Jesteś asystentem zbierającym dane kontaktowe obiektów sportowych w Polsce (rejon Poznania).

Obiekt do sprawdzenia:
- Nazwa: {name}
- Adres: {address}
- Sporty: {sport}
{known}

Wyszukaj w internecie ten konkretny obiekt (nazwa + adres / ulica + miasto) i ustal:
1. Telefon kontaktowy
2. E-mail
3. Oficjalną stronę WWW
4. Kto nim zarządza (szkoła, klub, firma, jednostka miejska, np. POSiR)
5. Godziny otwarcia
6. JAK się rezerwuje termin (telefon / własny system online / zewnętrzna platforma / brak rezerwacji - wstęp wolny)

Zasady:
- Szukaj DOKŁADNIE tego obiektu pod tym adresem. Jeśli wyniki dotyczą innego miejsca o podobnej nazwie, nie używaj ich.
- Podawaj tylko dane, które realnie znalazłeś. Czego nie wiesz → null.
- Gdy skończysz, wywołaj narzędzie record_findings z wynikami. Pole summary napisz po polsku."""


def build_prompt(field: dict[str, Any]) -> str:
    known_bits = []
    if field.get("phone"):
        known_bits.append(f"- Znany telefon: {field['phone']}")
    if field.get("website"):
        known_bits.append(f"- Znana strona: {field['website']}")
    known = "\n".join(known_bits)
    if known:
        known = "Już znane (zweryfikuj / uzupełnij resztę):\n" + known
    return PROMPT.format(
        name=field.get("name") or "—",
        address=field.get("address") or "—",
        sport=", ".join(field.get("sport") or []) or "—",
        known=known,
    )


# ---------------------------------------------------------------------------
# Supabase REST helpers
# ---------------------------------------------------------------------------

def sb_headers(service_key: str, extra: dict[str, str] | None = None) -> dict[str, str]:
    h = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }
    if extra:
        h.update(extra)
    return h


async def fetch_candidates(
    client: httpx.AsyncClient, base: str, key: str, *, redo_all: bool, require_empty: bool,
) -> list[dict[str, Any]]:
    """Fetch fields joined with their outreach AI state, then filter in Python."""
    # Pull fields (scraped ones; never touch manual rows isn't necessary here,
    # enrichment is harmless, but we focus on rows missing data).
    r = await client.get(
        f"{base}/rest/v1/fields",
        headers=sb_headers(key),
        params={"select": "id,name,address,sport,phone,email,website,operator,opening_hours"},
    )
    r.raise_for_status()
    fields = r.json()

    r2 = await client.get(
        f"{base}/rest/v1/field_outreach",
        headers=sb_headers(key),
        params={"select": "field_id,ai_enriched_at,booking_system"},
    )
    r2.raise_for_status()
    outreach = {row["field_id"]: row for row in r2.json()}

    out = []
    for f in fields:
        o = outreach.get(f["id"])
        already = bool(o and o.get("ai_enriched_at"))
        if already and not redo_all:
            continue
        if require_empty and (f.get("phone") and f.get("email")):
            continue
        out.append(f)
    return out


async def write_back(
    client: httpx.AsyncClient, base: str, key: str, field: dict[str, Any], result: dict[str, Any],
) -> None:
    # 1) Fill-if-empty on fields (never clobber existing values)
    patch: dict[str, Any] = {}
    for col in ("phone", "email", "website", "operator", "opening_hours"):
        found = result.get(col)
        if found and not field.get(col):
            patch[col] = found
    if patch:
        rp = await client.patch(
            f"{base}/rest/v1/fields",
            headers=sb_headers(key, {"Prefer": "return=minimal"}),
            params={"id": f"eq.{field['id']}"},
            json=patch,
        )
        if rp.status_code not in (200, 204):
            log.error("  field patch failed %s: %s", rp.status_code, rp.text[:200])

    # 2) Upsert outreach AI fields (separate from human notes)
    booking = result.get("booking_system")
    payload: dict[str, Any] = {
        "field_id": field["id"],
        "ai_summary": result.get("summary"),
        "ai_enriched_at": datetime.now(timezone.utc).isoformat(),
    }
    # Only set booking_system from AI when confident, to avoid overriding humans.
    if booking in BOOKING_ENUM and booking != "nieznany" and result.get("confidence") in ("high", "medium"):
        payload["booking_system"] = booking

    ru = await client.post(
        f"{base}/rest/v1/field_outreach?on_conflict=field_id",
        headers=sb_headers(key, {"Prefer": "resolution=merge-duplicates,return=minimal"}),
        json=payload,
    )
    if ru.status_code not in (200, 201, 204):
        log.error("  outreach upsert failed %s: %s", ru.status_code, ru.text[:200])


# ---------------------------------------------------------------------------
# Claude call
# ---------------------------------------------------------------------------

async def enrich_one(
    client: httpx.AsyncClient, api_key: str, model: str, field: dict[str, Any],
) -> tuple[dict[str, Any] | None, dict[str, int]]:
    """Returns (findings|None, usage). Findings is the record_findings input."""
    headers = {
        "x-api-key": api_key,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
    }
    messages: list[dict[str, Any]] = [
        {"role": "user", "content": build_prompt(field)}
    ]
    usage_total = {"input_tokens": 0, "output_tokens": 0, "web_searches": 0}

    # Up to 2 rounds: search+answer, then a nudge to force the tool if needed.
    for round_idx in range(2):
        body = {
            "model": model,
            "max_tokens": 1024,
            "tools": [WEB_SEARCH_TOOL, RECORD_TOOL],
            "messages": messages,
        }
        if round_idx == 1:
            # Force the structured tool on the second pass.
            body["tool_choice"] = {"type": "tool", "name": "record_findings"}

        r = await client.post(ANTHROPIC_URL, headers=headers, json=body, timeout=120.0)
        if r.status_code != 200:
            log.error("  Claude error %s: %s", r.status_code, r.text[:300])
            return None, usage_total
        data = r.json()

        u = data.get("usage", {})
        usage_total["input_tokens"] += u.get("input_tokens", 0)
        usage_total["output_tokens"] += u.get("output_tokens", 0)
        usage_total["web_searches"] += (u.get("server_tool_use") or {}).get("web_search_requests", 0)

        content = data.get("content", [])
        for block in content:
            if block.get("type") == "tool_use" and block.get("name") == "record_findings":
                return block.get("input", {}), usage_total

        # No structured tool yet → append assistant turn and loop to force it.
        messages.append({"role": "assistant", "content": content})
        messages.append({
            "role": "user",
            "content": "Wywołaj teraz narzędzie record_findings z tym, co udało się ustalić.",
        })

    return None, usage_total


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def run(args: argparse.Namespace) -> None:
    load_dotenv()
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    base = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    model = args.model or os.getenv("ANTHROPIC_MODEL", DEFAULT_MODEL)

    if not api_key:
        log.error("ANTHROPIC_API_KEY not set."); return
    if not (base and key):
        log.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set."); return

    async with httpx.AsyncClient() as client:
        candidates = await fetch_candidates(
            client, base, key, redo_all=args.all, require_empty=args.require_empty,
        )
        if args.limit:
            candidates = candidates[: args.limit]
        log.info("Model: %s · %d venues to enrich%s", model, len(candidates),
                 " (DRY RUN)" if args.dry_run else "")
        if not candidates:
            log.info("Nothing to do."); return

        sem = asyncio.Semaphore(args.concurrency)
        totals = {"done": 0, "found_contact": 0, "input_tokens": 0, "output_tokens": 0, "web_searches": 0}

        async def worker(field: dict[str, Any]) -> None:
            async with sem:
                findings, usage = await enrich_one(client, api_key, model, field)
                for k in ("input_tokens", "output_tokens", "web_searches"):
                    totals[k] += usage[k]
                if findings is None:
                    log.warning("✗ %s — no result", field.get("name"))
                    return
                got = [c for c in ("phone", "email", "website") if findings.get(c) and not field.get(c)]
                if got:
                    totals["found_contact"] += 1
                log.info(
                    "✓ %s [%s] book=%s new=%s — %s",
                    (field.get("name") or "")[:40],
                    findings.get("confidence"),
                    findings.get("booking_system"),
                    ",".join(got) or "—",
                    (findings.get("summary") or "")[:80],
                )
                if not args.dry_run:
                    await write_back(client, base, key, field, findings)
                totals["done"] += 1

        await asyncio.gather(*(worker(f) for f in candidates))

        # Rough cost estimate (web search ≈ $10 / 1000; tokens vary by model).
        ws_cost = totals["web_searches"] / 1000 * 10
        log.info("─" * 60)
        log.info("Done: %d/%d enriched · %d got new contact info",
                 totals["done"], len(candidates), totals["found_contact"])
        log.info("Tokens: in=%d out=%d · web searches=%d (~$%.2f)",
                 totals["input_tokens"], totals["output_tokens"],
                 totals["web_searches"], ws_cost)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="AI venue enrichment via Claude web search")
    p.add_argument("--limit", type=int, default=0, help="process at most N venues")
    p.add_argument("--dry-run", action="store_true", help="print findings, write nothing")
    p.add_argument("--all", action="store_true", help="re-process already-enriched venues")
    p.add_argument("--require-empty", action="store_true",
                   help="only venues missing both phone and email")
    p.add_argument("--concurrency", type=int, default=4)
    p.add_argument("--model", type=str, default="")
    return p.parse_args()


if __name__ == "__main__":
    asyncio.run(run(parse_args()))
