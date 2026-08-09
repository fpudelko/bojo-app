import type { Metadata } from 'next';
import MapaClient from './MapaClient';

// Server wrapper: the map itself is a client component (Leaflet, ssr:false),
// but the route needs its own metadata — without this it inherits the generic
// site title from the root layout.
export const metadata: Metadata = {
  title: 'Mapa boisk i meczów w Polsce',
  description:
    'Interaktywna mapa boisk i obiektów sportowych w całej Polsce, z aktywnymi meczami. Filtry po sporcie, typie obiektu i nawierzchni.',
  alternates: { canonical: '/mapa' },
};

export default function MapaPage() {
  return <MapaClient />;
}
