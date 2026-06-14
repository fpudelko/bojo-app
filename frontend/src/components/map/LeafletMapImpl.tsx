'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import MapAttribution from './MapAttribution';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import type { Field } from '@/types';
import { getFields } from '@/lib/api';
import { surfaceLabel, fieldPhotoUrl } from '@/lib/labels';
import { useAdmin } from '@/lib/admin';
import { FEATURE_RESERVATIONS, showBookingForField } from '@/config/features';
import { slugify } from '@/lib/utils';
import type { MapViewProps } from './MapView';
import { fieldMatchesData, districtsOf } from '@/lib/fieldFilters';
import { POZNAN, metaFor, primaryMeta, fieldPin, clusterDivIcon } from './mapIcons';
import { sportEmoji } from '@/lib/sports';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// ---------------------------------------------------------------------------
// Popup HTML (plain string — runs outside React)
// ---------------------------------------------------------------------------
function popupHtml(field: Field, isAdmin: boolean): string {
  const sportsHtml = field.sport
    .map((s) => {
      const m = metaFor(s);
      return `<span style="background:${m.color}1a;color:${m.color};border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">${m.emoji} ${s}</span>`;
    })
    .join(' ');

  const availHtml = field.available
    ? `<span style="color:#15803d;font-size:11px;font-weight:500">● Dostępne</span>`
    : `<span style="color:#9ca3af;font-size:11px">● Niedostępne</span>`;

  const surfaceTxt = field.surface ? ` · <span style="color:#94a3b8;font-size:11px">${surfaceLabel(field.surface)}</span>` : '';
  const indoorTxt = field.isIndoor ? ` · <span style="color:#94a3b8;font-size:11px">Hala</span>` : '';
  const phoneTxt = field.phone
    ? `<p style="margin:4px 0 0;font-size:11px;color:#475569">📞 <a href="tel:${field.phone}" style="color:#475569;text-decoration:none">${field.phone}</a></p>`
    : '';
  const slug = slugify(field.name);

  const bookingBtn =
    FEATURE_RESERVATIONS && showBookingForField(field) && field.bookingType === 'internal'
      ? `<a href="/boisko/${slug}" style="flex:0 0 auto;background:#2563eb;color:#fff;border-radius:6px;padding:5px 10px;font-size:12px;font-weight:600;text-decoration:none">📅 Zarezerwuj</a>`
      : '';

  const adminLink = isAdmin
    ? `<a href="/admin/boisko/${field.id}" style="display:block;margin-top:8px;font-size:11px;color:#94a3b8;text-decoration:none">✏️ Edytuj boisko (admin)</a>`
    : '';

  const thumb = fieldPhotoUrl(field, 320, 180);
  const imgHtml = thumb
    ? `<img src="${thumb}" alt="" style="width:100%;height:120px;object-fit:cover;border-radius:14px;margin-bottom:10px;display:block" />`
    : '';

  return `<div style="min-width:240px;max-width:280px;font-family:system-ui,sans-serif;padding:2px">
    ${imgHtml}
    <p style="font-weight:700;font-size:15px;color:#0f172a;margin:0 0 3px;line-height:1.25">${field.name}</p>
    <p style="font-size:12px;color:#64748b;margin:0 0 8px">${field.address}</p>
    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">${sportsHtml}</div>
    <p style="margin:0 0 0">${availHtml}${surfaceTxt}${indoorTxt}</p>
    ${phoneTxt}
    <a href="/boisko/${slug}" style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:12px;background:#15663E;color:#fff;border-radius:14px;padding:11px 14px;font-size:14px;font-weight:700;text-decoration:none">Zobacz boisko →</a>
    ${bookingBtn ? `<div style="margin-top:6px">${bookingBtn}</div>` : ''}
    <a href="/wydarzenia/nowe?fieldId=${field.id}" style="display:block;text-align:center;margin-top:6px;color:#15663E;font-size:12px;font-weight:600;text-decoration:none">+ Zorganizuj tu mecz</a>
    ${adminLink}
  </div>`;
}

