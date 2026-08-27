import { ChevronDown } from 'lucide-react';
import type { PytanieFaq } from '@/content/faq';

/** Mały accordion pytań na stronie treści — ten sam markup co `/faq`
 *  (`app/faq/page.tsx`), wyciągnięty żeby nie duplikować JSX w kolejnych
 *  miejscach. Renderuj TYLKO pytania, nad którymi wołasz też `faqJsonLd()`
 *  z tym samym podzbiorem — schema bez pokrycia w widocznym tekście jest
 *  sygnałem spamu, nie boostem (patrz `lib/structuredData.ts`).
 *
 *  Pytanie jest owinięte w `<h3>` (docs/seo-geo-strategia.md, rozdział 3d):
 *  bez tego strona miała H1 i sześć H2 (kategorie), ale ani jednego H3 —
 *  struktura nagłówków jest głównym sposobem, w jaki model dzieli długą
 *  stronę na cytowalne kawałki, a we wszystkich pięciu miejscach, gdzie ten
 *  komponent się renderuje, poprzedza go H2 sekcji „Najczęstsze pytania". */
export default function MiniFaq({ pytania }: { pytania: readonly PytanieFaq[] }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white px-5 dark:border-slate-700/80 dark:bg-slate-800 sm:px-6">
      {pytania.map((item) => (
        <details key={item.q} className="group border-b border-slate-200 py-4 last:border-b-0 dark:border-slate-700">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
            <h3 className="font-semibold text-ink">{item.q}</h3>
            <ChevronDown
              className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <p className="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {item.a}
          </p>
        </details>
      ))}
    </div>
  );
}
