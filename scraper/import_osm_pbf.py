"""
Bojo — import boisk z pliku OpenStreetMap (.osm.pbf)
====================================================

Dlaczego nie Overpass. Overpass dla całego województwa (a tym bardziej kraju)
kończy się timeoutem albo banem. Geofabrik wystawia gotowe wycinki regionalne,
które pobiera się raz i przetwarza lokalnie — bez limitów i bez opłat.

Co ten import robi lepiej niż `scraper.py`:

  1. NAZWY. Poligon boiska rzadko ma tag `name`, więc dotąd powstawało
     „Boisko — piłka nożna" i mapa robiła się nieczytelna. Tutaj nazwa bierze się
     ze ZŁĄCZENIA PRZESTRZENNEGO: sprawdzamy, w czym boisko leży (ośrodek sportu,
     szkoła, klub) i budujemy nazwę z kontekstu — „SP nr 12 — boisko piłkarskie, Świdnik".
  2. MIEJSCOWOŚĆ w adresie. Bez niej „ul. Szkolna" powtarza się w każdej gminie
     i wygląda jak duplikat (patrz audyt: 12× „ul. Poznańska"). W NAZWIE jej nie
     ma — karta obiektu pokazuje nazwę i adres pod sobą, więc miejscowość
     w obu dawała to samo słowo dwa razy.
  3. WYMIARY z geometrii poligonu — mierzone, nie zgadywane ze zdjęcia.
  4. ZERO AI. Sport i nawierzchnia pochodzą z tagów OSM albo ich nie ma.

Wynik trafia do tabeli `fields` z `source='osm'` i `external_id='osm:way/123'`,
czyli tym samym kluczem co `scraper.py` — ponowny import aktualizuje wiersz
zamiast tworzyć duplikat.

Uruchomienie:
    pip install -r requirements.txt
    python import_osm_pbf.py --region lubelskie --dry-run     # sam raport
    python import_osm_pbf.py --region lubelskie               # zapis do bazy

Wymagane zmienne (tylko przy zapisie):
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""

from __future__ import annotations

import argparse
import logging
import math
import os
import time
import sys
from collections import Counter
from dataclasses import dataclass, field as dc_field
from typing import Any

import httpx
import osmium
from shapely.geometry import Polygon, Point
from shapely.strtree import STRtree

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("import-osm")

GEOFABRIK = "https://download.geofabrik.de/europe/poland/{region}-latest.osm.pbf"
# Zapasowe źródło tych samych wycinków. Geofabrik potrafi oddać 502 na kilka
# minut i bez tego cały przebieg leci do kosza na pierwszym błędzie.
LUSTRO_OSMFR = "https://download.openstreetmap.fr/extracts/europe/poland/{region}.osm.pbf"
PROBY_POBRANIA = 4


class NieTenPlik(Exception):
    """Serwer odpowiedział, ale nie plikiem OSM PBF.

    Wydzielone z ogólnych błędów, bo ponawianie nic tu nie da: zła nazwa
    regionu nie stanie się dobra za piątym pobraniem. Przerywamy dane źródło
    od razu i przechodzimy do następnego — tak samo jak przy 404.
    """

# Nazwy wycinków Geofabrik dla polskich województw — bez polskich znaków
# i bez „województwo". Literówka kończy się 404 po pobraniu 0 bajtów, więc
# lepiej odrzucić ją od razu, z podpowiedzią.
WOJEWODZTWA = [
    "dolnoslaskie", "kujawsko-pomorskie", "lubelskie", "lubuskie",
    "lodzkie", "malopolskie", "mazowieckie", "opolskie",
    "podkarpackie", "podlaskie", "pomorskie", "slaskie",
    "swietokrzyskie", "warminsko-mazurskie", "wielkopolskie",
    "zachodniopomorskie",
]

# ---------------------------------------------------------------------------
# Słowniki — te same wartości co w scraper.py, żeby baza była spójna
# ---------------------------------------------------------------------------

TEAM_SPORTS = {
    # Kanoniczny tag OSM dla plażówki to `beachvolleyball` — JEDNYM SŁOWEM.
    # Wariant `beach_volleyball` też się w danych zdarza, ale jest rzadszy.
    # Dopóki lista znała tylko ten drugi, boisko otagowane kanonicznie nie
    # przechodziło filtru sportów zespołowych i wypadało z importu w całości —
    # nie „bez etykiety", tylko w ogóle.
    "soccer", "football", "basketball", "volleyball",
    "beachvolleyball", "beach_volleyball",
    "futsal", "handball", "team_handball", "rugby", "hockey", "field_hockey",
    "ice_hockey", "american_football", "baseball", "cricket", "multi",
}

OSM_SPORT_MAP = {
    "soccer": "piłka nożna", "football": "piłka nożna", "basketball": "koszykówka",
    "volleyball": "siatkówka",
    "beachvolleyball": "siatkówka plażowa", "beach_volleyball": "siatkówka plażowa",
    "futsal": "futsal", "handball": "piłka ręczna", "team_handball": "piłka ręczna",
    "rugby": "rugby", "hockey": "hokej", "field_hockey": "hokej na trawie",
    "ice_hockey": "hokej", "american_football": "futbol amerykański",
    "baseball": "baseball", "cricket": "krykiet", "multi": "wielofunkcyjne",
}

SURFACE_MAP = {
    "grass": "grass", "natural_grass": "grass",
    "artificial": "artificial", "artificial_turf": "artificial",
    "artifical_turf": "artificial", "astroturf": "artificial", "synthetic": "artificial",
    "tartan": "hardcourt", "rubber": "hardcourt", "wood": "hardcourt",
    "asphalt": "concrete", "concrete": "concrete", "compacted": "concrete",
    "paving_stones": "concrete",
    "clay": "clay", "sand": "sand",
}

SPORT_NOUN = {
    "piłka nożna": "Boisko piłkarskie",
    "futsal": "Boisko do futsalu",
    "koszykówka": "Boisko do koszykówki",
    "siatkówka": "Boisko do siatkówki",
    "siatkówka plażowa": "Boisko do siatkówki plażowej",
    "piłka ręczna": "Boisko do piłki ręcznej",
    "wielofunkcyjne": "Boisko wielofunkcyjne",
}

# Tagi, po których poznajemy obiekt nadający nazwę. Kolejność = priorytet.
CONTEXT_KINDS = [
    ("osrodek", lambda t: t.get("leisure") in ("sports_centre", "stadium")
                          or t.get("amenity") == "sports_centre"),
    ("klub",    lambda t: t.get("club") == "sport"),
    ("szkola",  lambda t: t.get("amenity") in ("school", "college", "university", "kindergarten")),
]

PLACE_RANK = {"city": 0, "town": 1, "village": 2, "hamlet": 3, "suburb": 4}


@dataclass
class RawObj:
    osm_id: str
    tags: dict[str, str]
    coords: list[tuple[float, float]] = dc_field(default_factory=list)
    lat: float | None = None
    lng: float | None = None
    # Metadane wpisu w OSM — nie tagi, tylko właściwości obiektu. Są w pliku
    # i nic nie kosztują, a mówią o tym, jak pilnowany jest ten wpis.
    edytowano: str | None = None
    wersja: int | None = None


# Obiekty w otoczeniu, do których liczymy odległość. Promień w metrach dobrany
# tak, żeby odpowiedź brzmiała „przy boisku", a nie „gdzieś w tej dzielnicy".
OTOCZENIE = {
    "parking":  (lambda t: t.get("amenity") == "parking", 250),
    "przystanek": (lambda t: t.get("highway") == "bus_stop"
                             or t.get("railway") in ("tram_stop", "station", "halt")
                             or t.get("public_transport") == "platform", 500),
    "toaleta":  (lambda t: t.get("amenity") == "toilets", 200),
}


class Collector(osmium.SimpleHandler):
    """Jedno przejście po pliku — zbiera boiska, kontekst i miejscowości."""

    def __init__(self) -> None:
        super().__init__()
        self.pitches: list[RawObj] = []
        self.contexts: list[RawObj] = []
        self.places: list[RawObj] = []
        # rodzaj -> lista (lat, lng)
        self.otoczenie: dict[str, list[tuple[float, float]]] = {k: [] for k in OTOCZENIE}

    def _is_pitch(self, t: dict[str, str]) -> bool:
        return (t.get("leisure") in ("pitch", "sports_centre", "stadium", "sports_hall")
                or t.get("building") == "sports_hall")

    def _is_context(self, t: dict[str, str]) -> bool:
        return bool(t.get("name")) and any(pred(t) for _, pred in CONTEXT_KINDS)

    def _zbierz_otoczenie(self, t: dict[str, str], lat: float, lng: float) -> None:
        for rodzaj, (pasuje, _) in OTOCZENIE.items():
            if pasuje(t):
                self.otoczenie[rodzaj].append((lat, lng))
                return

    def node(self, n) -> None:
        t = dict(n.tags)
        if t.get("place") in PLACE_RANK and t.get("name"):
            self.places.append(RawObj(f"node/{n.id}", t, lat=n.location.lat, lng=n.location.lon))
        elif self._is_pitch(t):
            self.pitches.append(RawObj(
                f"node/{n.id}", t, lat=n.location.lat, lng=n.location.lon,
                edytowano=n.timestamp.isoformat() if n.timestamp else None,
                wersja=n.version,
            ))
        else:
            self._zbierz_otoczenie(t, n.location.lat, n.location.lon)

    def way(self, w) -> None:
        t = dict(w.tags)
        is_pitch, is_ctx = self._is_pitch(t), self._is_context(t)
        if not (is_pitch or is_ctx):
            # Parking bywa rysowany wielokątem, nie punktem — bez tego liczyliby­śmy
            # odległość tylko do tych nielicznych oznaczonych kropką.
            if any(pasuje(t) for pasuje, _ in OTOCZENIE.values()):
                try:
                    pkt = [(nd.location.lon, nd.location.lat) for nd in w.nodes if nd.location.valid()]
                except osmium.InvalidLocationError:
                    return
                if len(pkt) >= 3:
                    lat, lng = centroid(pkt)
                    self._zbierz_otoczenie(t, lat, lng)
            return
        try:
            coords = [(nd.location.lon, nd.location.lat) for nd in w.nodes if nd.location.valid()]
        except osmium.InvalidLocationError:
            return
        if len(coords) < 3:
            return
        obj = RawObj(
            f"way/{w.id}", t, coords=coords,
            edytowano=w.timestamp.isoformat() if w.timestamp else None,
            wersja=w.version,
        )
        # Kontekst ma pierwszeństwo: kompleks sportowy bywa otagowany jednocześnie
        # jako sports_centre (kontekst) i pitch — wtedy jest nazwą dla boisk w środku.
        (self.contexts if is_ctx else self.pitches).append(obj)


def centroid(coords: list[tuple[float, float]]) -> tuple[float, float]:
    lon = sum(c[0] for c in coords) / len(coords)
    lat = sum(c[1] for c in coords) / len(coords)
    return lat, lon


def odleglosc_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Odległość w metrach między dwoma punktami (lat, lng)."""
    m_lat = 111_320.0
    m_lng = m_lat * math.cos(math.radians(a[0]))
    return math.hypot((a[1] - b[1]) * m_lng, (a[0] - b[0]) * m_lat)


