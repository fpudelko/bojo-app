"""
Boiska Poznań — AI Satellite Image Analyzer
============================================
For each venue, fetches a Mapbox satellite tile and asks Claude to classify:
  • is it actually a sports venue?
  • type label (orlik / pełnowymiarowe / piątka / siódemka / kort …)
  • surface type
  • dimensions estimate
  • access type (public / school / private / club)
  • visible infrastructure (lights, fence, stands, changing rooms)
  • condition
  • pitch count

Results are written back to the `fields` table.
Existing non-null values for columns like `surface`, `is_indoor`, `lit`,
`has_changing_rooms` are only overwritten when --overwrite flag is passed.

Usage:
    pip install httpx python-dotenv anthropic
    export ANTHROPIC_API_KEY=sk-ant-...
    export SUPABASE_URL=https://xxxx.supabase.co
    export SUPABASE_SERVICE_ROLE_KEY=eyJ...
    export NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...

    python analyze_venues.py --limit 5 --dry-run   # preview, no writes
    python analyze_venues.py --limit 20            # process 20 venues
    python analyze_venues.py                       # all untyped venues
    python analyze_venues.py --all --overwrite     # re-analyse everything
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import json
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("analyze_venues")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
SUPABASE_URL          = os.environ["SUPABASE_URL"]
SUPABASE_KEY          = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
ANTHROPIC_API_KEY     = os.environ["ANTHROPIC_API_KEY"]
MAPBOX_TOKEN          = os.environ.get("NEXT_PUBLIC_MAPBOX_TOKEN") or os.environ.get("MAPBOX_TOKEN", "")
ANTHROPIC_URL         = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION     = "2023-06-01"
MODEL                 = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")

# Satellite tile: 512×512 @2x at zoom 18 gives ~1m/px resolution — enough to read surface & count pitches
MAPBOX_ZOOM           = 18
MAPBOX_W, MAPBOX_H    = 512, 512

# Supabase Storage bucket for satellite images.
# Create it once in Supabase Dashboard → Storage → New bucket:
#   Name: venue-satellites   Public: YES
STORAGE_BUCKET        = "venue-satellites"

SUPABASE_HEADERS = {
    "apikey":        SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "return=minimal",
}

# ---------------------------------------------------------------------------
# Taxonomy used in the prompt — must match migration comment
# ---------------------------------------------------------------------------
VENUE_TYPES = {
    # Football
    "full_size":     "Pełnowymiarowe (11v11, ~105×68 m)",
    "seven_a_side":  "Siódemka (7v7, ~65×45 m)",
    "five_a_side":   "Piątka (5v5, ~40×20 m)",
    "orlik":         "Orlik (rządowy program — syntetyk, ~56×26 m, charakterystyczne niebieskie/zielone pole)",
    "futsal_hall":   "Hala futsal / sala gimnastyczna",
    # Basketball
    "basketball_full":  "Koszykówka pełna (28×15 m)",
    "basketball_half":  "Koszykówka połówka",
    # Volleyball
    "volleyball_outdoor": "Siatkówka outdoor (18×9 m + strefa)",
    "volleyball_beach":   "Siatkówka plażowa / piasek",
    # Tennis / other
    "tennis_outdoor": "Kort tenisowy (23×11 m)",
    "multi_sport":    "Wielofunkcyjne (linie do kilku sportów)",
    "other":          "Inne / niejednoznaczne",
}

SURFACE_VALUES = [
    "trawa_naturalna",    # natural grass
    "sztuczna_trawa",     # artificial turf
    "tartan",             # rubber/tartan
    "szuter",             # gravel / red shale
    "asfalt",             # asphalt
    "beton",              # concrete
    "piasek",             # sand
    "parkiet",            # indoor hardcourt / parquet
    "nieznana",           # unknown
]

ACCESS_VALUES = [
    "public",    # open park, street-side, no gate
    "school",    # inside school/university campus
    "private",   # residential, company
    "club",      # sports club, enclosed facility
    "unknown",
]

CONDITION_VALUES = ["good", "fair", "poor", "unknown"]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def mapbox_satellite_url(lat: float, lng: float) -> str:
    return (
        f"https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/"
        f"{lng},{lat},{MAPBOX_ZOOM},0/{MAPBOX_W}x{MAPBOX_H}@2x"
        f"?access_token={MAPBOX_TOKEN}"
    )


async def fetch_satellite_bytes(client: httpx.AsyncClient, url: str) -> bytes | None:
    """Fetch Mapbox satellite tile, return raw JPEG bytes."""
    try:
        r = await client.get(url, timeout=15)
        r.raise_for_status()
        return r.content
    except Exception as e:
        log.warning("Image fetch failed %s: %s", url, e)
        return None


async def upload_satellite_image(client: httpx.AsyncClient, field_id: str, img_bytes: bytes) -> str | None:
    """Upload satellite JPEG to Supabase Storage, return public URL."""
    path    = f"{field_id}.jpg"
    api_url = f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}/{path}"
    headers = {
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type":  "image/jpeg",
        "x-upsert":      "true",   # overwrite on re-run
    }
    try:
        r = await client.put(api_url, content=img_bytes, headers=headers, timeout=30)
        r.raise_for_status()
        return f"{SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET}/{path}"
    except Exception as e:
        log.warning("Storage upload failed for %s: %s", field_id, e)
        return None


async def analyse_with_claude(client: httpx.AsyncClient, image_b64: str, field: dict) -> dict | None:
    venue_type_list = "\n".join(f'  "{k}" — {v}' for k, v in VENUE_TYPES.items())
    surface_list    = ", ".join(SURFACE_VALUES)
    access_list     = ", ".join(ACCESS_VALUES)
    condition_list  = ", ".join(CONDITION_VALUES)

    prompt = f"""Analizujesz zdjęcie satelitarne obiektu sportowego z bazy danych boisk w Polsce.

