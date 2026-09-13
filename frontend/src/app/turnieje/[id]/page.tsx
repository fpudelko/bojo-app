import { Suspense } from 'react';
import type { Metadata } from 'next';
import TurniejClient from './TurniejClient';
import { generateTurniejMetadata } from './turniejMeta';

// Bez generateStaticParams — trasa renderuje się na żądanie. Prerenderowanie
// per turniej powtórzyłoby błąd `/boisko/[id]` opisany w AGENTS.md (build
// liniowy względem liczby wierszy w tabeli).
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  return generateTurniejMetadata(params.id);
}

export default function TurniejPage() {
  // TurniejClient czyta ?tab= przez useSearchParams — wymaga <Suspense>,
  // tak jak GroupDetailClient na /grupy/[id].
  return (
    <Suspense>
      <TurniejClient />
    </Suspense>
  );
}
