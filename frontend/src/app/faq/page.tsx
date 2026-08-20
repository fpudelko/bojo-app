import type { Metadata } from 'next';
import StronaTresci from '@/components/tresc/StronaTresci';
import SpisTresci from '@/components/tresc/SpisTresci';
import MiniFaq from '@/components/tresc/MiniFaq';
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
          <div className="mt-3">
            <MiniFaq pytania={FAQ.filter((p) => p.kategoria === kat.klucz)} />
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
