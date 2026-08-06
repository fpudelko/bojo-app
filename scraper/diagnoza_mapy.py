"""
Bojo — Diagnoza mapy (tylko odczyt)
===================================
Odtwarza zapytanie, którym `/mapa` pobiera obiekty (`getExplorerFields()`
w `frontend/src/lib/api.ts`), i pokazuje lejek: ile obiektów odpada na
którym warunku. Miejsce, w którym liczba spada do zera, to przyczyna
„zaimportowałem, a na mapie pusto".

Skrypt NICZEGO nie zapisuje — wyłącznie GET-y do PostgREST. Powstał po to,
żeby diagnostykę dało się uruchomić z GitHub Actions (gdzie klucze już są
w sekretach) zamiast przeklejać wyniki SQL ręcznie.

Użycie:
    python diagnoza_mapy.py                        # lubelskie
    python diagnoza_mapy.py --bbox 51.7,52.6,16.4,17.4   # wielkopolskie
    python diagnoza_mapy.py --bbox ''              # cała baza, bez prostokąta
"""

from __future__ import annotations

import argparse
import logging
import os
import sys

import httpx
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger("diagnoza")

# Musi się zgadzać z EXPLORER_SPORTS w frontend/src/lib/api.ts
EXPLORER_SPORTS = [
    "piłka nożna",
    "futsal",
    "siatkówka",
    "siatkówka plażowa",
    "koszykówka",
    "piłka ręczna",
]

# lubelskie z grubsza — ten sam prostokąt co supabase/publikuj-lubelskie.sql
BBOX_LUBELSKIE = (50.20, 52.30, 21.50, 24.20)


def env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        log.error("Brak zmiennej środowiskowej %s", name)
        sys.exit(1)
    return value.rstrip("/") if name.endswith("URL") else value


def count(client: httpx.Client, params: list[tuple[str, str]]) -> int:
    """Liczba wierszy pasujących do filtrów — z nagłówka Content-Range."""
    r = client.get(
        "/rest/v1/fields",
        params=params + [("select", "id"), ("limit", "1")],
        headers={"Prefer": "count=exact"},
    )
    r.raise_for_status()
    # Content-Range: 0-0/1797
    return int(r.headers["content-range"].split("/")[-1])


def sport_filter() -> tuple[str, str]:
    """PostgREST: sport=ov.{"a","b"} — odpowiednik .overlaps() z JS."""
    quoted = ",".join(f'"{s}"' for s in EXPLORER_SPORTS)
    return ("sport", f"ov.{{{quoted}}}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--bbox",
        default=",".join(str(v) for v in BBOX_LUBELSKIE),
        help="lat_min,lat_max,lng_min,lng_max — puste = cała baza",
    )
    ap.add_argument("--source", default="osm", help="filtr source (puste = dowolny)")
    args = ap.parse_args()

    url = env("SUPABASE_URL")
    key = env("SUPABASE_SERVICE_ROLE_KEY")

    client = httpx.Client(
        base_url=url,
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        timeout=60.0,
    )

    box: list[tuple[str, str]] = []
    label_box = "cała baza"
    if args.bbox.strip():
        lat_min, lat_max, lng_min, lng_max = (float(v) for v in args.bbox.split(","))
        box = [
            ("lat", f"gte.{lat_min}"),
            ("lat", f"lte.{lat_max}"),
            ("lng", f"gte.{lng_min}"),
            ("lng", f"lte.{lng_max}"),
        ]
        label_box = f"prostokąt {lat_min}–{lat_max} N × {lng_min}–{lng_max} E"

    has_coords = [("lat", "not.is.null"), ("lng", "not.is.null")]
    src = [("source", f"eq.{args.source}")] if args.source.strip() else []

    steps: list[tuple[str, list[tuple[str, str]]]] = [
        (f"1. w zasięgu ({label_box})", box),
        ("2. + ma współrzędne", box + has_coords),
        (f"3. + source = {args.source or 'dowolny'}", box + has_coords + src),
        ("4. + map_visibility = public", box + has_coords + src + [("map_visibility", "eq.public")]),
        (
            "5. + sport z listy mapy  ← TO WIDZI MAPA",
            box + has_coords + src + [("map_visibility", "eq.public"), sport_filter()],
        ),
    ]

    log.info("== LEJEK ==")
    previous: int | None = None
    for label, params in steps:
        n = count(client, params)
        drop = "" if previous is None else f"   (odpadło {previous - n})"
        log.info("%-48s %6d%s", label, n, drop)
        previous = n

    log.info("")
    log.info("== KONTEKST ==")
    log.info(
        "obiektów widocznych na mapie w całej Polsce:      %6d",
        count(client, has_coords + [("map_visibility", "eq.public"), sport_filter()]),
    )
    log.info(
        "obiektów z source=osm w całej bazie:              %6d",
        count(client, [("source", "eq.osm")]),
    )

    # Rozkład sportów w prostokącie — pokazuje, czy import nie wpisał
    # wartości spoza listy mapy (np. „wielofunkcyjne").
    log.info("")
    log.info("== SPORTY W ZASIĘGU (top) ==")
    r = client.get(
        "/rest/v1/fields",
        params=box + has_coords + src + [("select", "sport"), ("limit", "5000")],
    )
    r.raise_for_status()
    tally: dict[str, int] = {}
    for row in r.json():
        for s in row.get("sport") or ["(brak)"]:
            tally[s] = tally.get(s, 0) + 1
    for s, n in sorted(tally.items(), key=lambda kv: -kv[1]):
        mark = "✓" if s in EXPLORER_SPORTS else "✗ poza listą mapy"
        log.info("%-28s %6d  %s", s, n, mark)


if __name__ == "__main__":
    main()
