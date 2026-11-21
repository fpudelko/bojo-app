import type { Metadata } from 'next';
import EkranClient from './EkranClient';

// Ekran turnieju na halę (rzutnik, telewizor, drugi monitor). Publiczny jak
// strona turnieju, ale bez indeksowania: to kopia tych samych danych
// w formie do wyświetlania na ścianie, nie strona do wyszukiwarki.
export const metadata: Metadata = {
  title: 'Ekran turnieju',
  robots: { index: false, follow: false },
};

export default function EkranTurniejuPage() {
  return <EkranClient />;
}