Znane dane z bazy:
  name:     {field.get("name", "?")}
  address:  {field.get("address", "?")}
  sport:    {field.get("sport", [])}
  surface:  {field.get("surface") or "brak danych"}
  is_indoor:{field.get("is_indoor", False)}

Twoje zadanie: na podstawie WYŁĄCZNIE widoku satelitarnego określ poniższe pola i zwróć je jako JSON.
Jeśli nie możesz czegoś stwierdzić z widoku, użyj wartości null.

Pola do wypełnienia:

1. is_verified_venue (boolean)
   true = na zdjęciu widać obiekt sportowy (boisko, kort, hala)
   false = brak widocznego obiektu sportowego (błędny wpis w bazie)

2. venue_type (string | null) — wybierz JEDEN z poniższych kodów, który najlepiej opisuje GŁÓWNY obiekt:
{venue_type_list}

3. surface (string | null) — nawierzchnia głównego obiektu, jeden z: {surface_list}

4. is_indoor (boolean | null) — czy to hala/obiekt kryty?

5. dimensions_m (string | null) — przybliżone wymiary głównego boiska w metrach, format "DŁUGOŚĆxSZEROKOŚĆ", np. "105x68"
   Wskazówki: linie bramkowe piłki nożnej ~7.3m; szerokość pasa = łatwy kaliber.

6. pitch_count (int | null) — ile osobnych boisk/kortów widać w tym miejscu?

7. access_type (string | null) — jeden z: {access_list}
   Wskazówki:
   - "school" = obiekt w obrębie budynku szkolnego lub otoczony innymi budynkami szkoły
   - "public"  = otwarty teren parku, przy ulicy, brak ogrodzenia lub wejście otwarte
   - "club"    = zamknięty teren klubu sportowego, widoczne trybuny lub wiele boisk
   - "private" = posesja prywatna, dom/firma

8. lit (boolean | null) — widoczne maszty/słupy oświetleniowe przy boisku?

9. has_changing_rooms (boolean | null) — widoczny budynek/przybudówka (szatnia, sanitariaty)?

