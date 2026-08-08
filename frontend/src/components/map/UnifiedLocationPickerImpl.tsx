'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import MapAttribution from './MapAttribution';
import ClusteredFieldMarkers from './ClusteredFieldMarkers';
import LocateMeButton from './LocateMeButton';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, Loader2 } from 'lucide-react';
import type { Field } from '@/types';
import { getExplorerFields, searchExplorerFields, type Kadr } from '@/lib/api';
import { sportLabel } from '@/lib/sports';
import KadrObserwator from './KadrObserwator';
import { POZNAN } from './mapIcons';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const customIcon = L.divIcon({
  html: `<div style="display:flex;flex-direction:column;align-items:center;width:28px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.35))">
    <div style="width:26px;height:26px;border-radius:50%;background:#fff;border:2.5px solid #15803d;display:flex;align-items:center;justify-content:center">
      <span style="font-size:13px;line-height:1">📍</span>
    </div>
    <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid #15803d;margin-top:-1px"></div>
  </div>`,
  className: '',
  iconSize: [28, 33],
  iconAnchor: [14, 33],
});

function MapClickHandler({ onCustom }: { onCustom: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onCustom(e.latlng.lat, e.latlng.lng) });
  return null;
}

function CustomPin({ lat, lng }: { lat: number; lng: number }) {
  const map = useMapEvents({});
  const ref = useRef<L.Marker | null>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.setLatLng([lat, lng]);
    } else {
      ref.current = L.marker([lat, lng], { icon: customIcon }).addTo(map);
    }
    return () => {
      if (ref.current) { map.removeLayer(ref.current); ref.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);
  return null;
}

/** Wypuszcza instancję mapy na zewnątrz `<MapContainer>` — `LocateMeButton`
 *  dostaje ją propem, a musi stać poza kontenerem mapy. */
function ChwytMapy({ onMapa }: { onMapa: (m: L.Map) => void }) {
  const map = useMap();
  useEffect(() => { onMapa(map); }, [map, onMapa]);
  return null;
}

/** Dosuwa widok do wyników szukania.
 *
 *  Bez tego wpisanie nazwy boiska spoza kadru wyglądało jak brak reakcji:
 *  zbiór pinezek się podmieniał, ale mapa stała w miejscu, więc na ekranie nic
 *  się nie zmieniało. `/mapa` robi to od dawna, picker nie robił. */
