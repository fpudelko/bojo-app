import type { Metadata } from 'next';
import LinkClient from './LinkClient';
import { metadataLinkuTurnieju, zaproszenieOsobyDoPodgladu } from '@/app/turnieje/[id]/turniejMeta';

// Podgląd zaproszenia do prowadzenia: obrazek i opis turnieju.
export async function generateMetadata({ params }: { params: { kod: string } }): Promise<Metadata> {
  const z = await zaproszenieOsobyDoPodgladu(params.kod).catch(() => null);
  const rola = z?.rola === 'wspolorganizator' ? 'Zaproszenie do współorganizowania' : 'Zaproszenie do prowadzenia meczów';
  return metadataLinkuTurnieju(z?.turniejId, (nazwa) => `${rola} · ${nazwa}`, `/o/${params.kod}`);
}

export default function Page() {
  return <LinkClient />;
}
