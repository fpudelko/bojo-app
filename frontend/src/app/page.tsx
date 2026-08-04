import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Header from '@/components/layout/Header';
import SiteFooter from '@/components/layout/SiteFooter';
import HomeSwitch from '@/components/home/HomeSwitch';
import AppHomeSkeleton from '@/components/home/AppHomeSkeleton';
import Landing from '@/components/home/landing/Landing';
import { LANDING_FAQ } from '@/components/home/landing/content';
import { getPublicVenueCount } from '@/lib/landingStats';
import { faqJsonLd } from '@/lib/structuredData';
import { SESSION_HINT_COOKIE } from '@/lib/sessionHint';

// Title/description come from the root layout; only the canonical is local.
export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default async function HomePage() {
  const venueCount = await getPublicVenueCount();
  // Presentational only — see lib/sessionHint.ts. Reading it here is what
  // makes "/" a dynamic route; that's intentional, not a regression (this
  // page already queried Supabase for venueCount on every render).
  const signedInHint = cookies().get(SESSION_HINT_COOKIE)?.value === '1';

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
        <HomeSwitch
          hint={signedInHint}
          landing={<Landing venueCount={venueCount} />}
          skeleton={<AppHomeSkeleton />}
        />
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
