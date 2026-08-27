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
//   GET /api/geocode?q=<address>            — forward search (jeden wynik)
//   GET /api/geocode?lat=<lat>&lon=<lng>     — reverse geocode
//   GET /api/geocode?miejscowosc=<fraza>     — LISTA miejscowości do podpowiedzi

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

    // Podpowiedzi miejscowości do filtra „miejscowość + ile km".
    //
    // Osobny tryb, a nie `q` z większym `limit`: filtr ma podpowiadać MIEJSCA
    // (miasto, wieś), nie dowolne adresy — „Kwiatowa 3" nie jest odpowiedzią na
    // pytanie „gdzie szukam boisk". Stąd `featuretype=settlement`, które
    // ogranicza wynik do city/town/village/hamlet.
    //
    // WYJĄTEK NA KOD POCZTOWY: kod nie jest osadą, więc przy `featuretype`
    // Nominatim nie zwróciłby na niego NIC. Rozpoznajemy polski format
    // (`61-001`, ewentualnie bez myślnika) i wtedy pytamy bez ograniczenia.
    const miejscowosc = searchParams.get('miejscowosc')?.trim();
    if (miejscowosc) {
      const kodPocztowy = /^\d{2}-?\d{3}$/.test(miejscowosc);
      const fraza = kodPocztowy && !miejscowosc.includes('-')
        ? `${miejscowosc.slice(0, 2)}-${miejscowosc.slice(2)}`
        : miejscowosc;
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('q', fraza);
      url.searchParams.set('format', 'json');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('limit', '6');
      url.searchParams.set('countrycodes', 'pl');
      if (!kodPocztowy) url.searchParams.set('featuretype', 'settlement');

      const res = await fetch(url, { headers: NOMINATIM_HEADERS });
      if (!res.ok) return NextResponse.json({ error: 'upstream' }, { status: 502 });
      const dane = (await res.json()) as NominatimWynik[];
      return NextResponse.json(dane.map(naMiejscowosc));
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

    return NextResponse.json({ error: 'missing q, miejscowosc or lat/lon' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}

type NominatimWynik = {
  lat: string; lon: string; display_name?: string; name?: string;
  address?: Record<string, string>;
};

/**
 * Kształt, którego potrzebuje filtr — nie surowy Nominatim.
 *
 * `display_name` bywa długie na pół ekranu („Poznań, województwo
 * wielkopolskie, 61-001, Polska"), więc rozbijamy je na nazwę i jedną linijkę
 * kontekstu. Kontekst jest konieczny, nie ozdobny: samych „Nowa Wieś" jest
 * w Polsce kilkadziesiąt i bez województwa nie da się wybrać właściwej.
 */
function naMiejscowosc(w: NominatimWynik) {
  const a = w.address ?? {};
  const nazwa = w.name
    || a.city || a.town || a.village || a.hamlet || a.municipality
    || (w.display_name ?? '').split(',')[0]?.trim()
    || 'Nieznane miejsce';
  const kontekst = [a.county, a.state].filter(Boolean).join(' · ');
  return { nazwa, kontekst, lat: Number(w.lat), lng: Number(w.lon) };
}
