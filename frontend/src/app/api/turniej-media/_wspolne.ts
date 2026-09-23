// Wspólne dla obu tras `turniej-media/*` — DRUGI w tym repo endpoint, który
// naprawdę sprawdza tożsamość po stronie serwera (pierwszy, `/api/geocode`,
// tylko przekazuje żądanie dalej i nikogo nie autoryzuje). Powód, dla którego
// ten musi istnieć: Cloudflare R2 nie ma pojęcia o Supabase — w
// przeciwieństwie do bucketów `covers`/`avatars` (Supabase Storage), gdzie
// RLS pilnuje zapisu SAM, tu ktoś musi to sprawdzić, zanim wyda podpisany
// URL. Patrz docs/domena.md#turniej-media-cloudflare-r2.
import { createClient } from '@supabase/supabase-js';
import { S3Client } from '@aws-sdk/client-s3';

/** Ścieżka ma sztywny kształt `turnieje/<turniej_id>/{galeria|sponsorzy}/<uuid>.<ext>`
 *  (ten sam, co w migracji `159`, gdy jeszcze pilnowała go polityka `storage.objects`) —
 *  drugi segment niesie `turniej_id`. Zwraca `null`, gdy kształt się nie zgadza,
 *  żeby wywołujący mógł odrzucić żądanie, zamiast wywalić się z `undefined`. */
export function turniejIdZeSciezki(sciezka: string): string | null {
  const [pierwszy, turniejId] = sciezka.split('/');
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (pierwszy !== 'turnieje' || !turniejId || !UUID.test(turniejId)) return null;
  return turniejId;
}

/** Zwraca `null`, gdy wywołujący nie zarządza turniejem (nieznaleziony token,
 *  obcy, zła ścieżka) — nigdy nie rzuca, żeby trasy miały jedno miejsce do
 *  zamiany na odpowiedź 401/403. */
export async function autoryzujTurniej(req: Request, sciezka: string): Promise<string | null> {
  const turniejId = turniejIdZeSciezki(sciezka);
  if (!turniejId) return null;

  const naglowek = req.headers.get('authorization') ?? '';
  const token = naglowek.startsWith('Bearer ') ? naglowek.slice(7) : '';
  if (!token) return null;

  // Klient z Authorization ustawionym na TOKEN UŻYTKOWNIKA, nie service-role:
  // `czy_zarzadza_turniejem()` czyta `auth.uid()` z tego samego JWT-a, co
  // przy wywołaniu z przeglądarki przez PostgREST. Jedno miejsce prawdy
  // o uprawnieniach (baza), nie druga, równoległa implementacja w Node.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );

  const { data, error } = await supabase.rpc('czy_zarzadza_turniejem', { p_turniej: turniejId });
  if (error || data !== true) return null;
  return turniejId;
}

/** `null`, gdy którejś zmiennej środowiskowej brakuje — endpointy zamieniają
 *  to na 500 z czytelnym komunikatem, zamiast na `TypeError` w środku SDK. */
export function klientR2(): S3Client | null {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) return null;
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });
}

export function nazwaBucketu(): string | null {
  return process.env.R2_BUCKET ?? null;
}
