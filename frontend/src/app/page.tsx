import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import SiteFooter from '@/components/layout/SiteFooter';
import HomeSwitch from '@/components/home/HomeSwitch';
import Landing from '@/components/home/landing/Landing';
import { LANDING_FAQ } from '@/components/home/landing/content';
import { getPublicVenueCount } from '@/lib/landingStats';
import { faqJsonLd } from '@/lib/structuredData';

// Title/description come from the root layout; only the canonical is local.
export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default async function HomePage() {
  const venueCount = await getPublicVenueCount();

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[2000] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-700 focus:shadow-lg focus:ring-2 focus:ring-primary-600"
      >
        Przejdź do treści
      </a>
      <Header />

      <main id="main" className="flex-1">
        <HomeSwitch landing={<Landing venueCount={venueCount} />} />
      </main>

      <SiteFooter />

      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(LANDING_FAQ)) }}
      />
    </div>
  );
}
