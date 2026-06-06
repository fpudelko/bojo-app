"""
Boiska Poznań — Klasyfikator obiektów sportowych
=================================================
Ustawia map_visibility na podstawie danych z bazy:

  public         — boisko do sportu zespołowego z rezerwacją lub dobrymi danymi
  organizer_only — wygląda na boisko ale mało danych (warto sprawdzić)
  hidden         — niezwiązane z aplikacją (siłownia, bilard, basen…)
                   lub sama nazwa bez adresu i danych

Sporty obsługiwane przez aplikację (team sports):
  piłka nożna, futsal, koszykówka, siatkówka, siatkówka plażowa, piłka ręczna

Uruchomienie:
    python classify.py --dry-run       # pokaż co by się zmieniło
    python classify.py                 # zapisz zmiany
    python classify.py --limit 50      # tylko pierwsze 50
    python classify.py --reset-hidden  # nadpisz też już ukryte (domyślnie: pomija public/organizer_only)
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import re
from typing import Any

import httpx
from dotenv import load_dotenv
from enrich import _sb_headers  # reuse Supabase header helper

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("classify")

# ---------------------------------------------------------------------------
# Stałe klasyfikacji
# ---------------------------------------------------------------------------

TEAM_SPORTS = {
    "piłka nożna", "futsal", "koszykówka",
    "siatkówka", "siatkówka plażowa", "piłka ręczna",
}

# Słowa w nazwie / operatorze które niemal na pewno oznaczają "nie nasze"
_NON_SPORT = re.compile(
    r"\b(fitness|si[łl]owni[a-z]*|bilard[a-z]*|bowling|aqua|basen|p[lł]ywaln|"
    r"\bspa\b|sauna|golf|laser\s*tag|escape\s*room|paintball|kręgiel|"
    r"squash(?!\s*(i\s+)?si)|kino|restaur|kawiarni|pub\b|bar\b|hotel|"
    r"disco|klub\s*nocny|salon\s*(pięk|beauty)|fryzjer|dentysta)\b",
    re.I,
)

# Nazwy sugerujące boisko/wielofunkcyjność — pozytywny sygnał
_SPORT_HINT = re.compile(
    r"\b(orlik|boisko|hala|stadion|kort|kompleks\s+sport|centrum\s+sport|"
    r"obiekt\s+sport|osir|gosir|losir|posir|mcsir|mosir|cspp|ckf|awf|azs|"
    r"chwialka|golecin|rataje|malta|mos\b|miejski\s+o[sś]rodek)\b",
    re.I,
)


def _has_house_number(address: str | None) -> bool:
    if not address:
        return False
    # musi być cyfra po spacji lub bezpośrednio po literze (nr domu), ale nie sam kod pocztowy
    return bool(re.search(r"[a-ząćęłńóśźż]\s*\d|^\d|\s\d+[a-z]?\s*,", address, re.I))


def classify(field: dict[str, Any], outreach: dict[str, Any]) -> tuple[str, str, int]:
    """Zwraca (visibility, category_label, score)."""
    name      = (field.get("name") or "").strip()
    address   = field.get("address") or ""
    sports    = field.get("sport") or []
    phone     = field.get("phone") or ""
    website   = field.get("website") or ""
    email     = field.get("email") or ""
    operator  = field.get("operator") or ""
    desc      = field.get("description") or ""
    booking_url = field.get("booking_url") or outreach.get("booking_url") or ""
    booking_sys = outreach.get("booking_system") or "nieznany"
    ai_summary  = outreach.get("ai_summary") or ""

    text_blob = f"{name} {operator} {desc} {ai_summary}".lower()

    # ── Natychmiastowe hidden ──────────────────────────────────────────────
    if _NON_SPORT.search(text_blob) and not any(s in TEAM_SPORTS for s in sports):
        return "hidden", "niezwiązane", 0

    # ── Punktacja ──────────────────────────────────────────────────────────
    score = 0

    has_team_sport = any(s in TEAM_SPORTS for s in sports)
    is_generic_sport = not sports or all(s in ("wielofunkcyjne", "inne") for s in sports)

    if has_team_sport:
        score += 4
    elif is_generic_sport:
        # wielofunkcyjne może mieć sporty zespołowe — sprawdź hinta w nazwie
        if _SPORT_HINT.search(text_blob):
            score += 2  # prawdopodobne boisko
        else:
            score += 0  # nieznane

    if booking_url:
        score += 3
    elif booking_sys in ("wlasny_system", "zewnetrzny"):
        score += 2
    elif booking_sys in ("telefon", "email"):
        score += 1

    if phone:
        score += 1
    if website:
        score += 1
    if email:
        score += 1
    if _has_house_number(address):
        score += 1
    if operator:
        score += 1
    if ai_summary:
        score += 1  # był już enrichowany — mamy jakieś dane

    # Kara: generyczne sport + brak wszystkiego
    if is_generic_sport and not phone and not website and not booking_url:
        score -= 2

    # ── Decyzja ───────────────────────────────────────────────────────────
    if score >= 7:
        return "public", "pewniaki", score          # team sport + rezerwacja
    if score >= 5:
        return "public", "pewne", score             # team sport + dane kontaktowe
    if score >= 3:
        return "organizer_only", "sprawdzic", score # coś jest ale mało
    if score >= 1:
        return "organizer_only", "slabe", score     # generyczne, brak danych
    return "hidden", "ukryte", score


# ---------------------------------------------------------------------------
# Supabase
# ---------------------------------------------------------------------------

async def load_data(
    client: httpx.AsyncClient, base: str, key: str,
) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    r = await client.get(
        f"{base}/rest/v1/fields",
        headers=_sb_headers(key),
        params={"select": "id,name,address,sport,phone,email,website,operator,description,booking_url,map_visibility", "limit": "10000"},
    )
    r.raise_for_status()
    fields = r.json()

    r2 = await client.get(
        f"{base}/rest/v1/field_outreach",
        headers=_sb_headers(key),
        params={"select": "field_id,booking_system,booking_url,ai_summary"},
    )
    r2.raise_for_status()
    outreach = {row["field_id"]: row for row in r2.json()}
    return fields, outreach


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def run(args: argparse.Namespace) -> None:
    load_dotenv()
    base = os.getenv("SUPABASE_URL", "").rstrip("/")
    key  = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not (base and key):
        log.error("Ustaw SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY"); return

    async with httpx.AsyncClient() as client:
        fields, outreach = await load_data(client, base, key)
        log.info("Wczytano %d obiektów + %d wpisów outreach", len(fields), len(outreach))

        if args.limit:
            fields = fields[: args.limit]

        counts: dict[str, int] = {"public": 0, "organizer_only": 0, "hidden": 0, "skip": 0}
        categories: dict[str, int] = {}
        patches: list[tuple[str, str]] = []  # (id, new_visibility)

        for f in fields:
            current = f.get("map_visibility") or "public"
            o = outreach.get(f["id"], {})
            new_vis, cat, score = classify(f, o)

            categories[cat] = categories.get(cat, 0) + 1

            # Nie nadpisuj jeśli admin już ręcznie ustawił (chyba że --reset)
            if current != "public" and not args.reset:
                counts["skip"] += 1
                log.debug("skip %s (already %s)", f.get("name", "?")[:40], current)
                continue

            if new_vis == current and not args.reset:
                counts["skip"] += 1
                continue

            counts[new_vis] += 1
            patches.append((f["id"], new_vis))
            log.info(
                "[%s→%s sc=%d cat=%s] %s | sport=%s | %s",
                current, new_vis, score, cat,
                (f.get("name") or "?")[:40],
                ",".join(f.get("sport") or [])[:25],
                (f.get("address") or "brak adresu")[:40],
            )

        log.info("─" * 64)
        log.info("Kategorie: %s", " · ".join(f"{k}={v}" for k, v in sorted(categories.items())))
        log.info(
            "Zmiany: public=%d organizer_only=%d hidden=%d pominięto=%d%s",
            counts["public"], counts["organizer_only"], counts["hidden"], counts["skip"],
            " (DRY RUN — nic nie zapisano)" if args.dry_run else "",
        )

        if args.dry_run or not patches:
            return

        # Batch update (Supabase nie obsługuje bulk patch po liście ID, robimy IN)
        # Grupuj po nowej wartości visibility
        by_vis: dict[str, list[str]] = {}
        for fid, vis in patches:
            by_vis.setdefault(vis, []).append(fid)

        for vis, ids in by_vis.items():
            # Supabase: id=in.(id1,id2,...)
            r = await client.patch(
                f"{base}/rest/v1/fields",
                headers=_sb_headers(key, {"Prefer": "return=minimal"}),
                params={"id": f"in.({','.join(ids)})"},
                json={"map_visibility": vis},
            )
            if r.status_code not in (200, 204):
                log.error("Bulk patch %s failed %s: %s", vis, r.status_code, r.text[:200])
            else:
                log.info("Ustawiono %s dla %d obiektów", vis, len(ids))


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Klasyfikuje map_visibility obiektów sportowych")
    p.add_argument("--dry-run", action="store_true", help="pokaż zmiany, nic nie zapisuj")
    p.add_argument("--limit",   type=int, default=0, help="max obiektów (0 = wszystkie)")
    p.add_argument("--reset",   action="store_true",
                   help="nadpisz też obiekty które mają już ustawioną visibility (domyślnie: tylko 'public')")
    return p.parse_args()


if __name__ == "__main__":
    asyncio.run(run(parse_args()))
