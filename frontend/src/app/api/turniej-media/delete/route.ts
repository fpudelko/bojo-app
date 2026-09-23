import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { autoryzujTurniej, klientR2, nazwaBucketu } from '../_wspolne';

export async function POST(req: Request) {
  let cialo: { sciezka?: unknown };
  try {
    cialo = await req.json();
  } catch {
    return Response.json({ error: 'Niepoprawne zapytanie' }, { status: 400 });
  }

  const { sciezka } = cialo;
  if (typeof sciezka !== 'string') {
    return Response.json({ error: 'Niepoprawne zapytanie' }, { status: 400 });
  }

  const turniejId = await autoryzujTurniej(req, sciezka);
  if (!turniejId) return Response.json({ error: 'Brak uprawnień do tego turnieju' }, { status: 403 });

  const bucket = nazwaBucketu();
  const client = klientR2();
  if (!bucket || !client) {
    return Response.json({ error: 'Magazyn zdjęć nie jest skonfigurowany' }, { status: 500 });
  }

  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: sciezka }));
  return Response.json({ ok: true });
}