10. has_stands (boolean | null) — widoczne trybuny lub ławki dla widzów?

11. has_fence (boolean | null) — obiekt ogrodzony?

12. condition (string | null) — wizualny stan nawierzchni: {condition_list}
    good = wyraźne linie, zadbana nawierzchnia
    fair = linie widoczne ale wyblakłe, lub nawierzchnia lekko zużyta
    poor = brak linii, zniszczona nawierzchnia, zaniedbanie

13. sports (array of strings | null) — jakie sporty można tu grać na podstawie widoku?
    Używaj TYLKO wartości z tej listy (możesz wybrać kilka):
      "piłka nożna", "futsal", "koszykówka", "siatkówka", "siatkówka plażowa",
      "tenis", "piłka ręczna", "inne"
    Wskazówki:
    - Boisko z liniami bramkowymi + duże pole → "piłka nożna"
    - Małe boisko ~40x20 z bramkami → "futsal" lub "piłka nożna" (zależnie od nawierzchni)
    - Linie do koszykówki (obręcze/trójki) → "koszykówka"
    - Linie siatkówki (18x9) → "siatkówka"
    - Piasek + linie siatkówki → "siatkówka plażowa"
    - Kort (23x11, ograniczony siatką) → "tenis"
    - Wiele linii różnych sportów → kilka wartości
    - Hala bez widocznych linii → null (nie zgaduj)
    - is_verified_venue=false → null

14. ai_notes (string | null) — opcjonalny komentarz: wątpliwości, osobliwości, ciekawe cechy.
    Zostaw null jeśli nie ma nic do dodania. Maksymalnie 1 zdanie.

