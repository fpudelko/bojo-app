import type { Metadata } from 'next';
import GroupsClient from './GroupsClient';
import SiteFooter from '@/components/layout/SiteFooter';

// Server wrapper: the list is a client component, but the route needs its own
// metadata — without this it inherits the generic site title from the layout.
export const metadata: Metadata = {
  title: 'Grupy — stałe ekipy sportowe',
  description:
    'Załóż stałą ekipę albo dołącz przez link zaproszenia. Historia meczów i składów grupy w jednym miejscu.',
  alternates: { canonical: '/grupy' },
};

export default function GroupsPage() {
  // Stopka doklejana tutaj, nie w komponencie klienckim: to jedyne linki
  // w HTML, jakie ta trasa oddaje robotowi. Sama lista dociąga dane po
  // zamontowaniu, więc bez tego strona jest ślepym zaułkiem — figuruje
  // w mapie strony z wysokim priorytetem i nie prowadzi donikąd.
  return (
    <>
      <GroupsClient />
      <SiteFooter />
    </>
  );
}
