import type { Metadata } from 'next';
import JestemClient from './JestemClient';

// Ekran pośredni z paska „trwa turniej”, nie treść do wyszukiwarki.
export const metadata: Metadata = {
  title: 'Znajdź swoją drużynę',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <JestemClient />;
}