def dimensions_m(poly: Polygon, lat: float) -> str | None:
    """Wymiary z najmniejszego prostokąta opisanego na poligonie — POMIAR,
    nie ocena ze zdjęcia satelitarnego."""
    try:
        rect = poly.minimum_rotated_rectangle
        xs, ys = rect.exterior.coords.xy
        pts = list(zip(xs, ys))[:4]
        m_per_deg_lat = 111_320.0
        m_per_deg_lon = m_per_deg_lat * math.cos(math.radians(lat))

        def dist(a, b):
            dx = (a[0] - b[0]) * m_per_deg_lon
            dy = (a[1] - b[1]) * m_per_deg_lat
            return math.hypot(dx, dy)

        a, b = dist(pts[0], pts[1]), dist(pts[1], pts[2])
        long_s, short_s = max(a, b), min(a, b)
        if short_s < 8 or long_s > 200:  # nie boisko zespołowe
            return None
        return f"{round(long_s)}×{round(short_s)}"
    except Exception:
        return None


def _stem(word: str) -> str:
    """Prymitywny rdzeń słowa — do porównywania nazw mimo polskiej odmiany.
    „Kolonii" i „Kolonia" mają wspólne 6 znaków, „Włodawie" i „Włodawa" też."""
    return word.lower().strip(" ,.-")[:6]


