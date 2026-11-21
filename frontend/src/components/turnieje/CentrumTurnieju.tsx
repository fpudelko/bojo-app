'use client';

// „Centrum dowodzenia" w dniu turnieju: panel organizatora od `lg`
// (2026-11-21, ocena „Gramy dla Marysi!” na komputerze). Na laptopie przy
// stoliku organizator ma widzieć naraz: mecz w toku, kolejne mecze, ostatnie
// wyniki i tabele grup. Do tej pory to były trzy miejsca (terminarz w panelu,
// Mecze i Tabele na stronie turnieju), a przy meczu co 14 minut oznaczało to
// przełączanie zakładek przy każdym gwizdku.
//
// Na telefonie się NIE pokazuje (`hidden lg:grid` u wywołującego): tam
// terminarz jest tą listą (decyzja właściciela z 2026-11-20, „bez Pulpitu”).
// Dane i zapisy są te same co w terminarzu i na stronie meczu, tu tylko
// stoją obok siebie.
//
// Kolory wg AGENTS.md: zielony to mecz w toku i awans, niebieski „wymaga
// decyzji”, szary przerwy. Bez „opóźnienia” (decyzja właściciela
// z 2026-11-08, `postepTurnieju()`).
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Coffee } from 'lucide-react';
import Button from '@/components/ui/Button';
import TabelaGrupy from '@/components/turnieje/TabelaGrupy';
import { nazwaSlotu } from '@/components/turnieje/KartaMeczu';
import { centrumTurnieju } from '@/lib/turniejPulpit';
import { terminarzZPrzerwami } from '@/lib/turniejEtykiety';
import { czasGry, jestKoszykowka, jestSportemSetowym, wymaganeKarne } from '@/lib/turniejWynik';
import { chwilaWPolsce } from '@/lib/czasPolski';
import { plural, withCount } from '@/lib/plural';
import type { Turniej, TurniejGrupa, TurniejMecz, TurniejPrzerwa, WierszTabeli } from '@/types';

export interface CentrumTurniejuProps {
  turniej: Turniej;
  mecze: TurniejMecz[];
  przerwy: TurniejPrzerwa[];
  druzynyPoId: Map<string, string>;
  meczePoId: Map<string, TurniejMecz>;
  arenyPoId: Map<string, string>;
  grupyPoId: ReadonlyMap<string, TurniejGrupa>;
  tabele: { grupa?: TurniejGrupa; wiersze: WierszTabeli[] }[];
  liczbaZgloszen: number;
  teraz: Date;
  /** Akcje: wywołujący zapisuje i odświeża dane panelu. */
  onRozpocznij: (m: TurniejMecz) => void;
  onGol: (m: TurniejMecz, druzynaId: string) => void;
  onZakoncz: (m: TurniejMecz) => void;
}

const karta = 'rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm';
const naglowek = 'mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

const godzina = (m: Pick<TurniejMecz, 'zaplanowanyAt'>) =>
  m.zaplanowanyAt ? chwilaWPolsce(m.zaplanowanyAt).godzina.slice(0, 5) : '--:--';

