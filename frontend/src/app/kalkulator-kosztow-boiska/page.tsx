import type { Metadata } from 'next';
import StronaTresci from '@/components/tresc/StronaTresci';
import MiniFaq from '@/components/tresc/MiniFaq';
import KalkulatorKosztow from './KalkulatorKosztow';
import { KALKULATOR_ODPOWIEDZ, KALKULATOR_PYTANIA } from '@/content/kalkulator';
import { FAQ } from '@/content/faq';
import { faqJsonLd } from '@/lib/structuredData';

// Pozycja N1 (docs/seo-geo-strategia.md, rozdz. 4a) — jedyna strona w planie
// SEO/GEO, która nie potrzebuje ani jednego użytkownika, ani jednego meczu,
// żeby być użyteczna: odpowiada na pytanie "jak podzielić koszt boiska"
// niezależnie od tego, czy ktokolwiek zna Bojo. Strona statyczna, kalkulator
// po stronie klienta — bez useSearchParams(), bez zapytań do bazy.
export const metadata: Metadata = {
  title: 'Kalkulator kosztów boiska — podziel rachunek na graczy',
  description:
    'Oblicz, ile od osoby przy wynajmie boiska, hali czy orlika — z uwzględnieniem ' +
    'zniżek z kart Multisport, FitProfit i Medicover Sport. Bez rejestracji.',
  alternates: { canonical: '/kalkulator-kosztow-boiska' },
};

const FAQ_TUTAJ = FAQ.filter((p) => KALKULATOR_PYTANIA.includes(p.q));

export default function KalkulatorKosztowBoiskaPage() {
  return (
    <StronaTresci
      nadtytul="Narzędzie"
      h1="Kalkulator kosztów boiska"
      lead="Ile od osoby za wynajem hali czy orlika — z uwzględnieniem kart sportowych."
      tytulDlaOkruszkow="Kalkulator kosztów boiska"
    >
      {/* Direct Answer nad kalkulatorem — ten sam wzorzec co /jak-dziala-bojo
          i /dlaczego-bojo: odpowiedź wprost, zanim czytelnik dotknie formularza. */}
      <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-900">
        {KALKULATOR_ODPOWIEDZ}
      </p>

      <KalkulatorKosztow />

      <section id="pytania" className="scroll-mt-20">
        <h2 className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">
          Pytania o rozliczenia
        </h2>
        <div className="mt-3">
          <MiniFaq pytania={FAQ_TUTAJ} />
        </div>
      </section>

      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQ_TUTAJ)) }}
      />
    </StronaTresci>
  );
}
