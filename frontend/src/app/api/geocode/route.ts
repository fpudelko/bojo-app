import { NextRequest, NextResponse } from 'next/server';

// Server-side proxy for Nominatim (OpenStreetMap) geocoding.
//
// The map location pickers used to call nominatim.openstreetmap.org directly
// from the browser. That's fragile for two reasons: `User-Agent` is a
// "forbidden header" browsers won't actually let fetch() set, and Nominatim's
// usage policy expects a real identifying User-Agent + reasonable rate limits
// from server-side callers — requests that don't look like that get throttled
// or rejected, which surfaced to users as a raw error when clicking search.
// Proxying through our own API route fixes both: Node's fetch can set
// whatever headers we want, and requests come from one identified backend
// instead of every visitor's browser hitting Nominatim directly.
//
// Usage:
//   GET /api/geocode?q=<address>            — forward search
//   GET /api/geocode?lat=<lat>&lon=<lng>     — reverse geocode

const NOMINATIM_HEADERS = { 'User-Agent': 'bojo-app/1.0 (contact: hello@bojo.pl)' };

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  try {
    if (lat && lon) {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&format=json`,
        { headers: NOMINATIM_HEADERS },
      );
      if (!res.ok) return NextResponse.json({ error: 'upstream' }, { status: 502 });
      const data = await res.json();
      return NextResponse.json(data);
    }

    if (q?.trim()) {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q.trim())}&format=json&limit=1&countrycodes=pl`,
        { headers: NOMINATIM_HEADERS },
      );
      if (!res.ok) return NextResponse.json({ error: 'upstream' }, { status: 502 });
      const data = await res.json();
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: 'missing q or lat/lon' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
