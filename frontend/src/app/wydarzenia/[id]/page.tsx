import type { Metadata } from 'next';
import { eventJsonLd } from '@/lib/structuredData';
import { getEventMeta, metadataDlaMeczu } from './eventMeta';
import EventDetailClient from './EventDetailClient';

// Server wrapper: provides per-event link-preview metadata (Open Graph), then
// renders the interactive client component. Without this, shared links showed
// the generic site title instead of the actual match details.
//
// `openGraph.images`/`twitter` NIE są tu ustawiane — obrazek podglądu
// dostarcza plik konwencji `opengraph-image.tsx` w tym samym katalogu
// (generowany per mecz: sport, termin, miejsce, wolne miejsca), łącznie
// z obsługą `cover_image_url`, gdyby kiedyś powstało UI do jego ustawiania.
// Next.js łączy oba źródła metadanych automatycznie.
//
// EventMeta/getEventMeta wydzielone do ./eventMeta.ts (współdzielone
// z opengraph-image.tsx) — patrz tamten plik, w tym lat/lng dla
// `location.geo` w danych strukturalnych (lib/structuredData.ts).
//
// Metadane składa `metadataDlaMeczu()` z tego samego pliku. Próg „tylko mecz
// publiczny" siedzi TAM, w jednym miejscu i pod testem — nie tutaj.

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  return metadataDlaMeczu(params.id, await getEventMeta(params.id));
}

export default async function EventPage({ params }: { params: { id: string } }) {
  const ev = await getEventMeta(params.id);
  const jsonLd = ev ? eventJsonLd(params.id, ev) : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <EventDetailClient />
    </>
  );
}
