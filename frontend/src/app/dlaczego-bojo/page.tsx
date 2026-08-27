import type { Metadata } from 'next';
import Link from 'next/link';
import StronaTresci from '@/components/tresc/StronaTresci';
import SekcjaTresci from '@/components/tresc/SekcjaTresci';
import MiniFaq from '@/components/tresc/MiniFaq';
import { DLACZEGO_ODPOWIEDZ, CO_UWIERA, TABELA_POROWNAWCZA, DLACZEGO_PROZA } from '@/content/dlaczego';
import { FAQ } from '@/content/faq';
import { faqJsonLd } from '@/lib/structuredData';

export const metadata: Metadata = {
  title: 'Dlaczego Bojo — alternatywa dla grupy na WhatsAppie i Facebooku',
  description:
    'Bojo zamiast grupy na Facebooku, wątku na Messengerze i ankiety na WhatsAppie do ' +
    'organizowania amatorskich meczów — bez zakładania kolejnego konta dla graczy.',
  alternates: { canonical: '/dlaczego-bojo' },
};

const PYTANIA_TUTAJ = [
  'Czy gracze muszą zakładać konto, żeby dołączyć do mojego meczu?',
  'Czy muszę instalować aplikację?',
  'Czy Bojo jest darmowe?',
  'Gdzie działa Bojo?',
];
const FAQ_TUTAJ = FAQ.filter((p) => PYTANIA_TUTAJ.includes(p.q));

export default function DlaczegoBojoPage() {
  return (
    <StronaTresci
      nadtytul="Dla organizatora"
      h1="Dlaczego Bojo zamiast wątku na Messengerze"
      lead="Argumenty na wypadek, gdy ktoś z ekipy zapyta, po co kolejna aplikacja."
      tytulDlaOkruszkow="Dlaczego Bojo"
    >
      {/* Direct Answer nad pierwszą sekcją — odpowiedź wprost dla kogoś, kto
          przyszedł z zapytania o alternatywę dla grupy na czacie. */}
      <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-900">
        {DLACZEGO_ODPOWIEDZ}
      </p>

      <SekcjaTresci id="co-uwiera" tytul="Co uwiera w grupie na Facebooku i w ankiecie na WhatsAppie">
        <ul className="list-disc space-y-2 pl-5">
          {CO_UWIERA.map((p) => <li key={p}>{p}</li>)}
        </ul>
      </SekcjaTresci>

      <SekcjaTresci id="roznice" tytul="Co Bojo robi inaczej">
        {/* JEDEN znacznik, dwa układy CSS — karty na telefonie, tabela od md: w górę.
            Do 2026-08-26 stały tu DWA bloki (`md:hidden` karty + `hidden md:block`
            tabela), więc cała treść porównania szła do DOM-u dwa razy: dziesięć
            wierszy razy trzy pola. Człowiek widział jedną wersję (drugą chowało CSS),
            ale robot dostawał obie i to samo zdanie liczyło się podwójnie.
            Dziś wiersz jest blokiem (kartą) na telefonie i wraca do `table-row`
            od `md:` w górę. Nagłówki kolumn zostają schowane na telefonie, bo
            w układzie kart powtarzałyby etykietę stojącą obok wartości — tak samo
            jak w poprzedniej wersji kartowej, więc a11y nie traci nic, co miała.
            Kierunek wyłącznie `min-width` (AGENTS.md, „Mobile-first"). */}
        <div className="md:overflow-x-auto">
          <table className="block w-full text-left text-sm md:table">
            <thead className="hidden md:table-header-group">
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 pr-4 font-semibold text-slate-500">Co</th>
                <th className="py-2 pr-4 font-semibold text-slate-500">Grupa FB / ankieta WhatsApp</th>
                <th className="py-2 font-semibold text-slate-500">Bojo</th>
              </tr>
            </thead>
            <tbody className="block space-y-3 md:table-row-group md:space-y-0">
              {TABELA_POROWNAWCZA.map((w) => (
                <tr
                  key={w.co}
                  className="block rounded-xl border border-slate-200 p-3 dark:border-slate-700 md:table-row md:rounded-none md:border-0 md:border-b md:border-slate-100 md:p-0 md:last:border-b-0 md:dark:border-slate-800"
                >
                  <td className="block text-xs font-semibold uppercase tracking-wide text-slate-400 md:table-cell md:py-2.5 md:pr-4 md:text-sm md:font-medium md:normal-case md:tracking-normal md:text-ink">
                    {w.co}
                  </td>
                  <td className="mt-1.5 block text-sm text-slate-500 line-through decoration-slate-300 md:mt-0 md:table-cell md:py-2.5 md:pr-4 md:no-underline">
                    {w.fb}
                  </td>
                  <td className="mt-1 block text-sm font-medium text-ink md:mt-0 md:table-cell md:py-2.5">
                    {w.bojo}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SekcjaTresci>

      {DLACZEGO_PROZA.map((sekcja) => (
        <SekcjaTresci key={sekcja.id} id={sekcja.id} tytul={sekcja.tytul}>
          {sekcja.akapity.map((a, i) => <p key={i}>{a}</p>)}
        </SekcjaTresci>
      ))}

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
            href="/mapa?gry=0"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:bg-white dark:border-slate-600 dark:text-slate-300"
          >
            Mapa boisk
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
