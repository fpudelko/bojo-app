'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import type { Field } from '@/types';
import { getFields } from '@/lib/api';
import { surfaceLabel } from '@/lib/labels';
import { useAdmin } from '@/lib/admin';
import { FEATURE_RESERVATIONS, showBookingForField } from '@/config/features';
import { slugify } from '@/lib/utils';
import type { MapViewProps } from './MapView';

const POZNAN: [number, number] = [52.37, 16.97];
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// ---------------------------------------------------------------------------
// Sport color palette — solid colors, no emoji
// ---------------------------------------------------------------------------
const SPORT_ORDER = [
  'piłka nożna', 'siatkówka plażowa', 'koszykówka',
  'futsal', 'siatkówka', 'piłka ręczna', 'gokarty', 'inne',
];

function sportColor(sport: string): string {
  if (sport === 'piłka nożna') return '#15663E';
  if (sport === 'siatkówka plażowa') return '#d97706';
  if (sport === 'koszykówka') return '#ea580c';
  return '#2563eb';
}

function primaryColor(sports: string[]): string {
  for (const s of SPORT_ORDER) {
    if (sports.includes(s)) return sportColor(s);
  }
  return sportColor(sports[0] ?? 'inne');
}

// metaFor — używane przez popup (sport badges z emoji)
const SPORT_META: Record<string, { color: string; emoji: string }> = {
  'piłka nożna':       { color: '#15663E', emoji: '⚽' },
  'siatkówka plażowa': { color: '#d97706', emoji: '🏖️' },
  'siatkówka':         { color: '#2563eb', emoji: '🏐' },
  'koszykówka':        { color: '#ea580c', emoji: '🏀' },
  'futsal':            { color: '#2563eb', emoji: '⚡' },
  'piłka ręczna':      { color: '#2563eb', emoji: '🤾' },
  'gokarty':           { color: '#0d9488', emoji: '🏎️' },
  'inne':              { color: '#2563eb', emoji: '🏅' },
};
function metaFor(sport: string) {
  return SPORT_META[sport] ?? { color: '#2563eb', emoji: '🏅' };
}

