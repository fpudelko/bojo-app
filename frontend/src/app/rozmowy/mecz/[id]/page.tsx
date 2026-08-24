import type { Metadata } from 'next';
import RozmowaMeczuClient from './RozmowaMeczuClient';

// Serwerowa otoczka: tytuł meczu doczytuje się po stronie klienta, więc
// metadane są ogólne. `noindex` — rozmowa jest dla uczestników meczu.
export const metadata: Metadata = {
  title: 'Rozmowa meczu',
  description: 'Rozmowa uczestników meczu w Bojo.',
  robots: { index: false, follow: false },
};

export default function RozmowaMeczuPage() {
  return <RozmowaMeczuClient />;
}
