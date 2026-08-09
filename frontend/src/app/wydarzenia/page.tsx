import type { Metadata } from 'next';
import EventsListClient from './EventsListClient';

// Server wrapper: the list is a client component, but the route needs its own
// metadata — without this it inherits the generic site title from the layout.
export const metadata: Metadata = {
  title: 'Mecze i gry w Polsce — dołącz dziś',
  description:
    'Publiczne mecze piłki nożnej, koszykówki i siatkówki w całej Polsce. Zobacz, kto szuka graczy, i dołącz jednym kliknięciem.',
  alternates: { canonical: '/wydarzenia' },
};

export default function EventsPage() {
  return <EventsListClient />;
}
