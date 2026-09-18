import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, Minus } from 'lucide-react';
import StronaTresci from '@/components/tresc/StronaTresci';
import SekcjaTresci from '@/components/tresc/SekcjaTresci';
import MiniFaq from '@/components/tresc/MiniFaq';
import { O_BOJO_ODPOWIEDZ, O_BOJO_DZIALA, O_BOJO_NIE_MA, O_BOJO_PROZA } from '@/content/oBojo';
import { FAQ } from '@/content/faq';
import { faqJsonLd } from '@/lib/structuredData';
import { TYTUL_O_BOJO, OPIS_O_BOJO } from '@/content/metaWyszukiwarki';
import { KONTAKT_HREF } from '@/content/kontakt';

export const metadata: Metadata = {
  title: TYTUL_O_BOJO,
  description: OPIS_O_BOJO,
  alternates: { canonical: '/o-bojo' },
};

const PYTANIA_TUTAJ = [
  'Czy Bojo jest darmowe?',
  'Czy gracze muszą zakładać konto, żeby dołączyć do mojego meczu?',
  'Gdzie działa Bojo?',
];
const FAQ_TUTAJ = FAQ.filter((p) => PYTANIA_TUTAJ.includes(p.q));

export default function OBojoPage() {
  return (
    <StronaTresci
      nadtytul="Po co to robimy"
      h1="Kto robi Bojo i po co"
      lead="Misja, powód, dla którego zaczynamy od organizatorów, i wprost — co działa dziś, a czego jeszcze nie ma."
      tytulDlaOkruszkow="O Bojo"
    >
      {/* Direct Answer nad pierwszą sekcją — ta sama zasada co na
          /dlaczego-bojo i /jak-dziala-bojo: odpowiedź wprost dla kogoś, kto
          przyszedł z linku wklejonego w rozmowie, zanim przeczyta resztę. */}
      <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-900">
        {O_BOJO_ODPOWIEDZ}
      </p>

      {O_BOJO_PROZA.slice(0, 2).map((sekcja) => (
        <SekcjaTresci key={sekcja.id} id={sekcja.id} tytul={sekcja.tytul}>
          {sekcja.akapity.map((a, i) => <p key={i}>{a}</p>)}
        </SekcjaTresci>
      ))}

      {/* Efekt przyznania się do wady (pratfall, Aronson 1966): ujawnienie,
          czego jeszcze nie ma, PRZED resztą strony podnosi wiarygodność
          u kogoś, kto czyta uważnie — a to jest dokładnie ten czytelnik.
          Dwie kolumny od md:, jedna na telefonie (mobile-first). */}
      <SekcjaTresci id="gdzie-jestesmy" tytul="Gdzie jesteśmy dziś — wprost">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="font-display text-sm font-bold text-ink">Co działa dziś</p>
            <ul className="mt-3 space-y-2.5">
              {O_BOJO_DZIALA.map((p) => (
                <li key={p} className="flex gap-2 text-sm leading-relaxed">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" aria-hidden="true" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="font-display text-sm font-bold text-ink">Czego jeszcze nie ma</p>
            <ul className="mt-3 space-y-2.5">
              {O_BOJO_NIE_MA.map((p) => (
                <li key={p} className="flex gap-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  <Minus className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SekcjaTresci>

      <SekcjaTresci id={O_BOJO_PROZA[2].id} tytul={O_BOJO_PROZA[2].tytul}>
        {O_BOJO_PROZA[2].akapity.map((a, i) => <p key={i}>{a}</p>)}
        <p>
          <a
            href={KONTAKT_HREF}
            className="font-semibold text-primary-700 hover:text-primary-800"
          >
            {KONTAKT_HREF.replace('mailto:', '')}
          </a>
        </p>
      </SekcjaTresci>

      <section id="pytania-podstawowe" className="scroll-mt-20">
        <h2 className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">
          Pytania na start
        </h2>
        <div className="mt-3">
          <MiniFaq pytania={FAQ_TUTAJ} />
        </div>
      </section>

      <section className="rounded-2xl border border-primary-200 bg-primary-50 p-5 dark:border-primary-800 dark:bg-primary-950">
        <p className="font-display text-lg font-bold text-ink">Zobacz to na własnym meczu</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/wydarzenia/nowe"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-primary-700 px-5 text-sm font-bold text-white transition hover:bg-primary-800 active:scale-95"
          >
            Zorganizuj mecz
          </Link>
          <Link
            href="/jak-dziala-bojo"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:bg-white dark:border-slate-600 dark:text-slate-300"
          >
            Jak działa Bojo — krok po kroku
          </Link>
          <Link
            href="/dlaczego-bojo"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:bg-white dark:border-slate-600 dark:text-slate-300"
          >
            Dlaczego Bojo
          </Link>
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
