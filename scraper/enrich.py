"""
Boiska Poznań — AI Venue Enrichment
===================================
Finds contact info and booking method for each venue by searching the web
with Claude. Fields at the same address are batched into a single AI request
(a sports complex with 5 pitches costs 1 request, not 5).

Findings are written back to Supabase:
  • fields         → phone, email, website, operator, opening_hours
                     (fill-if-empty only — never clobbers existing data)
  • field_outreach → booking_system, ai_summary, ai_enriched_at

Usage:
    pip install httpx python-dotenv
    export ANTHROPIC_API_KEY=sk-ant-...
    export SUPABASE_URL=https://xxxx.supabase.co
    export SUPABASE_SERVICE_ROLE_KEY=eyJ...

    python enrich.py --limit 5 --dry-run   # preview 5 address groups, no writes
    python enrich.py --limit 20            # enrich 20 address groups for real
    python enrich.py                       # all not-yet-enriched venues

Flags:
    --limit N        process at most N address groups (default: all)
    --dry-run        print findings, write nothing
    --all            re-process already-enriched venues
    --require-empty  only venues missing phone AND email
    --concurrency N  parallel requests (default 1 — web search uses ~62k tokens/req,
                     Haiku limit is 50k TPM, so >1 causes 429 with retry backoff)
    --model ID       Claude model (default: env ANTHROPIC_MODEL or haiku 4.5)
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any

import httpx
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("enrich")

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
DEFAULT_MODEL = "claude-haiku-4-5-20251001"

BOOKING_ENUM = {"telefon", "email", "wlasny_system", "zewnetrzny", "brak", "inny", "nieznany"}

# ---------------------------------------------------------------------------
# Address normalisation — key for grouping
# ---------------------------------------------------------------------------

def _norm_addr(addr: str) -> str:
    """Lowercase + collapse whitespace + strip punctuation differences."""
    s = addr.lower().strip()
    # normalise common abbrevs so "ul. " and "ulica " and "ul " group together
    s = re.sub(r'\bul\.?\s+', 'ul. ', s)
    s = re.sub(r'\bos\.?\s+', 'os. ', s)
    s = re.sub(r'\bpl\.?\s+', 'pl. ', s)
    return re.sub(r'\s+', ' ', s)


_CITY_ONLY = re.compile(
    r'^(poznań|warszawa|kraków|wrocław|gdańsk|łódź|katowice|'
    r'luboń|mosina|kórnik|swarzędz|murowana goślina|środa wielkopolska|'
    r'puszczykowo|czerwonak|buk|szamotuły|oborniki|'
    r'[a-ząćęłńóśźż ]{1,25})$'
)


def _has_street(addr: str) -> bool:
    """True when address contains a house number — i.e. it's a real street address."""
    return bool(re.search(r'\d', addr))


def group_by_address(
    fields: list[dict[str, Any]], max_group_size: int = 20
) -> list[list[dict[str, Any]]]:
    """Return list of address groups, sorted so largest groups come first.

    Groups with no street number (city-only addresses) or above max_group_size
    are each treated as individual records so we don't send one AI call for
    hundreds of unrelated venues.
    """
    buckets: dict[str, list[dict[str, Any]]] = {}
    for f in fields:
        raw = f.get("address") or ""
        key = _norm_addr(raw)
        # city-only address — keep as singleton so AI gets a useful address
        if not _has_street(raw) or _CITY_ONLY.fullmatch(key):
            buckets.setdefault(f"__solo__{f['id']}", [f])
        else:
            buckets.setdefault(key, []).append(f)

    groups: list[list[dict[str, Any]]] = []
    for g in buckets.values():
        if len(g) <= max_group_size:
            groups.append(g)
        else:
            # split oversized groups into chunks so each AI call stays focused
            for i in range(0, len(g), max_group_size):
                groups.append(g[i : i + max_group_size])

    groups.sort(key=lambda g: (-len(g), (g[0].get("address") or "")))
    return groups

