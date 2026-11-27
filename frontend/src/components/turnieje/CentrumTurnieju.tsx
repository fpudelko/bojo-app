'use client';

// „Centrum dowodzenia" w dniu turnieju: panel organizatora od `lg`
// (2026-11-21, ocena „Gramy dla Marysi!” na komputerze). Na laptopie przy
// stoliku organizator ma widzieć naraz: mecz w toku, kolejne mecze, ostatnie
// wyniki i tabele grup. Do tej pory to były trzy miejsca (terminarz w panelu,
// Mecze i Tabele na stronie turnieju), a przy meczu co 14 minut oznaczało to
// przełączanie zakładek przy każdym gwizdku.
//
// OD 2026-11-27 TAKŻE NA TELEFONIE i w kolejności prowadzenia (test przed
// turniejem 28.11): na górze mecz w trakcie, wyróżniony; pod nim następne do
// rozegrania, każdy z „Start”; rozegrane niżej, w dwóch liniach z podpisem „zakończony”.
// Tabele grup stąd wypadły: są w zakładce Tabela, a tu tylko zasłaniały to,
// co prowadzący ma kliknąć za chwilę.
//
// Kolory wg AGENTS.md: zielony to mecz w toku i awans, niebieski „wymaga
// decyzji”, szary przerwy. Bez „opóźnienia” (decyzja właściciela
// z 2026-11-08, `postepTurnieju()`).
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Coffee, Undo2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { nazwaSlotu } from '@/components/turnieje/KartaMeczu';
import { centrumTurnieju } from '@/lib/turniejPulpit';
import { terminarzZPrzerwami, meczPrzed, etykietaFazyMeczu } from '@/lib/turniejEtykiety';
import { jestKoszykowka, jestSportemSetowym, wymaganeKarne } from '@/lib/turniejWynik';
import {
  fazaZegara, opisZegara, poCzasiePolowy, startZegara, pauzaZegara, koniecPolowy, type ZmianaZegara,
} from '@/lib/zegarMeczu';
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
  liczbaAren: number;
  teraz: Date;
  /** Akcje: wywołujący zapisuje i odświeża dane panelu. */
  onRozpocznij: (m: TurniejMecz) => void;
  onGol: (m: TurniejMecz, druzynaId: string) => void;
  onZakoncz: (m: TurniejMecz) => void;
  /** Start, pauza, koniec połowy zegara meczu (182). */
  onZegar: (m: TurniejMecz, zmiana: ZmianaZegara) => void;
  /** Kasuje ostatnie zdarzenie meczu (pomyłka przy „+ Gol”). */
  onCofnij: (m: TurniejMecz) => void;
}

const karta = 'rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm';
const naglowek = 'mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

const godzina = (m: Pick<TurniejMecz, 'zaplanowanyAt'>) =>
  m.zaplanowanyAt ? chwilaWPolsce(m.zaplanowanyAt).godzina.slice(0, 5) : '--:--';

