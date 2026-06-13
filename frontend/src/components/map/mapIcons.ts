import L from 'leaflet';
import type { Field } from '@/types';
import { sportEmoji, sportColor, SPORT_CONFIG } from '@/lib/sports';

export const POZNAN: [number, number] = [52.37, 16.97];

// Priority order for selecting the "primary" sport of a multi-sport venue
export const SPORT_ORDER = Object.keys(SPORT_CONFIG);

export function metaFor(sport: string) {
  return { color: sportColor(sport), emoji: sportEmoji(sport) };
}

export function primaryMeta(sports: string[]) {
  for (const s of SPORT_ORDER) {
    if (sports.includes(s)) return metaFor(s);
  }
  return metaFor(sports[0] ?? 'inne');
}

export function primaryColor(sports: string[]): string {
  return primaryMeta(sports).color;
}

// Teardrop pin: solid sport-color background, emoji(s) — up to 3 sports
export function fieldPin(field: Field, selected = false): L.DivIcon {
  const { color } = selected ? { color: '#1e40af' } : field.available ? primaryMeta(field.sport) : { color: '#9ca3af' };
  const emojis = field.available
    ? field.sport.slice(0, 3).map((s) => sportEmoji(s)).join('')
    : '🏟️';
  const multi = field.sport.length > 1;
  const d = selected ? 36 : multi ? 34 : 30;
  const fs = selected ? 14 : multi ? 9 : 13;
  const tw = 5;
  const th = 7;
  const w = d + 4;
  const h = d + th + 2;
  return L.divIcon({
    html: `<div style="display:flex;flex-direction:column;align-items:center;width:${w}px;cursor:pointer;filter:drop-shadow(0 2px 5px rgba(0,0,0,.30))">
      <div style="width:${d}px;height:${d}px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;border:2px solid rgba(255,255,255,0.7)">
        <span style="font-size:${fs}px;line-height:1;user-select:none">${emojis}</span>
      </div>
      <div style="width:0;height:0;border-left:${tw}px solid transparent;border-right:${tw}px solid transparent;border-top:${th}px solid ${color};margin-top:-1px"></div>
    </div>`,
    className: '',
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -(h + 4)],
  });
}

// Cluster: dominant sport color pill with count — no emoji clutter
export function clusterDivIcon(count: number, allSports: string[]): L.DivIcon {
  const uniqueSports = Array.from(new Set(allSports));
  const isMixed = uniqueSports.length > 1;
  const color = isMixed ? '#475569' : primaryColor(allSports.length ? allSports : ['inne']);
  const size = count >= 100 ? 50 : count >= 20 ? 44 : 38;
  const fs = count >= 100 ? 13 : 14;
  return L.divIcon({
    html: `<div style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,.28);cursor:pointer">
      <span style="font-size:${fs}px;font-weight:700;color:white;letter-spacing:-0.5px">${count}</span>
    </div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}
