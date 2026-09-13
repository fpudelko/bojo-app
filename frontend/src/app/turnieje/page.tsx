import type { Metadata } from 'next';
import TurniejeClient from './TurniejeClient';
import SiteFooter from '@/components/layout/SiteFooter';

// Za flagą SHOW_TURNIEJE — patrz lib/features.ts. Metadata gotowa na
// odmrożenie w Etapie 4; do tego czasu robots.ts blokuje skanowanie.
export const metadata: Metadata = {
  title: 'Turnieje',
  description: 'Zapisy drużyn, terminarz i wyniki na żywo — turnieje amatorskie prowadzone w Bojo.',
  alternates: { canonical: '/turnieje' },
};

export default function TurniejePage() {
  return (
    <>
      <TurniejeClient />
      <SiteFooter />
    </>
  );
}
