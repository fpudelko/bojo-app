import type { Metadata } from 'next';
import LinkClient from './LinkClient';
import { druzynaPoKodzieKapitanaDoPodgladu, metadataLinkuTurnieju } from '@/app/turnieje/[id]/turniejMeta';

// Podgląd linku kapitana: obrazek i opis turnieju, nie ogólna karta Bojo.
export async function generateMetadata({ params }: { params: { kod: string } }): Promise<Metadata> {
  const d = await druzynaPoKodzieKapitanaDoPodgladu(params.kod).catch(() => null);
  return metadataLinkuTurnieju(d?.turniejId, (nazwa) => `Link dla kapitana drużyny ${d?.nazwa ?? ''} · ${nazwa}`, `/k/${params.kod}`);
}

export default function Page() {
  return <LinkClient />;
}
