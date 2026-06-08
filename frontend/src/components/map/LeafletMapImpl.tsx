'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import type { Field } from '@/types';
import { getFields } from '@/lib/api';
import { surfaceLabel, venueThumbnail } from '@/lib/labels';
import { useAdmin } from '@/lib/admin';
import { FEATURE_RESERVATIONS, showBookingForField } from '@/config/features';
import { slugify } from '@/lib/utils';
import type { MapViewProps } from './MapView';
import { fieldMatchesData, districtsOf } from '@/lib/fieldFilters';
import { POZNAN, metaFor, fieldPin, clusterDivIcon } from './mapIcons';

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

  const thumb = venueThumbnail(field.lat, field.lng, 320, 180, 16);
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

    for (const field of fields) {
      const marker = L.marker([field.lat, field.lng], { icon: fieldPin(field) }) as L.Marker & {
        _bojo_sports?: string[];
      };
      marker._bojo_sports = field.sport;
      marker.bindPopup(popupHtml(field, isAdmin), { maxWidth: 290, closeButton: true });
      clusterGroup.addLayer(marker);
    }

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
        {satellite ? satelliteLayer : streetLayer}
        <ZoomControl position="topright" />
        <ClusteredMarkers fields={displayed} isAdmin={isAdmin} />
      </MapContainer>

      {/* Satellite toggle */}
      <button
        onClick={() => setSatellite((s) => !s)}
        className="absolute bottom-8 right-2 z-[1000] bg-white/95 backdrop-blur-sm border border-gray-200 shadow-md rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
        title={satellite ? 'Przełącz na mapę' : 'Przełącz na satelitę'}
      >
        {satellite ? '🗺️ Mapa' : '🛰️ Satelita'}
      </button>

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

