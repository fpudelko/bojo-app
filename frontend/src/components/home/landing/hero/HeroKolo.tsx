/**
 * Koło środkowe boiska za telefonem: jedyna „linia boiska” w tle pierwszego
 * ekranu (pasy koszenia siedzą w `.hero-surface-deep`, globals.css).
 *
 * Rysunek jest wyśrodkowany na kolumnie telefonu, a jego średnica (ok. 78%
 * boku SVG) mieści się w szerokości tej kolumny, więc koło nie wchodzi pod
 * nagłówek ani opis (te stoją w lewej kolumnie). Sama obręcz, bez linii
 * środkowej: linia rozciągnęłaby się pod tekst. Kolor to biel o niskiej
 * wyrazistości: ma podkreślać telefon, nie z nim konkurować.
 *
 * Komponent serwerowy, sam znacznik SVG, bez skryptu. `pointer-events-none`,
 * bo rysunek leży pod paskami rozdziałów, które trzeba dać się kliknąć.
 */
export default function HeroKolo() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="-300 -300 600 600"
      className="pointer-events-none absolute left-1/2 top-1/2 md:top-[calc(var(--ha-h)/2)] h-[34rem] w-[34rem] max-w-none -translate-x-1/2 -translate-y-1/2 text-white/[0.09] md:h-[46rem] md:w-[46rem]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle r="190" />
    </svg>
  );
}
