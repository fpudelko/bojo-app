import type { Metadata } from 'next';
import GroupsClient from './GroupsClient';

// Server wrapper: the list is a client component, but the route needs its own
// metadata — without this it inherits the generic site title from the layout.
export const metadata: Metadata = {
  title: 'Grupy — stałe ekipy sportowe',
  description:
    'Załóż stałą ekipę albo dołącz przez link zaproszenia. Historia meczów i składów grupy w jednym miejscu.',
  alternates: { canonical: '/grupy' },
};

export default function GroupsPage() {
  return <GroupsClient />;
}
