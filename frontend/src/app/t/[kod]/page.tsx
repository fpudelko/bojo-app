import type { Metadata } from 'next';
import LinkClient from './LinkClient';
import { druzynaPoKodzieDoPodgladu, metadataLinkuTurnieju } from '@/app/turnieje/[id]/turniejMeta';

// Podgląd linku drużyny: obrazek i opis turnieju, nie ogólna karta Bojo.
export async function generateMetadata({ params }: { params: { kod: string } }): Promise<Metadata> {
  const d = await druzynaPoKodzieDoPodgladu(params.kod).catch(() => null);
  return metadataLinkuTurnieju(d?.turniejId, (nazwa) => `Dołącz do drużyny ${d?.nazwa ?? ''} · ${nazwa}`, `/t/${params.kod}`);
}

export default function Page() {
  return <LinkClient />;
}