def locality_already_in(base: str, locality: str) -> bool:
    """Czy miejscowość już siedzi w nazwie — choćby w innym przypadku.
    Bez tego powstaje „Szkoła Podstawowa w Kolonii Sitno …, Kolonia Sitno"."""
    base_stems = {_stem(w) for w in base.split() if len(w) >= 4}
    loc_words = [w for w in locality.split() if len(w) >= 4]
    if not loc_words:
        return locality.lower() in base.lower()
    return all(_stem(w) in base_stems for w in loc_words)


def sports_pl(tags: dict[str, str]) -> list[str] | None:
    raw = (tags.get("sport") or "").replace(",", ";").split(";")
    raw = [s.strip().lower() for s in raw if s.strip()]
    team = [s for s in raw if s in TEAM_SPORTS]
    if not team:
        return None
    out = list(dict.fromkeys(OSM_SPORT_MAP.get(s, "inne") for s in team))

    # `sport=volleyball` + `surface=sand` to w praktyce plażówka. Mapper często
    # opisuje piach nawierzchnią zamiast osobnym tagiem sportu, a dla gracza
    # różnica jest zasadnicza: na piachu gra się czwórkami albo dwójkami.
    # Wnioskujemy tylko z nawierzchni — nic tu nie zgaduje AI.
    if "siatkówka" in out and "siatkówka plażowa" not in out:
        if SURFACE_MAP.get((tags.get("surface") or "").strip().lower()) == "sand":
            out = ["siatkówka plażowa" if s == "siatkówka" else s for s in out]

    return out