// ---------------------------------------------------------------------------
// Individual pin — teardrop, sport color, no emoji
// ---------------------------------------------------------------------------
function fieldIcon(field: Field): L.DivIcon {
  const c = field.available ? primaryColor(field.sport) : '#9ca3af';
  let primary = 'inne';
  for (const s of SPORT_ORDER) {
    if (field.sport.includes(s)) { primary = s; break; }
  }
  const em = metaFor(primary).emoji;
  return L.divIcon({
    html: `<div style="position:relative;width:28px;height:28px;cursor:pointer">
      <div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${c};border:1.5px solid rgba(255,255,255,0.9);box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>
      <span style="position:absolute;top:35%;left:50%;transform:translate(-50%,-50%);font-size:11px;line-height:1;pointer-events:none;user-select:none">${em}</span>
    </div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 26],
    popupAnchor: [0, -28],
  });
}

// ---------------------------------------------------------------------------
// Cluster icon — colored bubble with emoji + count
// ---------------------------------------------------------------------------
function clusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const count = cluster.getChildCount();
  const markers = cluster.getAllChildMarkers() as Array<L.Marker & { _bojo_sports?: string[] }>;

  const allSports = markers.flatMap((m) => m._bojo_sports ?? []);
  const color = primaryColor(allSports.length ? allSports : ['inne']);

  const uniqueSports = Array.from(new Set(allSports));
  const em = uniqueSports.length === 1 ? metaFor(uniqueSports[0]).emoji : '🏟️';

  const size = count >= 100 ? 50 : count >= 20 ? 42 : 36;
  const emSize = size >= 42 ? 14 : 12;
  const numSize = size >= 42 ? 11 : 10;

  return L.divIcon({
    html: `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.25);cursor:pointer">
      <span style="font-size:${emSize}px;line-height:1">${em}</span>
      <span style="font-size:${numSize}px;font-weight:700;color:white;line-height:1">${count}</span>
    </div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// ---------------------------------------------------------------------------
// Popup HTML (plain string — runs outside React)
// ---------------------------------------------------------------------------
function popupHtml(field: Field, isAdmin: boolean): string {
  const color = primaryColor(field.sport);
  const slug = slugify(field.name);

  const sportsHtml = field.sport
    .map((s) => {
      const m = metaFor(s);
      return `<span style="background:${m.color}18;color:${m.color};border-radius:4px;padding:1px 7px;font-size:11px;font-weight:500">${m.emoji} ${s}</span>`;
    })
    .join(' ');

  const availHtml = field.available
    ? `<span style="color:#15803d;font-size:11px;font-weight:500">● Dostępne</span>`
    : `<span style="color:#9ca3af;font-size:11px">● Niedostępne</span>`;

  const surfaceTxt = field.surface ? ` · <span style="color:#9ca3af;font-size:11px">${surfaceLabel(field.surface)}</span>` : '';

  const bookingBtn =
    FEATURE_RESERVATIONS && showBookingForField(field) && field.bookingType === 'internal'
      ? `<a href="/boisko/${slug}" style="flex:0 0 auto;background:#2563eb;color:#fff;border-radius:6px;padding:5px 10px;font-size:12px;font-weight:600;text-decoration:none">📅 Zarezerwuj</a>`
      : '';

  const adminLink = isAdmin
    ? `<a href="/admin/boisko/${field.id}" style="display:block;margin-top:5px;font-size:11px;color:#6b7280;text-decoration:none">✏️ Edytuj boisko (admin)</a>`
    : '';

  // Suppress unused color var warning — it's used dynamically above
  void color;

  return `<div style="min-width:230px;max-width:280px;font-family:system-ui,sans-serif">
    <p style="font-weight:700;font-size:13px;color:#0f172a;margin:0 0 2px">${field.name}</p>
    <p style="font-size:11px;color:#6b7280;margin:0 0 6px">${field.address}</p>
    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">${sportsHtml}</div>
    <p style="margin:0 0 10px">${availHtml}${surfaceTxt}</p>
    <div style="display:flex;gap:5px;flex-wrap:wrap">
      ${bookingBtn}
      <a href="/boisko/${slug}" style="flex:1;min-width:70px;text-align:center;background:#f0fdf4;color:#15803d;border:1.5px solid #bbf7d0;border-radius:6px;padding:5px 8px;font-size:12px;font-weight:600;text-decoration:none">Szczegóły →</a>
      <a href="/wydarzenia/nowe?fieldId=${field.id}" style="flex:1;min-width:70px;text-align:center;background:#15803d;color:#fff;border-radius:6px;padding:5px 8px;font-size:12px;font-weight:600;text-decoration:none">+ Mecz</a>
      <a href="https://www.google.com/maps/dir/?api=1&destination=${field.lat},${field.lng}" target="_blank" rel="noopener noreferrer" style="flex:1;min-width:55px;text-align:center;background:#f3f4f6;color:#374151;border-radius:6px;padding:5px 8px;font-size:12px;font-weight:600;text-decoration:none">Nawiguj</a>
    </div>
    ${adminLink}
  </div>`;
}

// ---------------------------------------------------------------------------
// Sub-component: lives inside MapContainer, adds/removes cluster layer
// ---------------------------------------------------------------------------
function ClusteredMarkers({ fields, isAdmin }: { fields: Field[]; isAdmin: boolean }) {
  const map = useMap();

  useEffect(() => {
    const clusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 28,
      iconCreateFunction: clusterIcon,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 17,
      animate: true,
    });

    for (const field of fields) {
      const marker = L.marker([field.lat, field.lng], { icon: fieldIcon(field) }) as L.Marker & {
        _bojo_sports?: string[];
      };
      marker._bojo_sports = field.sport;
      marker.bindPopup(popupHtml(field, isAdmin), { maxWidth: 290, closeButton: true });
      clusterGroup.addLayer(marker);
    }

    map.addLayer(clusterGroup);
    return () => {
      map.removeLayer(clusterGroup);
    };
  }, [map, fields, isAdmin]);

  return null;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function LeafletMapImpl({
  className,
  sports,
  onlyAvailable,
  onlyBookable,
  search,
}: MapViewProps) {
  const [allFields, setAllFields] = useState<Field[]>([]);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = useAdmin();

  // Fetch all fields once; filters applied client-side
  useEffect(() => {
    let cancelled = false;
    getFields({ available: onlyAvailable || undefined, bookable: onlyBookable || undefined })
      .then((res) => { if (!cancelled) setAllFields(res.fields); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Błąd'); });
    return () => { cancelled = true; };
  }, [onlyAvailable, onlyBookable]);

  // Client-side filtering
  const q = search?.trim().toLowerCase() ?? '';
  const displayed = allFields.filter((f) => {
    if (sports && sports.length > 0 && !f.sport.some((s) => sports.includes(s))) return false;
    if (q && !f.name.toLowerCase().includes(q) && !f.address.toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <div className={['w-full h-full min-h-[400px] relative', className ?? ''].join(' ')}>
      <MapContainer
        center={POZNAN}
        zoom={11}
        style={{ height: '100%', width: '100%', minHeight: '400px' }}
        zoomControl={false}
      >
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
        <ZoomControl position="topright" />
        <ClusteredMarkers fields={displayed} isAdmin={isAdmin} />
      </MapContainer>

      {/* Result count badge */}
      {(q || (sports && sports.length > 0)) && (
        <div className="absolute top-2 left-2 z-[1000] bg-white/90 backdrop-blur-sm text-xs text-gray-600 px-2.5 py-1 rounded-full shadow-sm border border-gray-100">
          {displayed.length} z {allFields.length} boisk
        </div>
      )}

      {error && (
        <div className="absolute bottom-4 left-4 right-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-3 py-2 shadow z-[1000]">
          Nie udało się pobrać boisk: {error}
        </div>
      )}
    </div>
  );
}
