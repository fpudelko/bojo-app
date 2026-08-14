import type { Metadata } from 'next';
import { ChevronDown } from 'lucide-react';
import StronaTresci from '@/components/tresc/StronaTresci';
import SpisTresci from '@/components/tresc/SpisTresci';
import { FAQ, KATEGORIE_FAQ } from '@/content/faq';
import { faqJsonLd } from '@/lib/structuredData';

export const metadata: Metadata = {
  title: 'FAQ — pytania o Bojo',
  description:
    'Wszystkie pytania i odpowiedzi o Bojo: konto i logowanie, organizację meczu, ' +
    'pieniądze, ekipy i boiska.',
  alternates: { canonical: '/faq' },
};

export default function FaqPage() {
  return (
    <StronaTresci
      nadtytul="Pomoc"
      h1="Pytania i odpowiedzi o Bojo"
      lead="Wszystko w jednym miejscu — od zakładania konta po rozliczenie po meczu. Podzielone na sześć krótkich kategorii."
      tytulDlaOkruszkow="FAQ"
    >
      <SpisTresci
        pozycje={KATEGORIE_FAQ.map((k) => ({ id: k.kotwica, label: k.tytul }))}
      />

      {KATEGORIE_FAQ.map((kat) => (
        <section key={kat.klucz} id={kat.kotwica} className="scroll-mt-20">
          <h2 className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">
            {kat.tytul}
          </h2>
          <div className="mt-3 rounded-2xl border border-slate-200/80 bg-white px-5 dark:border-slate-700/80 dark:bg-slate-800 sm:px-6">
            {FAQ.filter((p) => p.kategoria === kat.klucz).map((item) => (
              <details key={item.q} className="group border-b border-slate-200 py-4 last:border-b-0 dark:border-slate-700">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink [&::-webkit-details-marker]:hidden">
                  {item.q}
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
        </section>
      ))}

      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQ)) }}
      />
    </StronaTresci>
  );
}