# ---------------------------------------------------------------------------
# Claude tool definitions
# ---------------------------------------------------------------------------

def _web_search_tool(max_uses: int) -> dict:
    return {"type": "web_search_20250305", "name": "web_search", "max_uses": max_uses}

RECORD_TOOL = {
    "name": "record_findings",
    "description": (
        "Record the verified contact and reservation information you found for "
        "this sports venue / location. Only fill a field if you actually found "
        "it in the search results — use null when unknown. Never invent data."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "phone":    {"type": ["string", "null"], "description": "Public phone number."},
            "email":    {"type": ["string", "null"], "description": "Public contact email."},
            "website":  {"type": ["string", "null"], "description": "Official website URL."},
            "operator": {"type": ["string", "null"], "description": "Who runs it: school, club, company, city unit (e.g. POSiR), etc."},
            "opening_hours": {"type": ["string", "null"], "description": "Opening hours as plain text."},
            "booking_system": {
                "type": "string",
                "enum": sorted(BOOKING_ENUM),
                "description": (
                    "How reservations are made: 'telefon' (by phone), 'email', "
                    "'wlasny_system' (their own online booking), "
                    "'zewnetrzny' (external platform like Decathlon, e-sportowe, etc.), "
                    "'brak' (no booking / walk-in / public access), "
                    "'inny' (other method), 'nieznany' (couldn't determine)."
                ),
            },
            "confidence": {
                "type": "string",
                "enum": ["high", "medium", "low"],
                "description": "How sure you are this is the correct venue and that the data is accurate.",
            },
            "summary": {
                "type": "string",
                "description": (
                    "2-4 sentences in Polish: what this place is, who runs it, and "
                    "how to make a reservation. Shown to the outreach team."
                ),
            },
            "description": {
                "type": ["string", "null"],
                "description": (
                    "Short description in Polish (1-3 sentences) for venue visitors: "
                    "what kind of place it is, which sports, what makes it notable. "
                    "Only if you found reliable info — otherwise null."
                ),
            },
        },
        "required": ["booking_system", "confidence", "summary"],
    },
}

PROMPT = """\
Jesteś asystentem zbierającym dane kontaktowe obiektów sportowych w Polsce (rejon Poznania).

Lokalizacja do sprawdzenia:
- Adres: {address}
- Liczba obiektów: {count}
- Obiekty:
{venues_list}

{known}

Wyszukaj w internecie TĘ DOKŁADNĄ lokalizację (adres + ewentualnie nazwa + Poznań / powiat poznański) i ustal:
1. Telefon kontaktowy
2. E-mail kontaktowy
3. Oficjalna strona WWW
4. Kto zarządza / jest operatorem (szkoła, klub, firma, jednostka miejska jak POSiR/ZOO Sport itp.)
5. Godziny otwarcia
6. JAK rezerwuje się obiekty sportowe pod tym adresem (telefon / e-mail / własny system online / zewnętrzna platforma / wstęp wolny / inny)

Zasady:
- Szukaj KONKRETNIE tej lokalizacji pod podanym adresem.
- Jeśli wyniki dotyczą zupełnie innego miejsca o podobnej nazwie — zaznacz confidence=low.
- Podawaj tylko dane faktycznie znalezione. Czego nie wiesz → null.
- Wywołaj record_findings z wynikami. summary napisz po polsku.\
"""


def build_prompt(address: str, fields: list[dict[str, Any]]) -> str:
    venues = "\n".join(
        f"  • {f.get('name') or 'Boisko'}"
        + (f" [{', '.join(f['sport'])}]" if f.get("sport") else "")
        for f in fields
    )
    # surface known info so the AI focuses on what's missing
    known_bits: list[str] = []
    for key, label in (("phone", "Telefon"), ("email", "E-mail"), ("website", "WWW")):
        val = next((f[key] for f in fields if f.get(key)), None)
        if val:
            known_bits.append(f"- {label} z OSM: {val} (zweryfikuj / uzupełnij resztę)")
    known = ("Już znane dane (zweryfikuj i uzupełnij brakujące):\n" + "\n".join(known_bits)) if known_bits else ""
    return PROMPT.format(
        address=address,
        count=len(fields),
        venues_list=venues,
        known=known,
    )