Odpowiedz TYLKO czystym JSON-em, bez żadnego tekstu przed ani po. Przykład:
{{
  "is_verified_venue": true,
  "venue_type": "orlik",
  "surface": "sztuczna_trawa",
  "is_indoor": false,
  "dimensions_m": "56x26",
  "pitch_count": 2,
  "access_type": "public",
  "lit": true,
  "has_changing_rooms": true,
  "has_stands": false,
  "has_fence": true,
  "condition": "good",
  "sports": ["piłka nożna", "futsal"],
  "ai_notes": null
}}"""

    payload = {
        "model": MODEL,
        "max_tokens": 600,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": image_b64,
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
    }

    headers = {
        "x-api-key":         ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type":      "application/json",
    }

    # 429 waits: 30s, 60s, 90s, 120s — API has per-minute rate limits
    RETRY_WAITS = [30, 60, 90, 120]
    for attempt in range(len(RETRY_WAITS) + 1):
        try:
            r = await client.post(ANTHROPIC_URL, json=payload, headers=headers, timeout=60)
            if r.status_code == 429:
                if attempt >= len(RETRY_WAITS):
                    log.error("Claude API: gave up after %d retries (rate limit)", len(RETRY_WAITS))
                    return None
                wait = RETRY_WAITS[attempt]
                log.warning("Rate limited (429), waiting %ds before retry %d/%d…", wait, attempt + 1, len(RETRY_WAITS))
                await asyncio.sleep(wait)
                continue
            r.raise_for_status()
            text = r.json()["content"][0]["text"].strip()
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            return json.loads(text)
        except Exception as e:
            if "429" in str(e):
                if attempt >= len(RETRY_WAITS):
                    log.error("Claude API: gave up after %d retries (rate limit)", len(RETRY_WAITS))
                    return None
                wait = RETRY_WAITS[attempt]
                log.warning("Rate limited, waiting %ds before retry %d/%d…", wait, attempt + 1, len(RETRY_WAITS))
                await asyncio.sleep(wait)
                continue
            log.error("Claude API error: %s", e)
            return None
    return None


def build_update(result: dict, existing: dict, overwrite: bool) -> dict:
    """Build the Supabase update dict, respecting overwrite flag."""
    OVERWRITABLE = {"surface", "is_indoor", "lit", "has_changing_rooms"}
    update: dict[str, Any] = {
        "venue_type":          result.get("venue_type"),
        "dimensions_m":        result.get("dimensions_m"),
        "pitch_count":         result.get("pitch_count"),
        "access_type":         result.get("access_type"),
        "is_verified_venue":   result.get("is_verified_venue"),
        "has_stands":          result.get("has_stands"),
        "has_fence":           result.get("has_fence"),
        "condition":           result.get("condition"),
        "ai_notes":            result.get("ai_notes"),
        "ai_typed_at":         datetime.now(timezone.utc).isoformat(),
    }

    # AI-detected sports — update sport[] column when AI found something.
    # Merge with existing OSM sports rather than overwrite, unless --overwrite.
    ai_sports = result.get("sports")
    if ai_sports and isinstance(ai_sports, list) and len(ai_sports) > 0:
        if overwrite:
            update["sport"] = ai_sports
        else:
            existing_sports = existing.get("sport") or []
            merged = list(dict.fromkeys(existing_sports + ai_sports))  # dedupe, preserve order
            update["sport"] = merged

    # Conditionally overwrite existing columns
    for col in OVERWRITABLE:
        new_val = result.get(col)
        if new_val is None:
            continue
        if overwrite or existing.get(col) is None:
            update[col] = new_val

    # Set map_visibility based on what AI actually found in the satellite image.
    # This replaces the classify.py heuristic for all satellite-analysed venues.
    update["map_visibility"] = _ai_visibility(result, existing)

    # Drop None values — don't clobber DB with nulls for uncertain fields
    return {k: v for k, v in update.items() if v is not None}


def _ai_visibility(result: dict, existing: dict) -> str:
    """
    Decide map_visibility from AI analysis results.

      hidden        — AI says it's not a sports venue at all
      organizer_only — venue confirmed but very little info (no type/surface/dims)
      public         — confirmed venue with meaningful data worth showing users
    """
    if result.get("is_verified_venue") is False:
        return "hidden"

    if not result.get("is_verified_venue"):
        # AI was uncertain (null) — keep existing visibility, don't downgrade
        return existing.get("map_visibility") or "organizer_only"

    # Venue confirmed — score how much useful info we have
    info_points = sum([
        bool(result.get("venue_type") and result.get("venue_type") != "other"),
        bool(result.get("surface") and result.get("surface") != "nieznana"),
        bool(result.get("dimensions_m")),
        bool(result.get("access_type") and result.get("access_type") != "unknown"),
        bool(result.get("condition") and result.get("condition") != "unknown"),
    ])

    # Also count existing metadata (phone/website already in DB)
    has_contact = bool(existing.get("phone") or existing.get("website") or existing.get("email"))

    if info_points >= 2 or has_contact:
        return "public"
    return "organizer_only"


# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------

async def fetch_fields(client: httpx.AsyncClient, process_all: bool, limit: int | None) -> list[dict]:
    url = f"{SUPABASE_URL}/rest/v1/fields"
    params: dict[str, Any] = {
        "select": "id,name,address,sport,lat,lng,surface,is_indoor,lit,has_changing_rooms,map_visibility,phone,website,email,image_url",
        "order": "id.asc",
    }
    if not process_all:
        params["venue_type"] = "is.null"
    if limit:
        params["limit"] = limit

    r = await client.get(url, headers=SUPABASE_HEADERS, params=params, timeout=30)
    r.raise_for_status()
    return r.json()


async def upsert_field(client: httpx.AsyncClient, field_id: str, update: dict) -> None:
    url = f"{SUPABASE_URL}/rest/v1/fields"
    r = await client.patch(
        url,
        headers=SUPABASE_HEADERS,
        params={"id": f"eq.{field_id}"},
        json=update,
        timeout=15,
    )
    r.raise_for_status()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def process_field(
    http: httpx.AsyncClient,
    field: dict,
    dry_run: bool,
    overwrite: bool,
    save_images: bool,
    sem: asyncio.Semaphore,
) -> None:
    async with sem:
        fid   = field["id"]
        fname = field.get("name", fid)
        lat, lng = field.get("lat"), field.get("lng")

        if not lat or not lng:
            log.warning("Skip %s — no coordinates", fname)
            return

        if not MAPBOX_TOKEN:
            log.error("MAPBOX_TOKEN not set — cannot fetch satellite images")
            return

        log.info("Analysing: %s", fname)

        sat_url   = mapbox_satellite_url(lat, lng)
        img_bytes = await fetch_satellite_bytes(http, sat_url)
        if not img_bytes:
            log.warning("Skip %s — satellite image unavailable", fname)
            return

        img_b64 = base64.b64encode(img_bytes).decode()

        result = await analyse_with_claude(http, img_b64, field)
        if not result:
            log.warning("Skip %s — Claude returned no result", fname)
            return

        update = build_update(result, field, overwrite)

        # Upload satellite image to Supabase Storage.
        # Only overwrite existing image_url when --overwrite or when it's not set.
        if save_images and not dry_run:
            has_image = bool(field.get("image_url"))
            if overwrite or not has_image:
                sat_storage_url = await upload_satellite_image(http, fid, img_bytes)
                if sat_storage_url:
                    update["image_url"] = sat_storage_url
                    log.info("  ↑ Uploaded satellite image")

        if dry_run:
            print(f"\n{'='*60}")
            print(f"Field: {fname} ({fid})")
            print(f"Satellite: {sat_url}")
            print(f"Claude result: {json.dumps(result, ensure_ascii=False, indent=2)}")
            print(f"Would write: {json.dumps(update, ensure_ascii=False, indent=2)}")
            if save_images:
                print(f"Would upload image to: {SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET}/{fid}.jpg")
        else:
            await upsert_field(http, fid, update)
            verified = result.get("is_verified_venue")
            vtype    = result.get("venue_type", "?")
            surface  = result.get("surface", "?")
            dims     = result.get("dimensions_m", "?")
            access   = result.get("access_type", "?")
            sports   = ",".join(result.get("sports") or []) or "?"
            log.info(
                "  → %s | %s | %s | sports=[%s] | %s | access=%s | verified=%s",
                vtype, surface, dims, sports, fname, access, verified,
            )


async def main() -> None:
    ap = argparse.ArgumentParser(description="Analyse venue satellite images with Claude")
    ap.add_argument("--limit",     type=int,  default=None, help="Max venues to process")
    ap.add_argument("--dry-run",   action="store_true",     help="Print results, write nothing")
    ap.add_argument("--all",       action="store_true",     help="Re-process already-typed venues")
    ap.add_argument("--overwrite", action="store_true",     help="Overwrite existing surface/is_indoor/lit/has_changing_rooms")
    ap.add_argument("--concurrency", type=int, default=1,   help="Parallel Claude requests (default 1; increase carefully to avoid 429s)")
    ap.add_argument("--model",       type=str,  default=None, help="Claude model override (default: claude-sonnet-4-6)")
    ap.add_argument("--save-images", action="store_true",    help=f"Upload satellite images to Supabase Storage (bucket: {STORAGE_BUCKET})")
    args = ap.parse_args()

    if args.model:
        global MODEL  # noqa: PLW0603
        MODEL = args.model

    if not MAPBOX_TOKEN:
        sys.exit("ERROR: MAPBOX_TOKEN / NEXT_PUBLIC_MAPBOX_TOKEN not set")

    async with httpx.AsyncClient() as http:
        fields = await fetch_fields(http, args.all, args.limit)
        log.info("Fetched %d venues to process", len(fields))
        if not fields:
            log.info("Nothing to do.")
            return

        sem = asyncio.Semaphore(args.concurrency)
        tasks = [
            process_field(http, f, args.dry_run, args.overwrite, args.save_images, sem)
            for f in fields
        ]
        await asyncio.gather(*tasks)

    log.info("Done.")


if __name__ == "__main__":
    asyncio.run(main())
