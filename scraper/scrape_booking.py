"""
Boiska Poznań — Reverse Booking Scraper  (strony rezerwacji → obiekty)
======================================================================
Działa "od drugiej strony" niż scraper.py: zamiast iść od współrzędnych do
adresu i kontaktu, zaczyna od STRON Z REZERWACJAMI, wyciąga z nich gdzie jest
boisko (nazwa + adres + link do rezerwacji), geokoduje adres na współrzędne,
dopasowuje do istniejących obiektów albo dodaje nowe — od razu widoczne na mapie.

Źródła (providerzy) — wybierane flagą --source:
  • ai        — Claude z web search szuka stron typu "rezerwacja boiska Poznań",
                wchodzi na nie i wyciąga listę obiektów + URL rezerwacji.
  • posir     — strony miejskie / POSiR i Miasto Poznań (obiekty publiczne).
  • all       — oba powyższe (domyślnie).

PODSTAWA PRAWNA / OGRANICZENIA:
  Komercyjne platformy rezerwacyjne (Playarena, Activenow, Hally itp.) są
  chronione bazodanowym prawem sui generis (ustawa o prawie autorskim i prawach
  pokrewnych, art. 102-104, implementacja dyrektywy 96/9/WE). Systematyczne
  pobieranie i ponowne wykorzystanie ich list obiektów może naruszać te prawa.
  Platformy te blokują też zautomatyzowany dostęp (HTTP 403). Z tego powodu NIE
  są uwzględnione jako osobny provider. Zamiast tego:
    • provider "ai" odkrywa obiekty organicznie poprzez web search Claude'a,
    • provider "posir" pobiera dane z publicznych stron instytucji miejskich,
    • dane OSM zbiera scraper.py (licencja ODbL, wolne użycie z atrybucją).
  Przechowywane dane: nazwa, adres, sport, współrzędne, URL rezerwacji
  (link odsyłający do oryginalnej platformy). NIE przechowujemy cen, grafików
  ani żadnych danych wyłącznie z platform komercyjnych.

Każdy znaleziony obiekt:
  1. forward-geocode adresu (Nominatim) → lat/lng,
  2. dopasowanie do istniejącego obiektu (geo + podobieństwo adresu),
  3a. jeśli pasuje → uzupełnia fields.booking_url / booking_type='external'
      (tylko gdy puste) + field_outreach (booking_system='zewnetrzny', URL, provider),
  3b. jeśli nie → DODAJE nowy obiekt (source='booking', map_visibility='public')
      i tworzy wpis field_outreach.

Pliki bazują na tym samym schemacie co scraper.py — nic nie psują, są idempotentne.

Uruchomienie:
    pip install httpx python-dotenv
    export ANTHROPIC_API_KEY=sk-ant-...
    export SUPABASE_URL=https://xxxx.supabase.co
    export SUPABASE_SERVICE_ROLE_KEY=eyJ...

    python scrape_booking.py --source all --dry-run     # podgląd, bez zapisu
    python scrape_booking.py --source ai --limit 20      # tylko odkrywanie AI
    python scrape_booking.py                             # wszystko, zapis do bazy

Flagi:
    --source {ai,platforms,posir,all}   źródło (domyślnie all)
    --limit N            maks. obiektów do zapisania (0 = bez limitu)
    --dry-run            wypisz, nic nie zapisuj
    --no-add            nie twórz nowych obiektów, tylko wzbogacaj istniejące
    --model ID          model Claude (domyślnie env ANTHROPIC_MODEL lub haiku 4.5)
    --concurrency N      równoległe pobierania stron (domyślnie 3)
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import re
import time
from dataclasses import dataclass, field as dc_field
from datetime import datetime, timezone
from typing import Any

import httpx
from dotenv import load_dotenv

from enrich import _sb_headers          # Supabase header helper
from enrich_booking import _strip_html  # HTML → plain text
from scraper import _match_score        # geo + address similarity for dedup

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("scrape-booking")

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
DEFAULT_MODEL = "claude-haiku-4-5-20251001"

NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "bojo-app-booking-scraper/1.0 (contact: admin@bojo.app)"

VALID_SPORTS = [
    "piłka nożna", "futsal", "siatkówka", "siatkówka plażowa",
    "koszykówka", "piłka ręczna", "hokej", "rugby", "wielofunkcyjne", "inne",
]

# ---------------------------------------------------------------------------
# Seed URLs — TYLKO publiczne instytucje (dane publiczne, brak ograniczeń).
# Komercyjne platformy rezerwacyjne zostały usunięte — patrz docstring.
# ---------------------------------------------------------------------------

# Publiczne instytucje miejskie: POSiR, Miasto Poznań (orliki), BIP itp.
POSIR_SEEDS: list[tuple[str, str]] = [
    ("POSiR Poznań",   "https://posir.poznan.pl/obiekty/"),
    ("Poznań Orliki",  "https://www.poznan.pl/mim/sport/orliki,p,15076.html"),
]

# Web-search queries for the AI discovery provider
AI_QUERIES = [
    "rezerwacja boiska Poznań online",
    "wynajem boiska piłkarskiego Poznań rezerwacja",
    "rezerwacja hali sportowej Poznań",
    "rezerwacja orlika Poznań powiat poznański",
    "boisko do siatkówki Poznań rezerwacja online",
]


# ---------------------------------------------------------------------------
# Candidate model
# ---------------------------------------------------------------------------

@dataclass
class Candidate:
    name: str
    address: str
    booking_url: str | None
    provider: str
    sports: list[str] = dc_field(default_factory=list)
    lat: float | None = None
    lng: float | None = None

    def key(self) -> str:
        return f"{self.name.lower().strip()}|{self.address.lower().strip()}"


# ---------------------------------------------------------------------------
# Claude tool: extract a list of venues from a page / search results
# ---------------------------------------------------------------------------

EXTRACT_TOOL = {
    "name": "record_venues",
    "description": (
        "Zapisz listę obiektów sportowych (boisk, hal, kompleksów) w Poznaniu lub "
        "powiecie poznańskim, które można zarezerwować, znalezionych na tej stronie. "
        "Wypełnij tylko obiekty z konkretnym adresem. Nie zmyślaj."
    ),
    "input_schema": {
        "type": "object",
        "required": ["venues"],
        "properties": {
            "venues": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["name", "address"],
                    "properties": {
                        "name":    {"type": "string", "description": "Nazwa obiektu."},
                        "address": {"type": "string", "description": "Pełny adres z ulicą i numerem, miasto."},
                        "booking_url": {
                            "type": ["string", "null"],
                            "description": "Bezpośredni link do rezerwacji tego obiektu, jeśli jest.",
                        },
                        "sports": {
                            "type": ["array", "null"],
                            "items": {"type": "string", "enum": VALID_SPORTS},
                            "description": "Dyscypliny dostępne w obiekcie.",
                        },
                    },
                },
            },
        },
    },
}


def _headers(api_key: str) -> dict[str, str]:
    return {
        "x-api-key": api_key,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
    }


def _parse_venues(data: dict[str, Any], provider: str, default_url: str | None) -> list[Candidate]:
    out: list[Candidate] = []
    for block in data.get("content", []):
        if block.get("type") == "tool_use" and block.get("name") == "record_venues":
            for v in block.get("input", {}).get("venues", []):
                name = (v.get("name") or "").strip()
                address = (v.get("address") or "").strip()
                if not name or not address:
                    continue
                sports = [s for s in (v.get("sports") or []) if s in VALID_SPORTS]
                out.append(Candidate(
                    name=name,
                    address=address,
                    booking_url=v.get("booking_url") or default_url,
                    provider=provider,
                    sports=sports or ["wielofunkcyjne"],
                ))
    return out


async def _claude(
    client: httpx.AsyncClient, api_key: str, model: str,
    body: dict[str, Any],
) -> dict[str, Any] | None:
    for attempt in range(4):
        r = await client.post(ANTHROPIC_URL, headers=_headers(api_key), json=body, timeout=120.0)
        if r.status_code == 429:
            wait = float(r.headers.get("retry-after", min(30 * 2 ** attempt, 120)))
            log.warning("  429 — czekam %.0fs (próba %d/4)", wait, attempt + 1)
            await asyncio.sleep(wait)
            continue
        if r.status_code != 200:
            log.error("  Claude %s: %s", r.status_code, r.text[:200])
            return None
        return r.json()
    return None


# ---------------------------------------------------------------------------
# Provider 1 — AI discovery (web search → venues)
# ---------------------------------------------------------------------------

async def provider_ai(
    client: httpx.AsyncClient, api_key: str, model: str, queries: list[str],
) -> list[Candidate]:
    found: dict[str, Candidate] = {}
    for q in queries:
        prompt = (
            f'Wyszukaj w internecie: "{q}". Wejdź na strony z rezerwacją obiektów '
            "sportowych i zbierz konkretne obiekty (boiska, hale, kompleksy) w Poznaniu "
            "lub powiecie poznańskim, które można zarezerwować. Dla każdego podaj nazwę, "
            "pełny adres (ulica + numer) oraz link do rezerwacji. Następnie wywołaj "
            "record_venues z wynikami."
        )
        body = {
            "model": model,
            "max_tokens": 1500,
            "tools": [
                {"type": "web_search_20250305", "name": "web_search", "max_uses": 4},
                EXTRACT_TOOL,
            ],
            "messages": [{"role": "user", "content": prompt}],
        }
        data = await _claude(client, api_key, model, body)
        if not data:
            continue
        cands = _parse_venues(data, "AI / web search", None)
        # The model may answer in text then need a nudge to call the tool
        if not cands:
            msgs = body["messages"] + [
                {"role": "assistant", "content": data.get("content", [])},
                {"role": "user", "content": "Wywołaj teraz record_venues z obiektami."},
            ]
            body2 = {**body, "messages": msgs,
                     "tool_choice": {"type": "tool", "name": "record_venues"}}
            data2 = await _claude(client, api_key, model, body2)
            if data2:
                cands = _parse_venues(data2, "AI / web search", None)
        for c in cands:
            found.setdefault(c.key(), c)
        log.info("  AI %r → %d obiektów", q, len(cands))
    return list(found.values())


# ---------------------------------------------------------------------------
# Provider 2 & 3 — fetch a listing page, Claude extracts venues
# ---------------------------------------------------------------------------

async def _fetch(client: httpx.AsyncClient, url: str) -> str | None:
    try:
        r = await client.get(
            url, timeout=15.0, follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; bojo-booking/1.0)"},
        )
        if r.status_code == 200:
            return r.text[:300_000]
        log.info("  %s → HTTP %s", url, r.status_code)
    except Exception as exc:  # noqa: BLE001
        log.info("  nie pobrano %s — %s", url, exc)
    return None


async def provider_pages(
    client: httpx.AsyncClient, api_key: str, model: str,
    seeds: list[tuple[str, str]], concurrency: int,
) -> list[Candidate]:
    sem = asyncio.Semaphore(concurrency)
    found: dict[str, Candidate] = {}

    async def one(provider: str, url: str) -> None:
        async with sem:
            raw = await _fetch(client, url)
            if not raw:
                return
            text = _strip_html(raw)[:40_000]
            prompt = (
                f'To jest treść strony "{provider}" ({url}) z obiektami sportowymi do '
                "rezerwacji. Wyciągnij wszystkie obiekty w Poznaniu / powiecie poznańskim: "
                "nazwa, pełny adres (ulica + numer), link do rezerwacji jeśli jest. "
                f"Wywołaj record_venues.\n\nTreść:\n{text}"
            )
            body = {
                "model": model,
                "max_tokens": 1500,
                "tools": [EXTRACT_TOOL],
                "tool_choice": {"type": "tool", "name": "record_venues"},
                "messages": [{"role": "user", "content": prompt}],
            }
            data = await _claude(client, api_key, model, body)
            if not data:
                return
            cands = _parse_venues(data, provider, url)
            for c in cands:
                found.setdefault(c.key(), c)
            log.info("  %s → %d obiektów", provider, len(cands))

    await asyncio.gather(*(one(p, u) for p, u in seeds))
    return list(found.values())


# ---------------------------------------------------------------------------
# Forward geocoding (address → lat/lng) via Nominatim, throttled to 1 req/s
# ---------------------------------------------------------------------------

_last_geo = [0.0]


async def _geocode(client: httpx.AsyncClient, address: str) -> tuple[float, float] | None:
    elapsed = time.monotonic() - _last_geo[0]
    if elapsed < 1.1:
        await asyncio.sleep(1.1 - elapsed)
    _last_geo[0] = time.monotonic()

    q = address if re.search(r"pozna", address, re.I) else f"{address}, Poznań"
    try:
        r = await client.get(
            NOMINATIM_SEARCH,
            params={"q": q, "format": "json", "limit": "1", "countrycodes": "pl",
                    "accept-language": "pl"},
            headers={"User-Agent": USER_AGENT}, timeout=15.0,
        )
        if r.status_code != 200:
            return None
        res = r.json()
        if not res:
            return None
        return float(res[0]["lat"]), float(res[0]["lon"])
    except Exception as exc:  # noqa: BLE001
        log.debug("  geocode '%s' — %s", address, exc)
        return None


# ---------------------------------------------------------------------------
# Supabase: load existing, write matches / new venues
# ---------------------------------------------------------------------------

async def load_existing(client: httpx.AsyncClient, base: str, key: str) -> list[dict[str, Any]]:
    r = await client.get(
        f"{base}/rest/v1/fields",
        headers=_sb_headers(key),
        params={"select": "id,name,address,lat,lng,booking_url,booking_type", "limit": "10000"},
    )
    r.raise_for_status()
    return [f for f in r.json() if f.get("lat") is not None and f.get("lng") is not None]


async def enrich_existing(
    client: httpx.AsyncClient, base: str, key: str,
    field_row: dict[str, Any], cand: Candidate,
) -> None:
    """Patch booking link onto an existing field (fill-if-empty) + outreach row."""
    patch: dict[str, Any] = {}
    if cand.booking_url and not field_row.get("booking_url"):
        patch["booking_url"] = cand.booking_url
        if (field_row.get("booking_type") or "none") == "none":
            patch["booking_type"] = "external"
    # Make sure a discovered, bookable venue is visible on the map.
    patch["map_visibility"] = "public"
    await client.patch(
        f"{base}/rest/v1/fields",
        headers=_sb_headers(key, {"Prefer": "return=minimal"}),
        params={"id": f"eq.{field_row['id']}"},
        json=patch,
    )
    await _upsert_outreach(client, base, key, field_row["id"], cand)


async def insert_new(
    client: httpx.AsyncClient, base: str, key: str, cand: Candidate,
) -> str | None:
    row = {
        "name": cand.name,
        "address": cand.address,
        "lat": cand.lat,
        "lng": cand.lng,
        "sport": cand.sports or ["wielofunkcyjne"],
        "available": True,
        "source": "booking",
        "external_id": f"booking:{cand.provider}:{cand.key()}"[:255],
        "map_visibility": "public",
    }
    if cand.booking_url:
        row["booking_type"] = "external"
        row["booking_url"] = cand.booking_url
    r = await client.post(
        f"{base}/rest/v1/fields?on_conflict=source,external_id",
        headers=_sb_headers(key, {"Prefer": "resolution=merge-duplicates,return=representation"}),
        json=[row],
    )
    if r.status_code not in (200, 201):
        log.error("  insert '%s' nieudany %s: %s", cand.name, r.status_code, r.text[:160])
        return None
    body = r.json()
    new_id = body[0]["id"] if body else None
    if new_id:
        await _upsert_outreach(client, base, key, new_id, cand)
    return new_id


async def _upsert_outreach(
    client: httpx.AsyncClient, base: str, key: str, field_id: str, cand: Candidate,
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    row = {
        "field_id": field_id,
        "booking_system": "zewnetrzny" if cand.booking_url else "nieznany",
        "ai_summary": f"Znaleziono na: {cand.provider}.",
        "ai_enriched_at": now,
    }
    if cand.booking_url:
        row["booking_url"] = cand.booking_url
        row["booking_provider"] = cand.provider
    await client.post(
        f"{base}/rest/v1/field_outreach?on_conflict=field_id",
        headers=_sb_headers(key, {"Prefer": "resolution=merge-duplicates,return=minimal"}),
        json=[row],
    )


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
        log.error("ANTHROPIC_API_KEY nie ustawiony."); return
    if not (base and sb_key):
        log.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY nie ustawione."); return

    async with httpx.AsyncClient() as client:
        # 1) Collect candidates from selected providers
        candidates: dict[str, Candidate] = {}
        src = args.source
        if src in ("ai", "all"):
            log.info("Provider: AI / web search (%d zapytań)…", len(AI_QUERIES))
            for c in await provider_ai(client, api_key, model, AI_QUERIES):
                candidates.setdefault(c.key(), c)
        if src in ("posir", "all"):
            log.info("Provider: POSiR / orliki (%d źródeł)…", len(POSIR_SEEDS))
            for c in await provider_pages(client, api_key, model, POSIR_SEEDS, args.concurrency):
                candidates.setdefault(c.key(), c)

        cands = list(candidates.values())
        log.info("Zebrano %d unikalnych obiektów z rezerwacją", len(cands))
        if args.limit:
            cands = cands[: args.limit]
        if not cands:
            log.info("Brak obiektów do przetworzenia."); return

        # 2) Geocode
        for i, c in enumerate(cands, 1):
            geo = await _geocode(client, c.address)
            if geo:
                c.lat, c.lng = geo
            log.info("[geo %d/%d] %s → %s", i, len(cands), c.name[:40],
                     f"{c.lat:.5f},{c.lng:.5f}" if c.lat else "brak współrzędnych")

        # 3) Dedup against existing fields + write
        existing = await load_existing(client, base, sb_key)
        log.info("Wczytano %d istniejących obiektów do dopasowania", len(existing))

        stats = {"matched": 0, "added": 0, "skipped": 0}
        for c in cands:
            cand_dict = {"address": c.address, "lat": c.lat, "lng": c.lng}
            best_score, best = 0.0, None
            if c.lat is not None:
                for ex in existing:
                    s = _match_score(cand_dict, ex, max_dist_m=200.0)
                    if s > best_score:
                        best_score, best = s, ex

            if best and best_score >= 0.6:
                log.info("↔ [%.2f] %s ← %s (%s)", best_score, best.get("name"), c.name, c.provider)
                if not args.dry_run:
                    await enrich_existing(client, base, sb_key, best, c)
                stats["matched"] += 1
            elif c.lat is None:
                log.info("· pominięto %s — brak współrzędnych", c.name[:50])
                stats["skipped"] += 1
            elif args.no_add:
                log.info("· pominięto nowy %s — tryb --no-add", c.name[:50])
                stats["skipped"] += 1
            else:
                log.info("＋ NOWY %s | %s | %s", c.name[:45], c.address[:50], c.provider)
                if not args.dry_run:
                    await insert_new(client, base, sb_key, c)
                stats["added"] += 1

        log.info("─" * 64)
        log.info(
            "Gotowe: %d dopasowano do istniejących · %d nowych obiektów · %d pominięto%s",
            stats["matched"], stats["added"], stats["skipped"],
            " (DRY RUN — nic nie zapisano)" if args.dry_run else "",
        )


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Reverse booking scraper — strony rezerwacji → obiekty")
    p.add_argument("--source", choices=["ai", "posir", "all"], default="all")
    p.add_argument("--limit", type=int, default=0, help="maks. obiektów (0 = wszystkie)")
    p.add_argument("--dry-run", action="store_true", help="wypisz, nic nie zapisuj")
    p.add_argument("--no-add", action="store_true", help="nie twórz nowych, tylko wzbogacaj")
    p.add_argument("--model", default="", help="model Claude")
    p.add_argument("--concurrency", type=int, default=3)
    return p.parse_args()


if __name__ == "__main__":
    asyncio.run(run(parse_args()))
