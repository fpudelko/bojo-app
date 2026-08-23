import type { Metadata } from 'next';
import DmRozmowaClient from './DmRozmowaClient';

// Serwerowa otoczka: nazwa rozmówcy doczytuje się po stronie klienta, więc
// metadane są ogólne. `noindex` — prywatna korespondencja.
export const metadata: Metadata = {
  title: 'Rozmowa prywatna',
  description: 'Prywatna rozmowa między graczami Bojo.',
  robots: { index: false, follow: false },
};

export default function DmRozmowaPage() {
  return <DmRozmowaClient />;
}