export default function CentrumTurnieju({
  turniej, mecze, przerwy, druzynyPoId, meczePoId, arenyPoId, grupyPoId,
  liczbaZgloszen, liczbaAren, teraz, onRozpocznij, onGol, onZakoncz, onCofnij, onZegar,
}: CentrumTurniejuProps) {
  const c = centrumTurnieju(mecze, teraz, {
    najblizsze: 4, ostatnie: 6, liczbaAren, czasMeczuMin: turniej.czasMeczuMin,
  });
  const nazwa = (m: TurniejMecz, s: 'a' | 'b') => nazwaSlotu(m, s, druzynyPoId, meczePoId, grupyPoId);
  // „Gr. A” nad godziną w wierszu meczu (2026-11-27).
  // Mecze końcowe po krótkiej nazwie: „Mecz o 3. miejsce” nie mieści się nad godziną.
  const fazaKrotko = (m: TurniejMecz) => m.faza === 'o_3_miejsce' ? 'o 3. m.'
    : m.faza === 'final' ? 'Finał'
    : etykietaFazyMeczu(m, grupyPoId).replace(/^Grupa finałowa /, 'Gr. ').replace(/^Grupa /, 'Gr. ');
  const para = (m: TurniejMecz) => `${nazwa(m, 'a')} – ${nazwa(m, 'b')}`;
  const adresMeczu = (m: TurniejMecz) => `/turnieje/${turniej.id}/mecz/${m.id}`;
  // Gole jednym kliknięciem tylko tam, gdzie wynik to gole. Sety i punkty
  // koszykówki (1/2/3) prowadzi się na stronie meczu.
  const szybkieGole = !jestSportemSetowym(turniej.sport) && !jestKoszykowka(turniej.sport);
  // Rozpocząć można tylko mecz na wolnej arenie (`doRozpoczecia`).
  const nastepny = c.doRozpoczecia;

  const finalowa = Array.from(grupyPoId.values()).find((g) => g.finalowa);
  const meczeFazyKoncowej = mecze
    .filter((m) => (finalowa ? m.grupaId === finalowa.id : m.faza !== 'grupa' && m.faza !== 'liga'))
    .filter((m) => m.status === 'zaplanowany' || m.status === 'trwa')
    .sort((a, b) => (a.zaplanowanyAt ?? '').localeCompare(b.zaplanowanyAt ?? '') || a.numer - b.numer)
    .slice(0, 4);
  const startFazyKoncowej = meczeFazyKoncowej[0];

  // ── Teraz ────────────────────────────────────────────────────────────────
  const kartaTeraz = (
    <section className={`${karta} border-2 border-primary-600 bg-primary-50/70 dark:border-primary-500 dark:bg-primary-950/30`} aria-label="Teraz">
      {c.naZywo.length > 0 ? c.naZywo.map((m, i) => {
        const arena = m.arenaId ? arenyPoId.get(m.arenaId) : undefined;
        // Zegar sterowany ręcznie (182). Po czasie połowy bursztynowy, nie
        // czerwony: to informacja dla prowadzącego, nie awaria.
        const faza = fazaZegara(m);
        const poCzasieGry = poCzasiePolowy(m, teraz, turniej.czasMeczuMin);
        const karne = wymaganeKarne(m.faza, m.wynikA, m.wynikB);
        return (
          <div key={m.id} className={i > 0 ? 'mt-4 border-t border-slate-100 pt-4 dark:border-slate-700' : ''}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className={`${naglowek} mb-0 inline-flex items-center gap-1.5 text-primary-700 dark:text-primary-300`}>
                <span className="h-2 w-2 animate-pulse rounded-full bg-primary-600" aria-hidden />
                W trakcie · M{m.numer}{arena ? ` · ${arena}` : ''}
              </p>
              {!jestSportemSetowym(turniej.sport) && (
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-sm font-semibold tabular-nums ${
                      poCzasieGry
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                        : faza === 'gra'
                          ? 'bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {opisZegara(m, teraz)}
                  </span>
                  {/* Sterowanie zegarem także z laptopa: start i pauza. Koniec
                      połowy i meczu na stronie meczu i przyciskiem obok. */}
                  <button
                    type="button"
                    onClick={() => onZegar(m, faza === 'gra' ? pauzaZegara(m, teraz) : startZegara(m, teraz))}
                    className="rounded-full border border-slate-300 px-2.5 py-0.5 text-sm font-medium text-ink hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
                  >
                    {faza === 'gra' ? 'Pauza' : faza === 'pauza' ? 'Wznów' : faza === 'przerwa' ? 'Start 2. poł.' : 'Start'}
                  </button>
                  {faza !== 'przerwa' && faza !== 'czeka' && (m.polowa ?? 1) === 1 && (
                    <button
                      type="button"
                      onClick={() => onZegar(m, koniecPolowy())}
                      className="rounded-full border border-slate-300 px-2.5 py-0.5 text-sm font-medium text-ink hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
                    >
                      Koniec połowy
                    </button>
                  )}
                </span>
              )}
            </div>
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
                    <span className="flex min-w-0 flex-col leading-tight">
                      <span className="font-bold">+ GOL</span>
                      <span className="truncate text-xs font-normal text-slate-500 dark:text-slate-400">{nazwa(m, 'a')}</span>
                    </span>
                  </Button>
                  <Button variant="outline" className="min-h-[44px] min-w-0 px-2" title={`Gol: ${nazwa(m, 'b')}`} onClick={() => onGol(m, m.druzynaBId!)}>
                    <span className="flex min-w-0 flex-col leading-tight">
                      <span className="font-bold">+ GOL</span>
                      <span className="truncate text-xs font-normal text-slate-500 dark:text-slate-400">{nazwa(m, 'b')}</span>
                    </span>
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
              <div className="mt-2 flex items-center justify-between gap-3">
                <Link href={adresMeczu(m)} className="text-xs font-medium text-slate-500 hover:text-ink dark:text-slate-400">
                  Strzelcy i kartki na stronie meczu
                </Link>
                {m.wynikA + m.wynikB > 0 && (
                  <button
                    type="button"
                    onClick={() => onCofnij(m)}
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <Undo2 className="h-4 w-4" aria-hidden /> Cofnij ostatnie
                  </button>
                )}
              </div>
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
          <p className={naglowek}>Teraz nic nie trwa</p>
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
      <p className={naglowek}>Następne do rozegrania</p>
      {c.najblizsze.length === 0 ? (
        <p className="text-sm text-slate-500">Nic więcej w terminarzu.</p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {terminarzZPrzerwami(c.najblizsze, przerwy.filter((p) => new Date(p.doAt) > teraz), { ...turniej, poprzedni: meczPrzed(mecze, c.najblizsze[0]) }).map((w) => (
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
                faza={fazaKrotko(w.mecz)}
                druzyny={[nazwa(w.mecz, 'a'), nazwa(w.mecz, 'b')]}
                href={adresMeczu(w.mecz)}
                // „Start” na każdym meczu, który ma obie drużyny (2026-11-27):
                // prowadzący klika mecz, który faktycznie wychodzi na boisko.
                akcja={w.mecz.druzynaAId && w.mecz.druzynaBId && w.mecz.id !== (c.naZywo.length === 0 ? nastepny?.id : undefined)
                  ? { etykieta: 'Start', onClick: () => onRozpocznij(w.mecz) }
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
  for (const m of c.przeciagniete) {
    const minut = m.rozpoczetyAt ? Math.floor((teraz.getTime() - new Date(m.rozpoczetyAt).getTime()) / 60_000) : 0;
    decyzje.push({
      klucz: `dlugo-${m.id}`,
      tresc: (
        <button type="button" onClick={() => onZakoncz(m)} className="w-full text-left">
          M{m.numer} trwa już {minut} min (czas gry {turniej.czasMeczuMin} min) · zakończ mecz
        </button>
      ),
    });
  }
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
  // ALERTY NA GÓRZE, nie karta na dole (2026-11-21): to, co wymaga decyzji,
  // ma być pierwszą rzeczą na ekranie, a gdy nic nie czeka, nie zajmuje
  // miejsca. Niebieski: „wymaga decyzji” (AGENTS.md, kolorystyka).
  const pasekAlertow = decyzje.length > 0 && (
    <section aria-label="Wymaga decyzji" className="lg:col-span-2">
      <ul className="flex flex-wrap gap-2">
        {decyzje.map((d) => (
          <li key={d.klucz} className="min-w-0 flex-1 basis-80 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
            {d.tresc}
          </li>
        ))}
      </ul>
    </section>
  );

  // ── Ostatnie wyniki ──────────────────────────────────────────────────────
  const kartaWyniki = (
    <section className={karta} aria-label="Ostatnie wyniki">
      <p className={naglowek}>Rozegrane</p>
      {c.ostatnie.length === 0 ? (
        <p className="text-sm text-slate-500">Jeszcze żaden mecz się nie skończył.</p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {c.ostatnie.map((m) => (
            <WierszRozegranego
              key={m.id}
              numer={m.numer}
              walkower={m.status === 'walkower'}
              druzyny={[
                { nazwa: nazwa(m, 'a'), wynik: m.wynikA, karne: m.karneA },
                { nazwa: nazwa(m, 'b'), wynik: m.wynikB, karne: m.karneB },
              ]}
              href={adresMeczu(m)}
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

  // ── Faza końcowa ─────────────────────────────────────────────────────────
  const kartaFinal = startFazyKoncowej && (
    <section className={karta} aria-label={finalowa ? 'Grupa finałowa' : 'Faza pucharowa'}>
      <p className={naglowek}>
        {finalowa ? 'Grupa finałowa' : 'Faza pucharowa'}
        {startFazyKoncowej.zaplanowanyAt ? ` · od ${godzina(startFazyKoncowej)}` : ''}
      </p>
      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {meczeFazyKoncowej.map((m) => (
          <WierszMeczu key={m.id} godzina={godzina(m)} numer={m.numer} faza={fazaKrotko(m)} druzyny={[nazwa(m, 'a'), nazwa(m, 'b')]} href={adresMeczu(m)} />
        ))}
      </div>
    </section>
  );

  // Kolejność to kolejność pytań prowadzącego: co wymaga decyzji, co gra
  // teraz, co wychodzi następne, a na końcu co już było.
  return (
    <div className="mb-6 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
      {pasekAlertow}
      <div className="lg:col-span-2">{kartaTeraz}</div>
      {kartaNajblizsze}
      <div className="flex min-w-0 flex-col gap-4">
        {kartaFinal}
        {kartaWyniki}
      </div>
    </div>
  );
}

/**
 * Rozegrany mecz w DWÓCH liniach (2026-11-27, uwaga właściciela: „przez
 * badge Zakończony nie widać nazwy drugiej drużyny”). Plakietka, numer,
 * wynik i „Popraw” w jednej linii zostawiały na 360 px kilka liter na obie
 * nazwy. Teraz drużyny stoją jedna pod drugą, każda z własnym wynikiem
 * (zwycięzca pogrubiony), a „Zakończony” to podpis przy numerze.
 */
function WierszRozegranego({ numer, walkower, druzyny, href }: {
  numer: number;
  walkower: boolean;
  druzyny: [{ nazwa: string; wynik: number; karne?: number }, { nazwa: string; wynik: number; karne?: number }];
  href: string;
}) {
  const [a, b] = druzyny;
  const karne = a.karne !== undefined && b.karne !== undefined;
  const wygrywa = (x: typeof a, y: typeof a) => x.wynik > y.wynik || (karne && x.wynik === y.wynik && (x.karne ?? 0) > (y.karne ?? 0));
  return (
    <div className="flex items-center gap-3 py-2 text-sm">
      <Link href={href} className="min-w-0 flex-1">
        <span className="block text-xs text-slate-500 dark:text-slate-400">M{numer} · {walkower ? 'walkower' : 'zakończony'}</span>
        {[[a, b], [b, a]].map(([x, y], i) => (
          <span key={i} className={`flex items-baseline gap-2 ${wygrywa(x, y) ? 'font-semibold text-ink' : 'text-slate-600 dark:text-slate-300'}`}>
            <span className="min-w-0 flex-1 truncate">{x.nazwa}</span>
            {!walkower && (
              <span className="shrink-0 tabular-nums">
                {x.wynik}{karne && <span className="text-xs font-normal text-slate-400"> ({x.karne})</span>}
              </span>
            )}
          </span>
        ))}
      </Link>
      <Link href={href} className="inline-flex min-h-[40px] shrink-0 items-center rounded-xl border border-slate-300 px-3 text-sm font-medium text-ink hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700">
        Popraw
      </Link>
    </div>
  );
}

/**
 * Wiersz meczu do rozegrania (2026-11-27, uwaga z testu: „nie widać drugiej
 * drużyny M15”). Numer i grupa małym drukiem NAD godziną, a nazwy drużyn
 * mniejszą czcionką w dwóch równych połówkach: każda ucina się sama, więc
 * zawsze widać początek obu, zamiast pierwszej w całości i „Mł…”.
 */
function WierszMeczu({ godzina, numer, faza, druzyny, href, akcja }: {
  godzina?: string;
  numer: number;
  faza?: string;
  druzyny: [string, string];
  href: string;
  akcja?: { etykieta: string; onClick?: () => void; href?: string };
}) {
  const przycisk = 'inline-flex min-h-[36px] shrink-0 items-center rounded-xl border border-slate-300 px-2.5 text-sm font-medium text-ink hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700';
  const [a, b] = druzyny;
  return (
    <div className="flex min-h-[48px] items-center gap-3 py-1.5">
      <span className="w-[4.5rem] shrink-0 leading-tight">
        <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">M{numer}{faza ? ` · ${faza}` : ''}</span>
        {godzina && <span className="block text-sm font-bold tabular-nums text-ink">{godzina}</span>}
      </span>
      <Link href={href} title={`${a} – ${b}`} className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 text-[13px] text-ink hover:underline">
        <span className="truncate">{a}</span>
        <span className="text-slate-400" aria-hidden>–</span>
        <span className="truncate">{b}</span>
      </Link>
      {akcja && (akcja.href
        ? <Link href={akcja.href} className={przycisk}>{akcja.etykieta}</Link>
        : <button type="button" onClick={akcja.onClick} className={przycisk}>{akcja.etykieta}</button>)}
    </div>
  );
}