function DopasujDoWynikow({ punkty }: { punkty: Array<[number, number]> }) {
  const map = useMap();
  useEffect(() => {
    if (punkty.length === 0) return;
    map.fitBounds(L.latLngBounds(punkty), { padding: [40, 40], maxZoom: 15 });
  }, [map, punkty]);
  return null;
}

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMapEvents({});
  useEffect(() => {
    map.flyTo([lat, lng], Math.max(map.getZoom(), 14), { duration: 0.5 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);
  return null;
}

export interface LocationResult {
  venue: Field | null;
  lat: number | null;
  lng: number | null;
  address: string;
}

interface Props {
  sport?: string;
  value: LocationResult;
  onChange: (v: LocationResult) => void;
}

export default function UnifiedLocationPickerImpl({ sport, value, onChange }: Props) {
  const [fields, setFields] = useState<Field[]>([]);
  const [search, setSearch] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);

  const [kadr, setKadr] = useState<Kadr | null>(null);
  const [znalezione, setZnalezione] = useState<Field[] | null>(null);
  const [mapa, setMapa] = useState<L.Map | null>(null);

  // Obiekty z widocznego wycinka mapy.
  useEffect(() => {
    if (!kadr) return;
    let cancelled = false;
    getExplorerFields(kadr).then((fs) => { if (!cancelled) setFields(fs); }).catch(() => {});
    return () => { cancelled = true; };
  }, [kadr]);

  const onKadr = useCallback((k: Kadr) => setKadr(k), []);

  // Szukanie po nazwie idzie do bazy, nie po pobranej liście: obiekt, którego
  // szukasz, najczęściej leży POZA aktualnym kadrem — i o to właśnie chodzi,
  // gdy ktoś wpisuje nazwę zamiast przesuwać mapę.
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) { setZnalezione(null); return; }
    let cancelled = false;
    const timer = setTimeout(() => {
      searchExplorerFields(q)
        .then((fs) => { if (!cancelled) setZnalezione(fs); })
        .catch(() => {});
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [search]);

  // Live client-side filtering as you type — same behaviour as the general
  // /mapa search (instant, no network round-trip). The magnifying-glass
  // button below is a separate, explicit action for addresses that aren't
  // one of our known venues (geocoded via Nominatim on click/Enter).
  const zrodlo = znalezione ?? fields;
  const wSporcie = useMemo(
    () => (sport ? zrodlo.filter((f) => f.sport.includes(sport)) : zrodlo),
    [zrodlo, sport],
  );

  // Filtr sportu potrafił wyzerować wyniki BEZ SŁOWA wyjaśnienia — a przy
  // danych sportów zanieczyszczonych sąsiedztwem (import z OSM) trafia to też
  // w prawidłowe boiska. Gdy coś znaleziono, ale filtr wyciął wszystko,
  // pokazujemy komplet i mówimy o tym wprost, zamiast udawać brak wyników.
  const filtrOdsial = znalezione !== null && znalezione.length > 0 && wSporcie.length === 0;
  const visible = filtrOdsial ? znalezione : wSporcie;

  // fitBounds tylko dla wyników szukania: liczenie go z `fields` kazałoby mapie
  // skakać przy każdym przesunięciu kadru.
  const punktyWynikow = useMemo<Array<[number, number]>>(
    () => (znalezione === null ? [] : znalezione.map((f) => [f.lat, f.lng] as [number, number])),
    [znalezione],
  );

  async function handleGeocode() {
    const q = search.trim();
    if (!q) return;
    setGeocoding(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        onChange({ venue: null, lat, lng, address: data[0].display_name });
        setFlyTarget({ lat, lng });
        setSearch('');
      }
    } catch { /* ignore */ }
    setGeocoding(false);
  }

  async function handleMapClick(lat: number, lng: number) {
    let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    try {
      const res = await fetch(`/api/geocode?lat=${lat}&lon=${lng}`);
      const data = await res.json();
      if (data.display_name) address = data.display_name;
    } catch { /* keep coords */ }
    onChange({ venue: null, lat, lng, address });
  }

  const showFly = flyTarget;

  return (
    // `min-h` niższe niż najniższy kontener, który tego pickera używa (kreator
    // daje `h-64`, czyli 256 px). Przy 300 px dziecko przerastało rodzica
    // o 44 px, a `overflow-hidden` ucinało dokładnie ten pas — razem
    // z przyciskiem „pokaż moją okolicę", sterowaniem zoomu i atrybucją.
    <div className="relative w-full h-full min-h-[240px]">
      {/* Address search overlay */}
      <div className="absolute top-2 left-2 right-2 z-[1001] flex gap-1.5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleGeocode(); } }}
          placeholder="Szukaj adresu lub nazwy miejsca…"
          className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white/95 backdrop-blur-sm shadow focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          type="button"
          onClick={handleGeocode}
          disabled={geocoding}
          aria-label="Szukaj adresu"
          title="Szukaj adresu"
          className="px-3 py-2 rounded-lg bg-white/95 backdrop-blur-sm border border-slate-200 shadow text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors flex items-center"
        >
          {geocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </button>
      </div>

      {/* Komunikat o wynikach. Do tej pory szukanie bez trafienia wyglądało
          identycznie jak szukanie, które jeszcze nie ruszyło — a przycisk lupy
          (geokoder) był ukrytą afordancją, o której nic nie mówiło. */}
      {(filtrOdsial || (znalezione !== null && znalezione.length === 0)) && (
        <div className="absolute top-14 left-2 right-2 z-[1001] rounded-lg bg-white/95 px-3 py-2 text-xs text-slate-600 shadow backdrop-blur-sm">
          {filtrOdsial
            ? `Żadne ze znalezionych miejsc nie ma w opisie sportu „${sportLabel(sport ?? '')}" — pokazujemy wszystkie.`
            : 'Nie znaleziono takiego miejsca. Naciśnij lupę, żeby wyszukać adres, albo dotknij mapy w wybranym punkcie.'}
        </div>
      )}

      <MapContainer
        center={POZNAN}
        zoom={11}
        style={{ height: '100%', width: '100%', minHeight: '240px' }}
        zoomControl={false}
      >
        <MapAttribution />
        <KadrObserwator onZmiana={onKadr} />
        <ChwytMapy onMapa={setMapa} />
        <DopasujDoWynikow punkty={punktyWynikow} />
        {MAPBOX_TOKEN ? (
          <TileLayer
            attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`}
            tileSize={512}
            zoomOffset={-1}
          />
        ) : (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}
        <ZoomControl position="bottomright" />
        <MapClickHandler onCustom={handleMapClick} />
        {showFly && <FlyTo lat={showFly.lat} lng={showFly.lng} />}

        {/* Venue pins — clustered so dense areas stay readable and fast */}
        <ClusteredFieldMarkers
          fields={visible}
          selectedId={value.venue?.id}
          onSelect={(f) => {
            onChange({ venue: f, lat: f.lat, lng: f.lng, address: f.address });
            setFlyTarget({ lat: f.lat, lng: f.lng });
          }}
        />

        {/* Custom location pin */}
        {!value.venue && value.lat !== null && value.lng !== null && (
          <CustomPin lat={value.lat} lng={value.lng} />
        )}
      </MapContainer>

      {/* „Pokaż moją okolicę". Mapa startuje na sztywno w Poznaniu, mimo że
          mecz da się stworzyć gdziekolwiek w Polsce — organizator z innego
          miasta zaczynał od przewijania cudzego. Lewy dolny róg, bo prawy
          zajmuje ZoomControl. */}
      <LocateMeButton map={mapa} className="absolute bottom-3 left-3 z-[1001]" />
    </div>
  );
}
