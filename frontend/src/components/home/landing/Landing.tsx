import LandingHero from './LandingHero';
import LandingStats from './LandingStats';
import LandingHowItWorks from './LandingHowItWorks';
import LandingOpenGames from './LandingOpenGames';
import LandingValues from './LandingValues';
import LandingVenues from './LandingVenues';
import LandingFaq from './LandingFaq';
import LandingFinalCta from './LandingFinalCta';
import StickyCta from './StickyCta';

/** The logged-out landing page. Server-rendered so the marketing copy ships
 *  in the first response — no client JS required to read it. */
export default function Landing({ venueCount }: { venueCount: number | null }) {
  return (
    <>
      <div className="pb-24 md:pb-0">
        <LandingHero venueCount={venueCount} />
        <LandingStats venueCount={venueCount} />
        <LandingHowItWorks />
        <LandingOpenGames />
        <LandingValues />
        <LandingVenues />
        <LandingFaq />
        <LandingFinalCta />
      </div>
      <StickyCta />
    </>
  );
}
