import Link from 'next/link';
import { SHOW_RECURRING } from '@/lib/features';

/** Mobile-first: kolumna grup na telefonie, wiersz od `md:` w górę. Dwie
 *  grupy linków zamiast jednej płaskiej listy — "Produkt" (co da się zrobić
 *  w aplikacji) i "Bojo" (strony treści dodane pod SEO/GEO/AEO + prawne). */
function GrupaLinkow({ tytul, children }: { tytul: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{tytul}</p>
      <div className="mt-2.5 flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-2">
        {children}
      </div>
    </div>
  );
}

export default function SiteFooter() {
  return (
    // id is a hook for the landing's sticky CTA, which hides itself once the
    // footer is on screen so it never covers these links.
    <footer id="site-footer" className="bg-slate-900 px-4 py-10 text-slate-400">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 md:flex-row md:justify-between">
        <p className="text-sm font-semibold text-white">Bojo · mecze i boiska w całej Polsce</p>

        <div className="flex flex-col gap-6 sm:flex-row sm:gap-10">
          <GrupaLinkow tytul="Produkt">
            <Link href="/wydarzenia" className="transition-colors hover:text-white">Znajdź mecz</Link>
            <Link href="/wydarzenia/nowe" className="transition-colors hover:text-white">Zorganizuj mecz</Link>
            <Link href="/mapa" className="transition-colors hover:text-white">Mapa boisk</Link>
            <Link href="/grupy" className="transition-colors hover:text-white">Grupy</Link>
            {SHOW_RECURRING && (
              <Link href="/cykliczne" className="transition-colors hover:text-white">Stałe gierki</Link>
            )}
          </GrupaLinkow>

          <GrupaLinkow tytul="Bojo">
            <Link href="/jak-dziala-bojo" className="transition-colors hover:text-white">Jak działa Bojo</Link>
            <Link href="/dlaczego-bojo" className="transition-colors hover:text-white">Dlaczego Bojo</Link>
            <Link href="/faq" className="transition-colors hover:text-white">FAQ</Link>
            <Link href="/o-nas" className="transition-colors hover:text-white">O nas</Link>
            <Link href="/prywatnosc" className="text-slate-500 transition-colors hover:text-white">Prywatność</Link>
            <Link href="/regulamin" className="text-slate-500 transition-colors hover:text-white">Regulamin</Link>
          </GrupaLinkow>
        </div>
      </div>
    </footer>
  );
}
