import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { autoryzujTurniej, klientR2, nazwaBucketu } from '../_wspolne';

// Wystawia podpisany URL do WGRANIA pliku wprost z przeglądarki do R2 —
// przeglądarka nigdy nie widzi kluczy S3, tylko URL ważny 5 minut i
// przypisany do JEDNEJ ścieżki. Odczyt idzie poza tym endpointem, wprost
// pod NEXT_PUBLIC_R2_PUBLIC_URL (bucket jest publiczny do czytania).
export async function POST(req: Request) {
  let cialo: { sciezka?: unknown; typ?: unknown };
  try {
    cialo = await req.json();
  } catch {
    return Response.json({ error: 'Niepoprawne zapytanie' }, { status: 400 });
  }

  const { sciezka, typ } = cialo;
  if (typeof sciezka !== 'string' || typeof typ !== 'string' || !typ.startsWith('image/')) {
    return Response.json({ error: 'Niepoprawne zapytanie' }, { status: 400 });
  }

  const turniejId = await autoryzujTurniej(req, sciezka);
  if (!turniejId) return Response.json({ error: 'Brak uprawnień do tego turnieju' }, { status: 403 });

  const bucket = nazwaBucketu();
  const client = klientR2();
  if (!bucket || !client) {
    return Response.json({ error: 'Magazyn zdjęć nie jest skonfigurowany' }, { status: 500 });
  }

  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: bucket, Key: sciezka, ContentType: typ }),
    { expiresIn: 300 },
  );

  return Response.json({ uploadUrl });
}