// ---------------------------------------------------------------------------
// Co-location grouping — venues at the same spot become one pin
// ---------------------------------------------------------------------------

// Round to 3 decimal places ≈ 110 m grid. Venues closer than that share one pin.
const LOC_PRECISION = 3;

function groupByLocation(fields: Field[]): Map<string, Field[]> {
  const map = new Map<string, Field[]>();
  for (const f of fields) {
    const key = `${f.lat.toFixed(LOC_PRECISION)},${f.lng.toFixed(LOC_PRECISION)}`;
    const bucket = map.get(key);
    if (bucket) bucket.push(f);
    else map.set(key, [f]);
  }
  return map;
}

// Pin for a group: show up to 3 sport emojis side-by-side
function groupPin(fields: Field[]): L.DivIcon {
  const allSports = Array.from(new Set(fields.flatMap((f) => f.sport)));
  const available = fields.some((f) => f.available);
  const color = available ? primaryMeta(allSports).color : '#9ca3af';
  const emojis = allSports
    .slice(0, 3)
    .map((s) => sportEmoji(s))
    .join('');
  const d = 32;
  const tw = 5; const th = 7;
  const w = d + 4; const h = d + th + 2;
  return L.divIcon({
    html: `<div style="display:flex;flex-direction:column;align-items:center;width:${w}px;cursor:pointer;filter:drop-shadow(0 2px 5px rgba(0,0,0,.30))">
      <div style="width:${d}px;height:${d}px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;border:2px solid rgba(255,255,255,0.7)">
        <span style="font-size:11px;line-height:1;user-select:none">${emojis}</span>
      </div>
      <div style="width:0;height:0;border-left:${tw}px solid transparent;border-right:${tw}px solid transparent;border-top:${th}px solid ${color};margin-top:-1px"></div>
    </div>`,
    className: '',
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -(h + 4)],
  });
}

// Popup for a group of co-located venues
function groupPopupHtml(fields: Field[], isAdmin: boolean): string {
  if (fields.length === 1) return popupHtml(fields[0], isAdmin);

  const items = fields.map((f) => {
    const sportsHtml = f.sport
      .map((s) => {
        const m = metaFor(s);
        return `<span style="background:${m.color}1a;color:${m.color};border-radius:4px;padding:1px 6px;font-size:11px;font-weight:600">${m.emoji} ${s}</span>`;
      })
      .join(' ');
    const slug = slugify(f.name);
    return `<div style="padding:8px 0;border-bottom:1px solid #f1f5f9">
      <p style="font-weight:700;font-size:13px;color:#0f172a;margin:0 0 3px">${f.name}</p>
      <div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:6px">${sportsHtml}</div>
      <a href="/boisko/${slug}" style="display:inline-block;background:#15663E;color:#fff;border-radius:10px;padding:5px 12px;font-size:12px;font-weight:700;text-decoration:none">Zobacz →</a>
      ${isAdmin ? `<a href="/admin/boisko/${f.id}" style="margin-left:8px;font-size:11px;color:#94a3b8;text-decoration:none">✏️</a>` : ''}
    </div>`;
  }).join('');

  const first = fields[0];
  const thumb = fieldPhotoUrl(first, 320, 180);
  const imgHtml = thumb
    ? `<img src="${thumb}" alt="" style="width:100%;height:100px;object-fit:cover;border-radius:10px;margin-bottom:8px;display:block" />`
    : '';

  return `<div style="min-width:240px;max-width:280px;font-family:system-ui,sans-serif;padding:2px">
    ${imgHtml}
    <p style="font-size:12px;color:#64748b;margin:0 0 6px">${first.address}</p>
    ${items}
  </div>`;
}

