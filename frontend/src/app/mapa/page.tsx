import type { Metadata } from 'next';
import MapaClient from './MapaClient';

// Server wrapper: the map itself is a client component (Leaflet, ssr:false),
// but the route needs its own metadata — without this it inherits the generic
// site title from the root layout.
export const metadata: Metadata = {
  title: 'Mapa boisk i meczów w Poznaniu',
  description:
    'Interaktywna mapa ~1400 boisk i obiektów sportowych w Poznaniu z aktywnymi meczami. Filtry po sporcie, nawierzchni i dzielnicy.',
  alternates: { canonical: '/mapa' },
};

export default function MapaPage() {
  return <MapaClient />;
}
