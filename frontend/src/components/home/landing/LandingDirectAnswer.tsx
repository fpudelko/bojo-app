import { LANDING_DIRECT_ANSWER } from './content';

/** Bezpośrednia odpowiedź na "czym jest Bojo", zaraz pod hero. Osobna,
 *  minimalna sekcja zamiast dopisywania tekstu do LandingStats — hero jest
 *  celowo dostrojone do dokładnie jednego ekranu (patrz komentarz
 *  .hero-first-screen w LandingHero.tsx) i wepchnięcie tu akapitu zepsułoby
 *  tamten rytm; ta sekcja żyje poniżej, poza budżetem pierwszego ekranu. */
export default function LandingDirectAnswer() {
  return (
    <section className="bg-white">
      <p className="mx-auto max-w-2xl px-5 py-5 text-center text-sm leading-relaxed text-slate-600 sm:text-base">
        {LANDING_DIRECT_ANSWER}
      </p>
    </section>
  );
}