export default function CentrumTurnieju({
  turniej, mecze, przerwy, druzynyPoId, meczePoId, arenyPoId, grupyPoId, tabele,
  liczbaZgloszen, teraz, onRozpocznij, onGol, onZakoncz,
}: CentrumTurniejuProps) {
  const c = centrumTurnieju(mecze, teraz, { najblizsze: 4, ostatnie: 6 });
  const nazwa = (m: TurniejMecz, s: 'a' | 'b') => nazwaSlotu(m, s, druzynyPoId, meczePoId, grupyPoId);
  const para = (m: TurniejMecz) => `${nazwa(m, 'a')} – ${nazwa(m, 'b')}`;
  const adresMeczu = (m: TurniejMecz) => `/turnieje/${turniej.id}/mecz/${m.id}`;
  // Gole jednym kliknięciem tylko tam, gdzie wynik to gole. Sety i punkty
  // koszykówki (1/2/3) prowadzi się na stronie meczu.
  const szybkieGole = !jestSportemSetowym(turniej.sport) && !jestKoszykowka(turniej.sport);
  const nastepny = c.najblizsze.find((m) => m.druzynaAId && m.druzynaBId);

  const finalowa = Array.from(grupyPoId.values()).find((g) => g.finalowa);
  const meczeFazyKoncowej = mecze
    .filter((m) => (finalowa ? m.grupaId === finalowa.id : m.faza !== 'grupa' && m.faza !== 'liga'))
    .filter((m) => m.status === 'zaplanowany' || m.status === 'trwa')
    .sort((a, b) => (a.zaplanowanyAt ?? '').localeCompare(b.zaplanowanyAt ?? '') || a.numer - b.numer)
    .slice(0, 4);
  const startFazyKoncowej = meczeFazyKoncowej[0];
  const tabeleGrup = tabele.filter((t) => !t.grupa?.finalowa);

  // ── Teraz ────────────────────────────────────────────────────────────────
  const kartaTeraz = (
    <section className={`${karta} border-2 border-primary-600 dark:border-primary-500`} aria-label="Teraz">
      {c.naZywo.length > 0 ? c.naZywo.map((m, i) => {
        const arena = m.arenaId ? arenyPoId.get(m.arenaId) : undefined;
        const zegar = czasGry(m.rozpoczetyAt, teraz, turniej.czasMeczuMin);
        const karne = wymaganeKarne(m.faza, m.wynikA, m.wynikB);
        return (
          <div key={m.id} className={i > 0 ? 'mt-4 border-t border-slate-100 pt-4 dark:border-slate-700' : ''}>
            <p className={naglowek}>
              Teraz{arena ? ` · ${arena}` : ''}{zegar ? ` · ${zegar} gry` : ''}
            </p>
            <Link href={adresMeczu(m)} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2">
              <span className="min-w-0 break-words font-semibold text-ink">{nazwa(m, 'a')}</span>
              <span className="font-display text-4xl font-bold tabular-nums text-ink">
                {m.wynikA} : {m.wynikB}
              </span>
              <span className="min-w-0 break-words text-right font-semibold text-ink">{nazwa(m, 'b')}</span>
            </Link>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {szybkieGole && m.druzynaAId && m.druzynaBId ? (
                <>
                  <Button variant="outline" className="min-h-[44px] min-w-0 px-2" title={`Gol: ${nazwa(m, 'a')}`} onClick={() => onGol(m, m.druzynaAId!)}>
                    <span className="min-w-0 truncate">+ Gol {nazwa(m, 'a')}</span>
                  </Button>
                  <Button variant="outline" className="min-h-[44px] min-w-0 px-2" title={`Gol: ${nazwa(m, 'b')}`} onClick={() => onGol(m, m.druzynaBId!)}>
                    <span className="min-w-0 truncate">+ Gol {nazwa(m, 'b')}</span>
                  </Button>
                </>
              ) : (
                <Link
                  href={adresMeczu(m)}
                  className="col-span-2 inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 px-3 text-sm font-medium text-ink hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
                >
                  Prowadź mecz
                </Link>
              )}
              {/* Remis w fazie pucharowej: karne wpisuje się na stronie meczu. */}
              {karne ? (
                <Link
                  href={adresMeczu(m)}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-primary-600 px-3 text-sm font-medium text-white hover:bg-primary-700"
                >
                  Karne
                </Link>
              ) : (
                <Button className="min-h-[44px]" onClick={() => onZakoncz(m)}>Zakończ mecz</Button>
              )}
            </div>
            {szybkieGole && (
              <Link href={adresMeczu(m)} className="mt-2 inline-block text-xs font-medium text-slate-500 hover:text-ink dark:text-slate-400">
                Strzelcy i kartki na stronie meczu
              </Link>
            )}
          </div>
        );
      }) : nastepny ? (
        <>
          <p className={naglowek}>Teraz nic nie trwa · następny o {godzina(nastepny)}</p>
          <div className="flex items-center gap-3 py-2">
            <span className="min-w-0 flex-1 break-words text-lg font-semibold text-ink">{para(nastepny)}</span>
            <Button onClick={() => onRozpocznij(nastepny)} className="shrink-0 min-h-[44px]">
              Rozpocznij M{nastepny.numer}
            </Button>
          </div>
          <Link href={adresMeczu(nastepny)} className="text-xs font-medium text-slate-500 hover:text-ink dark:text-slate-400">
            Albo wpisz od razu wynik końcowy
          </Link>
        </>
      ) : (
        <>
          <p className={naglowek}>Teraz</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {c.liczbaDoRozegrania > 0
              ? 'Kolejne mecze czekają na drużyny z poprzednich rund.'
              : 'Wszystkie mecze rozegrane.'}
          </p>
        </>
      )}
    </section>
  );

  // ── Najbliższe ───────────────────────────────────────────────────────────
  const kartaNajblizsze = (
    <section className={karta} aria-label="Najbliższe mecze">
      <p className={naglowek}>Najbliższe</p>
      {c.najblizsze.length === 0 ? (
        <p className="text-sm text-slate-500">Nic więcej w terminarzu.</p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {terminarzZPrzerwami(c.najblizsze, przerwy.filter((p) => new Date(p.doAt) > teraz), turniej).map((w) => (
            w.typ === 'przerwa' ? (
              <p key={w.przerwaId ?? `p-${w.od}`} className="my-1.5 flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-600 dark:bg-slate-700/60 dark:text-slate-300">
                <Coffee className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                <span className="min-w-0 truncate">{w.nazwa ?? 'Przerwa'} {w.od}–{w.do}</span>
              </p>
            ) : (
              <WierszMeczu
                key={w.mecz.id}
                godzina={godzina(w.mecz)}
                numer={w.mecz.numer}
                para={para(w.mecz)}
                href={adresMeczu(w.mecz)}
                // Bez meczu w toku „Rozpocznij” stoi w karcie Teraz; przy
                // meczu w toku (druga arena, następny gwizdek) tutaj.
                akcja={c.naZywo.length > 0 && w.mecz.id === nastepny?.id
                  ? { etykieta: 'Rozpocznij', onClick: () => onRozpocznij(w.mecz) }
                  : undefined}
              />
            )
          ))}
        </div>
      )}
      {c.liczbaDoRozegrania > c.najblizsze.length && (
        <a href="#terminarz" className="mt-2 inline-block text-sm font-medium text-primary-600">
          Cały terminarz ({c.liczbaDoRozegrania})
        </a>
      )}
    </section>
  );

  // ── Wymaga decyzji ───────────────────────────────────────────────────────
  const decyzje: { klucz: string; tresc: ReactNode }[] = [];
  if (c.zaleglyStart) {
    const m = c.zaleglyStart;
    decyzje.push({
      klucz: 'start',
      tresc: (
        <button type="button" onClick={() => onRozpocznij(m)} className="w-full text-left">
          M{m.numer} miał zacząć się o {godzina(m)} · rozpocznij
        </button>
      ),
    });
  }
  if (liczbaZgloszen > 0) {
    decyzje.push({
      klucz: 'zgloszenia',
      tresc: (
        <Link href={`/turnieje/${turniej.id}/panel?tab=druzyny`} className="block">
          {withCount(liczbaZgloszen, 'zgłoszenie', 'zgłoszenia', 'zgłoszeń')} {plural(liczbaZgloszen, 'czeka', 'czekają', 'czeka')} na decyzję
        </Link>
      ),
    });
  }
  const kartaDecyzje = (
    <section className={karta} aria-label="Wymaga decyzji">
      <p className={naglowek}>Wymaga decyzji</p>
      {decyzje.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Nic nie czeka.</p>
      ) : (
        <ul className="space-y-2">
          {decyzje.map((d) => (
            <li key={d.klucz} className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              {d.tresc}
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  // ── Ostatnie wyniki ──────────────────────────────────────────────────────
  const kartaWyniki = (
    <section className={karta} aria-label="Ostatnie wyniki">
      <p className={naglowek}>Ostatnie wyniki</p>
      {c.ostatnie.length === 0 ? (
        <p className="text-sm text-slate-500">Jeszcze żaden mecz się nie skończył.</p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {c.ostatnie.map((m) => (
            <WierszMeczu
              key={m.id}
              numer={m.numer}
              para={para(m)}
              wynik={m.status === 'walkower' ? 'wo.' : `${m.wynikA}:${m.wynikB}${m.karneA !== undefined && m.karneB !== undefined ? ` (k. ${m.karneA}:${m.karneB})` : ''}`}
              href={adresMeczu(m)}
              akcja={{ etykieta: 'Popraw', href: adresMeczu(m) }}
            />
          ))}
        </div>
      )}
      {c.liczbaRozegranych > c.ostatnie.length && (
        <Link href={`/turnieje/${turniej.id}?tab=wyniki`} className="mt-2 inline-block text-sm font-medium text-primary-600">
          Wszystkie rozegrane ({c.liczbaRozegranych})
        </Link>
      )}
    </section>
  );

  // ── Grupy ────────────────────────────────────────────────────────────────
  const kartaGrupy = tabeleGrup.length > 0 && (
    <section className={karta} aria-label="Tabele grup">
      <p className={naglowek}>
        {tabeleGrup.some((t) => t.grupa) ? 'Grupy' : 'Tabela'}
        {tabeleGrup.some((t) => t.grupa) && turniej.awansujeZGrupy > 0
          ? ` · ${turniej.awansujeZGrupy} ${plural(turniej.awansujeZGrupy, 'drużyna awansuje', 'drużyny awansują', 'drużyn awansuje')}`
          : ''}
      </p>
      <div className="space-y-3">
        {tabeleGrup.map(({ grupa, wiersze }) => (
          <div key={grupa?.id ?? 'liga'}>
            {grupa && <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Grupa {grupa.nazwa}</p>}
            <TabelaGrupy wiersze={wiersze} awansujeZGrupy={grupa ? turniej.awansujeZGrupy : undefined} kompakt />
          </div>
        ))}
      </div>
    </section>
  );

  // ── Faza końcowa ─────────────────────────────────────────────────────────
  const kartaFinal = startFazyKoncowej && (
    <section className={karta} aria-label={finalowa ? 'Grupa finałowa' : 'Faza pucharowa'}>
      <p className={naglowek}>
        {finalowa ? 'Grupa finałowa' : 'Faza pucharowa'}
        {startFazyKoncowej.zaplanowanyAt ? ` · od ${godzina(startFazyKoncowej)}` : ''}
      </p>
      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {meczeFazyKoncowej.map((m) => (
          <WierszMeczu key={m.id} godzina={godzina(m)} numer={m.numer} para={para(m)} href={adresMeczu(m)} />
        ))}
      </div>
    </section>
  );

  return (
    <div className="hidden gap-4 lg:mb-6 lg:grid lg:grid-cols-2 2xl:grid-cols-[1.15fr_1.9fr]">
      <div className="flex min-w-0 flex-col gap-4">
        {kartaTeraz}
        {kartaNajblizsze}
        {kartaDecyzje}
      </div>
      {/* Od 2xl prawa część dzieli się na dwie kolumny: wyniki | grupy i finał. */}
      <div className="flex min-w-0 flex-col gap-4 2xl:grid 2xl:grid-cols-[1fr_0.9fr] 2xl:items-start">
        {kartaWyniki}
        <div className="flex min-w-0 flex-col gap-4">
          {kartaGrupy}
          {kartaFinal}
        </div>
      </div>
    </div>
  );
}

/** Gęsty wiersz meczu: godzina | numer | para | wynik | akcja, w jednej linii. */
function WierszMeczu({ godzina, numer, para, wynik, href, akcja }: {
  godzina?: string;
  numer: number;
  para: string;
  wynik?: string;
  href: string;
  akcja?: { etykieta: string; onClick?: () => void; href?: string };
}) {
  const przycisk = 'inline-flex min-h-[40px] shrink-0 items-center rounded-xl border border-slate-300 px-3 text-sm font-medium text-ink hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700';
  return (
    <div className="flex min-h-[48px] items-center gap-3 py-1.5 text-sm">
      {godzina && <span className="w-11 shrink-0 font-bold tabular-nums text-ink">{godzina}</span>}
      <span className="w-9 shrink-0 text-xs text-slate-500 dark:text-slate-400">M{numer}</span>
      <Link href={href} title={para} className="min-w-0 flex-1 truncate text-ink hover:underline">{para}</Link>
      {wynik && <span className="shrink-0 font-semibold tabular-nums text-ink">{wynik}</span>}
      {akcja && (akcja.href
        ? <Link href={akcja.href} className={przycisk}>{akcja.etykieta}</Link>
        : <button type="button" onClick={akcja.onClick} className={przycisk}>{akcja.etykieta}</button>)}
    </div>
  );
}
