import type { Metadata } from 'next';
import EventsListClient from './EventsListClient';
import SiteFooter from '@/components/layout/SiteFooter';

// Server wrapper: the list is a client component, but the route needs its own
// metadata — without this it inherits the generic site title from the layout.
export const metadata: Metadata = {
  title: 'Mecze i gry w Polsce — dołącz dziś',
  description:
    'Publiczne mecze piłki nożnej, koszykówki i siatkówki w całej Polsce. Zobacz, kto szuka graczy, i dołącz jednym kliknięciem.',
  alternates: { canonical: '/wydarzenia' },
};

export default function EventsPage() {
  // Stopka doklejana tutaj, nie w komponencie klienckim: to jedyne linki
  // w HTML, jakie ta trasa oddaje robotowi. Sama lista dociąga dane po
  // zamontowaniu, więc bez tego strona jest ślepym zaułkiem — figuruje
  // w mapie strony z wysokim priorytetem i nie prowadzi donikąd.
  return (
    <>
      <EventsListClient />
      <SiteFooter />
    </>
  );
}