// ---------------------------------------------------------------------------
// Cluster marker group
// ---------------------------------------------------------------------------
function ClusteredMarkers({ fields, isAdmin }: { fields: Field[]; isAdmin: boolean }) {
  const map = useMap();

  useEffect(() => {
    const clusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 28,
      iconCreateFunction: (cluster) => {
        const markers = cluster.getAllChildMarkers() as Array<L.Marker & { _bojo_sports?: string[] }>;
        const allSports = markers.flatMap((m) => m._bojo_sports ?? []);
        return clusterDivIcon(cluster.getChildCount(), allSports);
      },
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 17,
      animate: true,
    });

    // Group co-located venues into a single pin
    const groups = groupByLocation(fields);
    groups.forEach((group) => {
      const rep = group[0];
      const allSports = Array.from(new Set(group.flatMap((f) => f.sport)));
      const marker = L.marker([rep.lat, rep.lng], {
        icon: group.length === 1 ? fieldPin(rep) : groupPin(group),
      }) as L.Marker & { _bojo_sports?: string[] };
      marker._bojo_sports = allSports;
      marker.bindPopup(groupPopupHtml(group, isAdmin), { maxWidth: 290, closeButton: true, autoPan: false });
      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);
    return () => { map.removeLayer(clusterGroup); };
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
  district,
  dataKeys,
  onDistrictsLoaded,
}: MapViewProps) {
  const [allFields, setAllFields] = useState<Field[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [satellite, setSatellite] = useState(false);
  const isAdmin = useAdmin();

  useEffect(() => {
    let cancelled = false;
    getFields({ available: onlyAvailable || undefined, bookable: onlyBookable || undefined })
      .then((res) => {
        if (cancelled) return;
        const visible = res.fields.filter(f => f.mapVisibility !== 'hidden');
        setAllFields(visible);
        onDistrictsLoaded?.(districtsOf(visible));
      })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Błąd'); });
    return () => { cancelled = true; };
  }, [onlyAvailable, onlyBookable, onDistrictsLoaded]);

  const q = search?.trim().toLowerCase() ?? '';
  const displayed = allFields.filter((f) => {
    if (sports && sports.length > 0 && !f.sport.some((s) => sports.includes(s))) return false;
    if (district && f.district !== district) return false;
    if (dataKeys && dataKeys.length > 0 && !fieldMatchesData(f, dataKeys)) return false;
    if (q && !f.name.toLowerCase().includes(q) && !f.address.toLowerCase().includes(q)) return false;
    return true;
  });

  const streetLayer = MAPBOX_TOKEN ? (
    <TileLayer key="street"
      attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      url={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`}
      tileSize={512} zoomOffset={-1}
    />
  ) : (
    <TileLayer key="street"
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
  );

  const satelliteLayer = MAPBOX_TOKEN ? (
    <TileLayer key="satellite"
      attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      url={`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`}
      tileSize={512} zoomOffset={-1}
    />
  ) : (
    <TileLayer key="satellite"
      attribution='&copy; <a href="https://www.esri.com">Esri</a> &copy; Maxar, Earthstar Geographics'
      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    />
  );

  return (
    <div className={['w-full h-full min-h-[400px] relative', className ?? ''].join(' ')}>
      <MapContainer
        center={POZNAN}
        zoom={11}
        style={{ height: '100%', width: '100%', minHeight: '400px' }}
        zoomControl={false}
      >
        <MapAttribution />
        {satellite ? satelliteLayer : streetLayer}
        <ZoomControl position="topright" />
        <ClusteredMarkers fields={displayed} isAdmin={isAdmin} />
      </MapContainer>

      {/* Satellite toggle */}
      <button
        onClick={() => setSatellite((s) => !s)}
        className="absolute bottom-8 right-2 z-[1000] bg-white/95 backdrop-blur-sm border border-slate-200 shadow-md rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
        title={satellite ? 'Przełącz na mapę' : 'Przełącz na satelitę'}
      >
        {satellite ? '🗺️ Mapa' : '🛰️ Satelita'}
      </button>

      {/* Result count badge */}
      {(q || (sports && sports.length > 0)) && (
        <div className="absolute top-2 left-2 z-[1000] bg-white/90 backdrop-blur-sm text-xs text-slate-600 px-2.5 py-1 rounded-full shadow-sm border border-slate-100">
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