# ---------------------------------------------------------------------------
# Supabase REST helpers
# ---------------------------------------------------------------------------

def _sb_headers(key: str, extra: dict[str, str] | None = None) -> dict[str, str]:
    h = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    if extra:
        h.update(extra)
    return h


async def fetch_candidates(
    client: httpx.AsyncClient, base: str, key: str, *, redo_all: bool, require_empty: bool,
) -> list[dict[str, Any]]:
    r = await client.get(
        f"{base}/rest/v1/fields",
        headers=_sb_headers(key),
        params={"select": "id,name,address,sport,phone,email,website,operator,opening_hours", "limit": "10000"},
    )
    r.raise_for_status()
    fields = r.json()

    r2 = await client.get(
        f"{base}/rest/v1/field_outreach",
        headers=_sb_headers(key),
        params={"select": "field_id,ai_enriched_at"},
    )
    r2.raise_for_status()
    enriched = {row["field_id"] for row in r2.json() if row.get("ai_enriched_at")}

    out = []
    for f in fields:
        if f["id"] in enriched and not redo_all:
            continue
        if require_empty and (f.get("phone") and f.get("email")):
            continue
        out.append(f)
    return out


async def write_back_group(
    client: httpx.AsyncClient, base: str, key: str,
    fields: list[dict[str, Any]], result: dict[str, Any],
) -> None:
    enriched_at = datetime.now(timezone.utc).isoformat()
    booking = result.get("booking_system")
    confident = result.get("confidence") in ("high", "medium")

    for f in fields:
        # fill-if-empty on fields
        patch: dict[str, Any] = {}
        for col in ("phone", "email", "website", "operator", "opening_hours", "description"):
            found = result.get(col)
            if found and not f.get(col):
                patch[col] = found
        if patch:
            rp = await client.patch(
                f"{base}/rest/v1/fields",
                headers=_sb_headers(key, {"Prefer": "return=minimal"}),
                params={"id": f"eq.{f['id']}"},
                json=patch,
            )
            if rp.status_code not in (200, 204):
                log.error("  field patch %s failed %s: %s", f.get("name"), rp.status_code, rp.text[:150])

    # batch upsert outreach AI columns — one POST for the whole group
    outreach_base: dict[str, Any] = {
        "ai_summary": result.get("summary"),
        "ai_enriched_at": enriched_at,
    }
    if booking in BOOKING_ENUM and booking != "nieznany" and confident:
        outreach_base["booking_system"] = booking

    outreach_rows = [{"field_id": f["id"], **outreach_base} for f in fields]
    ru = await client.post(
        f"{base}/rest/v1/field_outreach?on_conflict=field_id",
        headers=_sb_headers(key, {"Prefer": "resolution=merge-duplicates,return=minimal"}),
        json=outreach_rows,
    )
    if ru.status_code not in (200, 201, 204):
        log.error("  outreach batch upsert failed %s: %s", ru.status_code, ru.text[:150])

# ---------------------------------------------------------------------------
# Claude call (one call per address group)
# ---------------------------------------------------------------------------

