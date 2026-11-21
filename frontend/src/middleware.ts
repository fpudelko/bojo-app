// Adresy z nazwą (migracja 177): /turnieje/gramy-dla-marysi-28-11-2026
// i /wydarzenia/czwartkowa-gierka-27-11-2026 PRZEPISUJEMY na trasy z uuid,
// bez przekierowania. Pasek przeglądarki zostaje z nazwą, a ekrany dalej
// dostają w `[id]` uuid, więc żaden z nich nie musiał się zmienić.
//
// Mecz turnieju: /turnieje/<adres>/mecz/5 → /turnieje/<uuid>/mecz/<uuid meczu 5>.
//
// Nieznany adres przechodzi bez zmian i kończy się tym samym „nie znaleziono”
// co zły uuid. Błąd bazy też: lepiej 404 niż wywrócona strona.
import { NextResponse, type NextRequest } from 'next/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADRES = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const NUMER_MECZU = /^\d{1,4}$/;
// Statyczne trasy pod tymi samymi przedrostkami: nie są adresami obiektów.
const ZAJETE = new Set(['nowe', 'nowy']);

const TTL_MS = 10 * 60 * 1000;
const pamiec = new Map<string, { id: string | null; do: number }>();

async function zapytaj(sciezka: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const klucz = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !klucz) return null;
  const teraz = Date.now();
  const zapamietane = pamiec.get(sciezka);
  if (zapamietane && zapamietane.do > teraz) return zapamietane.id;
  try {
    const odp = await fetch(`${url}/rest/v1/${sciezka}`, {
      headers: { apikey: klucz, Authorization: `Bearer ${klucz}`, Accept: 'application/json' },
    });
    if (!odp.ok) return null;
    const wiersze = (await odp.json()) as Record<string, string>[];
    const id = wiersze[0] ? Object.values(wiersze[0])[0] ?? null : null;
    // Brak trafienia pamiętamy krócej: świeżo założony mecz ma działać od razu.
    pamiec.set(sciezka, { id, do: teraz + (id ? TTL_MS : 15_000) });
    if (pamiec.size > 2000) pamiec.clear();
    return id && UUID.test(id) ? id : null;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const segmenty = req.nextUrl.pathname.split('/');
  // ['', 'turnieje' | 'wydarzenia', <id albo adres>, ...reszta]
  const [, sekcja, obiekt] = segmenty;
  if (!obiekt) return NextResponse.next();
  let zmienione = false;

  if (!UUID.test(obiekt) && !ZAJETE.has(obiekt) && ADRES.test(obiekt)) {
    const id = sekcja === 'turnieje'
      ? await zapytaj(`adresy_z_nazwa?select=turniej_id&turniej_id=not.is.null&slug=eq.${obiekt}`)
      : await zapytaj(`adresy_z_nazwa?select=event_id&event_id=not.is.null&slug=eq.${obiekt}`);
    if (!id) return NextResponse.next();
    segmenty[2] = id;
    zmienione = true;
  }

  // /turnieje/<uuid>/mecz/<numer>
  if (sekcja === 'turnieje' && segmenty[3] === 'mecz' && segmenty[4] && NUMER_MECZU.test(segmenty[4]) && UUID.test(segmenty[2])) {
    const meczId = await zapytaj(`turniej_mecze?select=id&turniej_id=eq.${segmenty[2]}&numer=eq.${segmenty[4]}`);
    if (meczId) {
      segmenty[4] = meczId;
      zmienione = true;
    }
  }

  if (!zmienione) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = segmenty.join('/');
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/turnieje/:path+', '/wydarzenia/:path+'],
};
