import type { Metadata } from 'next';
import RozmowaGrupyClient from './RozmowaGrupyClient';

// Serwerowa otoczka: nazwa ekipy doczytuje się po stronie klienta, więc
// metadane są ogólne. `noindex` — rozmowa jest wyłącznie dla członków ekipy.
export const metadata: Metadata = {
  title: 'Rozmowa ekipy',
  description: 'Rozmowa ekipy w Bojo.',
  robots: { index: false, follow: false },
};

export default function RozmowaGrupyPage() {
  return <RozmowaGrupyClient />;
}