async def enrich_group(
    client: httpx.AsyncClient, api_key: str, model: str,
    address: str, fields: list[dict[str, Any]], max_searches: int = 2,
) -> tuple[dict[str, Any] | None, dict[str, int]]:
    headers = {
        "x-api-key": api_key,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
    }
    messages: list[dict[str, Any]] = [
        {"role": "user", "content": build_prompt(address, fields)}
    ]
    usage_total = {"input_tokens": 0, "output_tokens": 0, "web_searches": 0}

    for round_idx in range(2):
        body: dict[str, Any] = {
            "model": model,
            "max_tokens": 1024,
            "tools": [_web_search_tool(max_searches), RECORD_TOOL],
            "messages": messages,
        }
        if round_idx == 1:
            body["tool_choice"] = {"type": "tool", "name": "record_findings"}

        for attempt in range(4):
            r = await client.post(ANTHROPIC_URL, headers=headers, json=body, timeout=120.0)
            if r.status_code == 429:
                wait = float(r.headers.get("retry-after", min(30 * 2 ** attempt, 120)))
                log.warning("  429 rate limit — wait %.0fs (attempt %d/3)", wait, attempt + 1)
                await asyncio.sleep(wait)
                continue
            break

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

        messages.append({"role": "assistant", "content": content})
        messages.append({"role": "user", "content": "Wywołaj teraz record_findings z wynikami."})

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
        groups = group_by_address(candidates)
        if args.limit:
            groups = groups[: args.limit]

        total_fields = sum(len(g) for g in groups)
        log.info(
            "Model: %s · %d address groups (%d fields total)%s",
            model, len(groups), total_fields,
            " · DRY RUN" if args.dry_run else "",
        )
        if not groups:
            log.info("Nothing to do."); return

        sem = asyncio.Semaphore(args.concurrency)
        totals = {"done": 0, "found_contact": 0, "in_tok": 0, "out_tok": 0, "searches": 0}

        async def worker(grp: list[dict[str, Any]]) -> None:
            address = grp[0].get("address") or "?"
            async with sem:
                findings, usage = await enrich_group(client, api_key, model, address, grp, args.max_searches)
                totals["in_tok"] += usage["input_tokens"]
                totals["out_tok"] += usage["output_tokens"]
                totals["searches"] += usage["web_searches"]

                if findings is None:
                    log.warning("✗ [%d fields] %s — no result", len(grp), address[:60])
                    return

                # count new contact info found for fields in this group
                new_contact = any(
                    findings.get(c) and not any(f.get(c) for f in grp)
                    for c in ("phone", "email", "website")
                )
                if new_contact:
                    totals["found_contact"] += 1

                log.info(
                    "✓ [%d] %s | conf=%s book=%s new=%s | %s",
                    len(grp), address[:50],
                    findings.get("confidence"),
                    findings.get("booking_system"),
                    ",".join(c for c in ("phone", "email", "website")
                             if findings.get(c) and not any(f.get(c) for f in grp)) or "—",
                    (findings.get("summary") or "")[:70],
                )
                if not args.dry_run:
                    await write_back_group(client, base, key, grp, findings)
                totals["done"] += 1

        await asyncio.gather(*(worker(g) for g in groups))

        ws_cost = totals["searches"] / 1000 * 10
        log.info("─" * 64)
        log.info("Done: %d/%d groups enriched · %d groups got new contact info",
                 totals["done"], len(groups), totals["found_contact"])
        log.info("Tokens in=%d out=%d · web searches=%d (~$%.2f)",
                 totals["in_tok"], totals["out_tok"], totals["searches"], ws_cost)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="AI venue enrichment via Claude web search")
    p.add_argument("--limit",        type=int, default=0,
                   help="process at most N address groups (0 = all)")
    p.add_argument("--dry-run",      action="store_true",
                   help="print findings, write nothing")
    p.add_argument("--all",          action="store_true",
                   help="re-process already-enriched venues")
    p.add_argument("--require-empty", action="store_true",
                   help="only venues missing both phone and email")
    p.add_argument("--concurrency",  type=int, default=1,
                   help="parallel requests — keep at 1 to avoid 50k TPM rate limit")
    p.add_argument("--max-searches", type=int, default=2, dest="max_searches",
                   help="max web searches per venue group (default 2; 4 = more data but hits TPM limit faster)")
    p.add_argument("--model",        type=str, default="")
    return p.parse_args()


if __name__ == "__main__":
    asyncio.run(run(parse_args()))