def build_name(tags: dict[str, str], sports: list[str] | None,
               ctx: RawObj | None, ctx_kind: str | None, locality: str | None) -> tuple[str, str]:
    """Zwraca (nazwa, źródło_nazwy). Drabinka priorytetów — patrz nagłówek pliku.

    MIEJSCOWOŚĆ NIE WCHODZI DO NAZWY. Wchodziła do 2026-08, żeby „Boisko
    piłkarskie" nie powtarzało się w każdej gminie — ale w interfejsie karta
    obiektu pokazuje nazwę I adres, a adres zaczyna się właśnie od miejscowości.
    Wychodziło „Boisko do siatkówki, Kozanów" nad „Kozanów", czyli to samo słowo
    dwa razy pod sobą. Rozróżnianie obiektów zostaje przy adresie, gdzie i tak
    było.

    `locality` zostaje w sygnaturze, bo nadal decyduje o bramce publikacji
    („szeroka" wymaga miejscowości) i o adresie.
    """
    own = (tags.get("name") or "").strip()
    if own:
        return own, "wlasna"

    noun = SPORT_NOUN.get(sports[0], "Boisko sportowe") if sports else "Boisko sportowe"

    if ctx is not None:
        # Wszędzie ten sam wzorzec „Nazwa — rzeczownik", bo polski wymagałby
        # odmiany: „boisko przy Szkoła Podstawowa nr 12" zgrzyta, a odmienianie
        # dowolnych nazw własnych to studnia bez dna.
        return f"{ctx.tags['name'].strip()} — {noun.lower()}", f"kontekst:{ctx_kind}"

    operator = (tags.get("operator") or "").strip()
    if operator:
        return f"{noun} — {operator}", "operator"

    street = (tags.get("addr:street") or "").strip()
    if street:
        return f"{noun}, ul. {street}", "ulica"
    return noun, ("miejscowosc" if locality else "brak")


