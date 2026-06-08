import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import HomeHero from '@/components/home/HomeHero';
import TrustBar from '@/components/home/TrustBar';
import FeaturesSection from '@/components/home/FeaturesSection';

export default function HomePage() {
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
      {/* Hero — personalized for logged-in users, marketing for visitors */}
      <HomeHero />

      {/* Community / social-proof bar */}
      <TrustBar />

      {/* Features — phone mockups with real screenshots */}
      <FeaturesSection />

      {/* Closing CTA */}
      <section className="hero-surface relative overflow-hidden px-4 py-20 text-center text-white">
        <div className="hero-dots absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-xl">
          <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            Następna gierka jest blisko.
          </h2>
          <div className="mt-8">
            <Link href="/wydarzenia">
              <Button
                size="lg"
                className="bg-[#F5A623] text-[#1A1D21] font-bold hover:bg-amber-400 border-transparent shadow-lg"
              >
                Znajdź mecz w okolicy <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      </main>

      {/* Footer */}
      <footer className="bg-slate-900 px-4 py-10 text-slate-400">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-sm font-semibold text-white">Bojo · Poznań i okolice</p>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
            <Link href="/wydarzenia" className="transition-colors hover:text-white">Znajdź grę</Link>
            <Link href="/wydarzenia/nowe" className="transition-colors hover:text-white">Zorganizuj grę</Link>
            <Link href="/mapa" className="transition-colors hover:text-white">Mapa boisk</Link>
            <Link href="/cykliczne" className="transition-colors hover:text-white">Stałe gierki</Link>
            <span className="hidden text-slate-600 md:inline">·</span>
            <Link href="/prywatnosc" className="text-slate-500 transition-colors hover:text-white">Prywatność</Link>
            <Link href="/regulamin" className="text-slate-500 transition-colors hover:text-white">Regulamin</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
