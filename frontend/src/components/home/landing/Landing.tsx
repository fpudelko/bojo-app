import LandingHero from './LandingHero';
import LandingDirectAnswer from './LandingDirectAnswer';
import LandingStats from './LandingStats';
import LandingHowItWorks from './LandingHowItWorks';
import LandingMisja from './LandingMisja';
import LandingOpenGames from './LandingOpenGames';
import LandingValues from './LandingValues';
import LandingVenues from './LandingVenues';
import LandingFaq from './LandingFaq';
import LandingZaproszenie from './LandingZaproszenie';
import StickyCta from './StickyCta';

/** The logged-out landing page. Server-rendered so the marketing copy ships
 *  in the first response — no client JS required to read it.
 *
 * Kolejność sekcji po „Jak to działa" jest celowa: człowiek najpierw
 * rozumie CO Bojo robi (trzy kroki), potem KTO i PO CO (misja), potem
 * DOWÓD (otwarte gry, wartości, boiska), a na końcu, po odpowiedzi na
 * zastrzeżenia (FAQ), dostaje powtórzenie małej prośby z rozmowy
 * z organizatorem (zaproszenie) — patrz docs/outreach-organizatorzy.md. */
export default function Landing() {
  return (
    <>
      <div>
        <LandingHero />
        <LandingDirectAnswer />
        <LandingStats />
        <LandingHowItWorks />
        <LandingMisja />
        <LandingOpenGames />
        <LandingValues />
        <LandingVenues />
        <LandingFaq />
        {/* Bufor pod pływający `StickyCta` na mobile żyje TU, jako dodatkowy
            dolny padding ostatniej sekcji, nie na tym `<div>` jak dawniej —
            LandingZaproszenie ma kolorowe tło (`bg-primary-700`), więc bufor
            poza sekcją (na przezroczystym/`canvas` tle strony) rysował
            widoczny jasny pasek między zieloną sekcją a ciemną stopką. */}
        <LandingZaproszenie />
      </div>
      <StickyCta />
    </>
  );
}