def pobierz(region: str, path: str) -> None:
    """Ściąga wycinek OSM. Ponawia i sięga po lustro, zamiast padać na pierwszym błędzie.

    Geofabrik bywa chwilowo niedostępny (502/503). Bez ponowienia jeden taki
    moment kasuje cały przebieg importu — a przebieg dla województwa trwa
    kilkanaście minut i uruchamia się ręcznie.
    """
    zrodla = [
        ("Geofabrik", GEOFABRIK.format(region=region)),
        ("lustro openstreetmap.fr", LUSTRO_OSMFR.format(region=region)),
    ]
    ostatni_blad: Exception | None = None

    for nazwa, url in zrodla:
        for proba in range(1, PROBY_POBRANIA + 1):
            try:
                log.info("Pobieram %s (%s, próba %d/%d)", url, nazwa, proba, PROBY_POBRANIA)
                with httpx.stream("GET", url, follow_redirects=True, timeout=600) as r:
                    r.raise_for_status()

                    # Serwer odpowiada 200 także wtedy, gdy adres wskazuje coś
                    # zupełnie innego niż plik z danymi. Przy złej nazwie regionu
                    # Geofabrik oddaje listing katalogu w HTML — zapisany jako
                    # `.pbf` przechodzi dalej i wybucha dopiero w osmium
                    # komunikatem „invalid BlobHeader size", z którego nie da się
                    # odczytać, że chodziło o literówkę w nazwie.
                    typ = (r.headers.get("content-type") or "").lower()
                    if "html" in typ or "text/" in typ:
                        raise NieTenPlik(
                            f"{url} oddał {typ or 'treść tekstową'} zamiast pliku .pbf "
                            f"— najpewniej zła nazwa regionu"
                        )

                    # Zapis do pliku tymczasowego: przerwane pobranie nie może
                    # zostawić obciętego .pbf, który przy kolejnym uruchomieniu
                    # zostałby wzięty za gotowy (kod pomija pobieranie, gdy plik
                    # istnieje).
                    tmp = path + ".part"
                    with open(tmp, "wb") as fh:
                        for chunk in r.iter_bytes(1 << 20):
                            fh.write(chunk)

                    # Podpis pliku PBF: pierwszy blok nagłówkowy zawiera
                    # „OSMHeader" w pierwszych kilkudziesięciu bajtach. Tańsze
                    # i pewniejsze niż ufanie rozszerzeniu w adresie.
                    with open(tmp, "rb") as fh:
                        poczatek = fh.read(64)
                    if b"OSMHeader" not in poczatek:
                        rozmiar = os.path.getsize(tmp)
                        os.remove(tmp)
                        raise NieTenPlik(
                            f"{url} nie jest plikiem OSM PBF (pobrano {rozmiar} B, "
                            f"brak podpisu OSMHeader)"
                        )

                    os.replace(tmp, path)
                return
            except Exception as e:  # noqa: BLE001 — logujemy i próbujemy dalej
                ostatni_blad = e
                status = getattr(getattr(e, "response", None), "status_code", None)
                # 404 na lustrze znaczy „ten region nazywa się tam inaczej" —
                # ponawianie nic nie da, przechodzimy do następnego źródła.
                if status == 404 or isinstance(e, NieTenPlik):
                    log.warning("%s: %s — pomijam to źródło", nazwa,
                                "404" if status == 404 else e)
                    break
                czekaj = 5 * 2 ** (proba - 1)
                log.warning("%s: %s — czekam %ds", nazwa, e, czekaj)
                if proba < PROBY_POBRANIA:
                    time.sleep(czekaj)

    raise RuntimeError(
        f"Nie udało się pobrać wycinka dla regionu {region} z żadnego źródła. "
        f"Ostatni błąd: {ostatni_blad}"
    )


