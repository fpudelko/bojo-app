import { macierzQr, sciezkaQr } from '@/lib/kodQr';

/** Kod QR jako SVG: czarne moduły na białym tle z marginesem (strefa ciszy). */
export default function KodQr({ tekst, className, etykieta }: { tekst: string; className?: string; etykieta: string }) {
  const macierz = macierzQr(tekst);
  const margines = 2;
  const rozmiar = macierz.length + margines * 2;
  return (
    <svg viewBox={`0 0 ${rozmiar} ${rozmiar}`} className={className} role="img" aria-label={etykieta} shapeRendering="crispEdges">
      <rect width={rozmiar} height={rozmiar} fill="#ffffff" />
      <path d={sciezkaQr(macierz)} transform={`translate(${margines} ${margines})`} fill="#0f172a" />
    </svg>
  );
}
