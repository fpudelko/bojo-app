import { PutObjectCommand } from '@aws-sdk/client-s3';
import { autoryzujTurniej, klientR2, nazwaBucketu } from '../_wspolne';

// ZAPASOWA DROGA WGRANIA PRZEZ SERWER (2026-11-27). Wgranie wprost
// z przeglądarki do R2 (`upload-url`) zależy od reguły CORS na buckecie,
// ustawianej ręcznie w Cloudflare Dashboard. Bez niej przeglądarka kończy na
// „Failed to fetch” i ani zdjęcie, ani logo sponsora nie wchodzi (test przed
// turniejem 28.11). Tu plik idzie przez funkcję Vercela, więc CORS nie gra
// roli; limit treści żądania Vercela to 4,5 MB, dlatego klient zmniejsza
// zdjęcie przed wysłaniem (`storageUpload.ts`), a serwer odrzuca więcej niż 4 MB.
const MAKS = 4 * 1024 * 1024;

export async function POST(req: Request) {
  const sciezka = req.headers.get('x-sciezka') ?? '';
  const typ = req.headers.get('content-type') ?? '';
  if (!sciezka || !typ.startsWith('image/')) {
    return Response.json({ error: 'Niepoprawne zapytanie' }, { status: 400 });
  }

  const turniejId = await autoryzujTurniej(req, sciezka);
  if (!turniejId) return Response.json({ error: 'Brak uprawnień do tego turnieju' }, { status: 403 });

  const bucket = nazwaBucketu();
  const client = klientR2();
  if (!bucket || !client) {
    return Response.json({ error: 'Magazyn zdjęć nie jest skonfigurowany' }, { status: 500 });
  }

  const tresc = Buffer.from(await req.arrayBuffer());
  if (tresc.length === 0) return Response.json({ error: 'Pusty plik' }, { status: 400 });
  if (tresc.length > MAKS) return Response.json({ error: 'Plik jest za duży (maks. 4 MB po zmniejszeniu)' }, { status: 413 });

  await client.send(new PutObjectCommand({ Bucket: bucket, Key: sciezka, ContentType: typ, Body: tresc }));
  return Response.json({ ok: true });
}