def main() -> int:
    ap = argparse.ArgumentParser(description="Import boisk z pliku .osm.pbf (Geofabrik)")
    ap.add_argument("--region", default="lubelskie",
                    help="województwo, nazwa wycinka Geofabrik: " + ", ".join(WOJEWODZTWA))
    ap.add_argument("--pbf", help="lokalny plik .osm.pbf zamiast pobierania")
    ap.add_argument("--dry-run", action="store_true", help="tylko raport, nic nie zapisuje")
    ap.add_argument("--limit", type=int, default=0, help="maks. obiektów do zapisu (0 = wszystkie)")
    ap.add_argument("--gate", default="srednia", choices=["waska", "srednia", "szeroka"],
                    help="jak szeroko publikować: waska (nazwa+nawierzchnia), "
                         "srednia (nazwa lub nawierzchnia), szeroka (wszystko z miejscowością)")
    ap.add_argument("--visibility", default="organizer_only",
                    choices=["organizer_only", "public"],
                    help="map_visibility dla obiektów, które NIE przejdą bramki jakości")
    args = ap.parse_args()

    if not args.pbf and args.region not in WOJEWODZTWA:
        log.error("Nieznany region: %s", args.region)
        log.error("Dostępne: %s", ", ".join(WOJEWODZTWA))
        return 1

    path = args.pbf
    if not path:
        url = GEOFABRIK.format(region=args.region)
        path = f"/tmp/{args.region}.osm.pbf"
        if not os.path.exists(path):
            pobierz(args.region, path)
        log.info("Plik: %s (%.0f MB)", path, os.path.getsize(path) / 1e6)

    log.info("Czytam plik — jedno przejście…")
    col = Collector()
    col.apply_file(path, locations=True)
    log.info("Znalezione: %d boisk, %d obiektów kontekstowych, %d miejscowości",
             len(col.pitches), len(col.contexts), len(col.places))

    # --- indeks przestrzenny kontekstu (offline, bez API) -------------------
    ctx_polys, ctx_meta = [], []
    for c in col.contexts:
        if len(c.coords) < 3:
            continue
        try:
            poly = Polygon(c.coords)
            if not poly.is_valid:
                poly = poly.buffer(0)
            if poly.is_empty:
                continue
        except Exception:
            continue
        kind = next((k for k, pred in CONTEXT_KINDS if pred(c.tags)), None)
        ctx_polys.append(poly)
        ctx_meta.append((c, kind))
    ctx_tree = STRtree(ctx_polys) if ctx_polys else None

    # Indeks otoczenia. Punkty trzymamy w stopniach, więc do wyszukania bierzemy
    # prostokąt przeliczony ze wskazanego promienia — dokładna odległość liczona
    # jest dopiero dla trafień, na haversinie.
    otoczenie_drzewa: dict[str, tuple[STRtree, list[tuple[float, float]], int]] = {}
    for rodzaj, punkty in col.otoczenie.items():
        if not punkty:
            continue
        promien = OTOCZENIE[rodzaj][1]
        geom = [Point(lng, lat) for lat, lng in punkty]
        otoczenie_drzewa[rodzaj] = (STRtree(geom), punkty, promien)
    log.info("Otoczenie: %s",
             ", ".join(f"{k}={len(v)}" for k, v in col.otoczenie.items()) or "brak")
    ctx_rank = {k: i for i, (k, _) in enumerate(CONTEXT_KINDS)}

    places = [p for p in col.places if p.lat is not None]

    def nearest_place(lat: float, lng: float) -> str | None:
        """Najbliższa miejscowość. Miasto wygrywa z wsią przy podobnej odległości —
        stąd waga z PLACE_RANK."""
        best, best_score = None, 1e9
        for p in places:
            dlat = (p.lat - lat) * 111.32
            dlng = (p.lng - lng) * 111.32 * math.cos(math.radians(lat))
            d = math.hypot(dlat, dlng)
            if d > 25:
                continue
            score = d * (1 + 0.35 * PLACE_RANK.get(p.tags.get("place", "village"), 3))
            if score < best_score:
                best, best_score = p, score
        return best.tags["name"] if best else None

    records: list[dict[str, Any]] = []
    # osm_id obiektu nadrzędnego dla każdego rekordu, w tej samej kolejności —
    # pozwala policzyć „ile boisk w tym kompleksie" po zbudowaniu całej listy.
    kontekst_rekordu: list[str | None] = []
    stats = Counter()

    for p in col.pitches:
        if p.coords:
            lat, lng = centroid(p.coords)
        elif p.lat is not None:
            lat, lng = p.lat, p.lng
        else:
            continue

        sports = sports_pl(p.tags)
        if not sports:
            stats["odrzucone: brak sportu zespołowego"] += 1
            continue

        # W czym to boisko leży
        ctx_obj, ctx_kind = None, None
        if ctx_tree is not None:
            pt = Point(lng, lat)
            for idx in ctx_tree.query(pt):
                poly = ctx_polys[idx]
                if not poly.contains(pt):
                    continue
                cand, kind = ctx_meta[idx]
                if kind is None or cand.osm_id == p.osm_id:
                    continue
                if ctx_obj is None or ctx_rank[kind] < ctx_rank[ctx_kind]:
                    ctx_obj, ctx_kind = cand, kind

        locality = (p.tags.get("addr:city") or "").strip() or nearest_place(lat, lng)
        name, name_src = build_name(p.tags, sports, ctx_obj, ctx_kind, locality)
        stats[f"nazwa: {name_src}"] += 1

        surface = SURFACE_MAP.get((p.tags.get("surface") or "").strip().lower())
        if surface:
            stats["ma nawierzchnię"] += 1
        if locality:
            stats["ma miejscowość"] += 1

        dims = None
        if p.coords:
            try:
                dims = dimensions_m(Polygon(p.coords), lat)
            except Exception:
                dims = None
        if dims:
            stats["ma wymiary z geometrii"] += 1

        # Dziedziczenie po obiekcie nadrzędnym. Samo boisko rzadko ma adres czy
        # telefon — to prostokąt na trawie. Ma je za to szkoła albo ośrodek,
        # W KTÓRYM TO BOISKO LEŻY, a ten obiekt już znamy ze złączenia
        # przestrzennego (`ctx_obj`) i dotąd braliśmy z niego wyłącznie nazwę.
        #
        # To NIE jest to samo, co dawne doklejanie kontaktów z „pobliskiego"
        # obiektu, które psuło dane w Poznaniu. Tam decydowała odległość, więc
        # boisko dostawało telefon sąsiada zza płotu. Tu warunkiem jest
        # zawieranie się w wielokącie: telefon do szkoły jest telefonem
        # w sprawie boiska tej szkoły.
        def tag(*keys: str) -> str:
            for src in (p.tags, ctx_obj.tags if ctx_obj else {}):
                for k in keys:
                    v = (src.get(k) or "").strip()
                    if v:
                        return v
            return ""

        street = tag("addr:street")
        house = tag("addr:housenumber")
        city = tag("addr:city")
        addr_parts = []
        if street:
            addr_parts.append(f"ul. {street} {house}".strip())
        if city or locality:
            addr_parts.append(city or locality)
        address = ", ".join(addr_parts) or None
        if street:
            stats["ma ulicę"] += 1
            if house:
                stats["ma numer domu"] += 1

        def yn(key: str) -> bool | None:
            v = (p.tags.get(key) or "").strip().lower()
            return True if v in ("yes", "true") else (False if v in ("no", "false") else None)

        # BRAMKA PUBLIKACJI. Zero udziału AI — decyduje wyłącznie to, co
        # realnie wiadomo z tagów OSM. Trzy poziomy do wyboru, bo dopiero
        # dane z regionu pokazują, gdzie leży sensowna granica.
        named = name_src == "wlasna" or name_src.startswith("kontekst")
        gates = {
            # tylko obiekty z nazwą instytucji I znaną nawierzchnią
            "waska":   named and surface is not None,
            # nazwa instytucji ALBO znana nawierzchnia
            "srednia": named or surface is not None,
            # wszystko, co ma sport zespołowy i miejscowość — czyli nazwę,
            # która odróżnia je od innych, oraz zweryfikowaną pozycję
            "szeroka": locality is not None,
        }
        for g, ok in gates.items():
            if ok:
                stats[f"bramka {g}"] += 1
        quality = gates[args.gate]

        # --- otoczenie: najbliższy parking, przystanek, toaleta ---
        blisko: dict[str, int | None] = {}
        for rodzaj, (drzewo, punkty, promien) in otoczenie_drzewa.items():
            # Prostokąt wyszukiwania z promienia — w stopniach, bo taka jest
            # geometria indeksu.
            d_lat = promien / 111_320.0
            d_lng = d_lat / max(0.2, math.cos(math.radians(lat)))
            trafienia = drzewo.query(
                Polygon([(lng - d_lng, lat - d_lat), (lng + d_lng, lat - d_lat),
                         (lng + d_lng, lat + d_lat), (lng - d_lng, lat + d_lat)])
            )
            naj = None
            for idx in trafienia:
                d = odleglosc_m((lat, lng), punkty[idx])
                if d <= promien and (naj is None or d < naj):
                    naj = d
            blisko[rodzaj] = round(naj) if naj is not None else None
            if naj is not None:
                stats[f"ma w pobliżu: {rodzaj}"] += 1

        # --- cechy wyciągnięte do osobnych kolumn (filtrowanie na mapie) ---
        zadaszone = yn("covered") or (p.tags.get("indoor") == "yes") or None
        rezerwacja = (p.tags.get("reservation") or "").strip().lower() or None
        operator_typ = (p.tags.get("operator:type") or "").strip().lower() or None
        kosze = p.tags.get("hoops")
        try:
            kosze_n = int(kosze) if kosze else None
        except ValueError:
            kosze_n = None
        sprawdzone = (p.tags.get("check_date") or p.tags.get("survey:date") or "").strip()[:10] or None

        # Nazwy potoczne — ludzie szukają „Orlik na Górczynie", nie nazwy
        # z tabliczki. Puste odsiewamy, duplikaty też.
        alternatywne = []
        for klucz in ("alt_name", "short_name", "official_name", "loc_name", "name:pl"):
            v = (p.tags.get(klucz) or "").strip()
            if v and v != p.tags.get("name") and v not in alternatywne:
                alternatywne.append(v)

        kontekst_rekordu.append(ctx_obj.osm_id if ctx_obj else None)
        records.append({
            "name": name[:120],
            "address": address,
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "sport": sports,
            "available": True,
            "surface": surface,
            "is_indoor": p.tags.get("leisure") == "sports_hall" or p.tags.get("building") == "sports_hall",
            "operator": tag("operator") or None,
            "website": tag("website", "contact:website") or None,
            # Telefonu nie zapisywaliśmy w ogóle, choć OSM go ma — przy szkołach
            # i ośrodkach sportu to najczęściej jedyny sposób, żeby dopytać
            # o dostępność boiska.
            "phone": tag("phone", "contact:phone", "contact:mobile") or None,
            "email": tag("email", "contact:email") or None,
            "opening_hours": tag("opening_hours") or None,
            "postcode": tag("addr:postcode") or None,
            "lit": yn("lit"),
            "access": (p.tags.get("access") or "").strip() or None,
            "fee": yn("fee"),
            "dimensions_m": dims,
            "map_visibility": "public" if quality else args.visibility,
            "source": "osm",
            "external_id": f"osm:{p.osm_id}",

            # Komplet tagów bez interpretacji — żeby nigdy więcej nie importować
            # ponownie całego kraju po to, by dołożyć jedno pole.
            "osm_tags": p.tags,
            "osm_updated_at": p.edytowano,
            "osm_version": p.wersja,
            "osm_checked_at": sprawdzone,

            "is_covered": zadaszone,
            "reservation": rezerwacja,
            "operator_kind": operator_typ,
            "hoops": kosze_n,
            "seasonal": (p.tags.get("seasonal") or "").strip().lower() or None,
            "surveillance": yn("surveillance"),
            "wheelchair": (p.tags.get("wheelchair") or "").strip().lower() or None,

            "parking_m": blisko.get("parking"),
            "transit_m": blisko.get("przystanek"),
            "toilets_m": blisko.get("toaleta"),
            # Uzupełniane po pętli — dopiero wtedy wiadomo, ile boisk
            # trafiło do tego samego obiektu nadrzędnego.
            "siblings": None,
            "alt_names": alternatywne or None,
        })

    # Ile boisk trafiło do tego samego obiektu nadrzędnego. Szkoła z trzema
    # boiskami to dziś trzy osobne pinezki bez związku — ta liczba pozwala
    # powiedzieć „kompleks 3 boisk".
    licznik_kontekstow = Counter(k for k in kontekst_rekordu if k)
    for rek, ktx in zip(records, kontekst_rekordu):
        rek["siblings"] = licznik_kontekstow.get(ktx) if ktx else None

    # --- raport --------------------------------------------------------------
    n = len(records)
    rejected = stats.pop("odrzucone: brak sportu zespołowego", 0)
    log.info("── RAPORT (%s) ─────────────────────────────", args.region)
    log.info("   obiektów w pliku:      %d", n + rejected)
    log.info("   odrzucone (sport indywidualny lub brak): %d", rejected)
    log.info("   boisk do importu:      %d", n)
    log.info("   ── z tego (%% liczony od importowanych) ──")
    for k in sorted(stats):
        pct = f"{round(100 * stats[k] / n)}%" if n else "—"
        log.info("   %-34s %5d  (%s)", k, stats[k], pct)
    log.info("   ── wybrana bramka: %s → %d obiektów publicznych ──",
             args.gate, stats.get(f"bramka {args.gate}", 0))

    log.info("── PRÓBKA 15 NAZW ──────────────────────────")
    for r in records[:15]:
        log.info("   %s | %s | %s | %s", r["name"], r["address"] or "—",
                 "+".join(r["sport"]), r["surface"] or "—")

    if args.dry_run:
        log.info("DRY RUN — nic nie zapisano.")
        return 0

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        log.error("Brak SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — nie mam gdzie zapisać.")
        return 1

    to_write = records[: args.limit] if args.limit else records
    endpoint = f"{url}/rest/v1/fields?on_conflict=source,external_id"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    written = 0
    with httpx.Client(timeout=120) as client:
        for i in range(0, len(to_write), 500):
            batch = to_write[i:i + 500]
            r = client.post(endpoint, json=batch, headers=headers)
            if r.status_code >= 300:
                log.error("Batch %d: HTTP %s — %s", i // 500, r.status_code, r.text[:400])
                return 1
            written += len(batch)
            log.info("   zapisano %d / %d", written, len(to_write))

    log.info("Gotowe: %d obiektów w bazie.", written)
    return 0


if __name__ == "__main__":
    sys.exit(main())
