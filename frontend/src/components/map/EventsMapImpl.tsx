'use client';

// DEAD CODE — not imported anywhere. Do not copy patterns from this file.
// The live map is components/map/VenueExplorer.tsx (route /mapa).

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import MapAttribution from './MapAttribution';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getPublicEvents } from '@/lib/events';
import type { EventItem } from '@/types';

const POZNAN: [number, number] = [52.37, 16.97];
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

import { sportEmoji, sportColor } from '@/lib/sports';

function eventIcon(event: EventItem): L.DivIcon {
  const emoji = sportEmoji(event.sport);
  const color = sportColor(event.sport);
  const today = new Date().toISOString().split('T')[0];
  const isToday = event.date === today;

  // Today → filled vibrant pin with "DZIŚ" badge; future → lighter outline pin
  const pinStyle = isToday
    ? `background:${color};border:2px solid rgba(255,255,255,0.9);box-shadow:0 3px 10px rgba(0,0,0,.40);`
    : `background:${color};opacity:0.55;border:1.5px solid rgba(255,255,255,0.7);box-shadow:0 1px 5px rgba(0,0,0,.20);`;
  const badge = isToday
    ? `<span style="position:absolute;top:-6px;right:-6px;background:#f59e0b;color:#fff;font-size:7px;font-weight:700;border-radius:4px;padding:1px 3px;line-height:1.2;letter-spacing:.3px;transform:rotate(45deg)">DZIŚ</span>`
    : '';

  return L.divIcon({
    html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;
        width:36px;height:36px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
        cursor:pointer;${pinStyle}">
        <span style="transform:rotate(45deg);font-size:16px;line-height:1">${emoji}</span>
        ${badge}
      </div>`,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 34],
    popupAnchor: [0, -36],
  });
}

function popupHtml(event: EventItem): string {
  const emoji = sportEmoji(event.sport);
  const spots = event.maxPlayers;
  const dateStr = event.date;
  const timeStr = event.time?.slice(0, 5) ?? '';

  return `<div style="min-width:210px;max-width:260px;font-family:system-ui,sans-serif">
    <p style="font-weight:700;font-size:13px;color:#0f172a;margin:0 0 2px">${emoji} ${event.title || event.sport}</p>
    <p style="font-size:11px;color:#6b7280;margin:0 0 4px">${event.fieldName}</p>
    <p style="font-size:11px;color:#0f172a;margin:0 0 8px">📅 ${dateStr} ${timeStr} · max ${spots} os.</p>
    <a href="/wydarzenia/${event.id}" style="display:block;text-align:center;background:#15803d;color:#fff;border-radius:6px;padding:6px 10px;font-size:12px;font-weight:600;text-decoration:none">
      Szczegóły →
    </a>
  </div>`;
}

function EventMarkers({ events }: { events: EventItem[] }) {
  const map = useMap();

  useEffect(() => {
    const markers: L.Marker[] = [];

    for (const event of events) {
      if (event.lat == null || event.lng == null) continue;
      const marker = L.marker([event.lat, event.lng], { icon: eventIcon(event) });
      marker.bindPopup(popupHtml(event), { maxWidth: 270, closeButton: true });
      marker.addTo(map);
      markers.push(marker);
    }

    return () => {
      for (const m of markers) map.removeLayer(m);
    };
  }, [map, events]);

  return null;
}

export interface EventsMapImplProps {
  className?: string;
  sports?: string[];
  dateFrom?: string;
  dateTo?: string;
}

export default function EventsMapImpl({ className, sports, dateFrom, dateTo }: EventsMapImplProps) {
  const [allEvents, setAllEvents] = useState<EventItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPublicEvents()
      .then((events) => setAllEvents(events.filter((e) => e.lat != null && e.lng != null)))
      .catch(() => setError('Nie udało się załadować wydarzeń'));
  }, []);

  const displayed = allEvents.filter((e) => {
    if (sports && sports.length > 0 && !sports.includes(e.sport)) return false;
    if (dateFrom && e.date < dateFrom) return false;
    if (dateTo && e.date > dateTo) return false;
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
        <MapAttribution />
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
        <EventMarkers events={displayed} />
      </MapContainer>

      {displayed.length === 0 && allEvents.length > 0 && !error && (
        <div className="absolute top-2 left-2 z-[1000] bg-white/90 backdrop-blur-sm text-xs text-slate-600 px-2.5 py-1 rounded-full shadow-sm border border-slate-100">
          Brak wydarzeń z lokalizacją w tych filtrach
        </div>
      )}

      {allEvents.length > 0 && (
        <div className="absolute top-2 left-2 z-[1000] bg-white/90 backdrop-blur-sm text-xs text-slate-600 px-2.5 py-1 rounded-full shadow-sm border border-slate-100">
          {displayed.length} {displayed.length === 1 ? 'wydarzenie' : displayed.length < 5 ? 'wydarzenia' : 'wydarzeń'} z lokalizacją
        </div>
      )}

      {error && (
        <div className="absolute bottom-4 left-4 right-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-3 py-2 shadow z-[1000]">
          {error}
        </div>
      )}
    </div>
  );
}
