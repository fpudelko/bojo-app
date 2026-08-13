import type { Metadata } from 'next';
import Link from 'next/link';
import StronaTresci from '@/components/tresc/StronaTresci';
import SekcjaTresci from '@/components/tresc/SekcjaTresci';
import { CO_UWIERA, TABELA_POROWNAWCZA, DLACZEGO_PROZA } from '@/content/dlaczego';

export const metadata: Metadata = {
  title: 'Dlaczego Bojo',
  description:
    'Co Bojo robi inaczej niż grupa na Facebooku i ankieta na WhatsAppie — i dlaczego ' +
    'gracze nie muszą zakładać konta, żeby dołączyć do meczu.',
  alternates: { canonical: '/dlaczego-bojo' },
};

export default function DlaczegoBojoPage() {
  return (
    <StronaTresci
      nadtytul="Dla organizatora"
      h1="Dlaczego Bojo zamiast wątku na Messengerze"
      lead="Argumenty na wypadek, gdy ktoś z ekipy zapyta, po co kolejna aplikacja."
      tytulDlaOkruszkow="Dlaczego Bojo"
    >
      <SekcjaTresci id="co-uwiera" tytul="Co uwiera w grupie na Facebooku i w ankiecie na WhatsAppie">
        <ul className="list-disc space-y-2 pl-5">
          {CO_UWIERA.map((p) => <li key={p}>{p}</li>)}
        </ul>
      </SekcjaTresci>

      <SekcjaTresci id="roznice" tytul="Co Bojo robi inaczej">
        {/* Karty na telefonie, tabela od md: w górę — nigdy odwrotnie. */}
        <div className="space-y-3 md:hidden">
          {TABELA_POROWNAWCZA.map((w) => (
            <div key={w.co} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{w.co}</p>
              <p className="mt-1.5 text-sm text-slate-500 line-through decoration-slate-300">{w.fb}</p>
              <p className="mt-1 text-sm font-medium text-ink">{w.bojo}</p>
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 pr-4 font-semibold text-slate-500">Co</th>
                <th className="py-2 pr-4 font-semibold text-slate-500">Grupa FB / ankieta WhatsApp</th>
                <th className="py-2 font-semibold text-slate-500">Bojo</th>
              </tr>
            </thead>
            <tbody>
              {TABELA_POROWNAWCZA.map((w) => (
                <tr key={w.co} className="border-b border-slate-100 last:border-b-0 dark:border-slate-800">
                  <td className="py-2.5 pr-4 font-medium text-ink">{w.co}</td>
                  <td className="py-2.5 pr-4 text-slate-500">{w.fb}</td>
                  <td className="py-2.5 font-medium text-ink">{w.bojo}</td>
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
        </div>
      </section>
    </StronaTresci>
  );
}
