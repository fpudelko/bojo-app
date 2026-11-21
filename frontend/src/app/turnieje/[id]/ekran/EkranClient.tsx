'use client';

// EKRAN NA HALĘ (2026-11-21): wynik na żywo, kolejne mecze, tabele i ostatnie
// wyniki na pełny ekran, do puszczenia z laptopa na rzutnik albo telewizor.
// Organizator otwiera go z panelu („Ekran na halę”, nowa karta), a sam zostaje
// w panelu. Na turnieju charytatywnym to jedyny „spiker”: kibic przy ścianie
// widzi, kto gra, kto następny i jak stoją grupy, bez telefonu w ręku.
//
// Zasady ekranu:
// - CZYTELNY Z DALEKA. Rozmiary w `em` od jednego `font-size` liczonego
//   z szerokości okna, więc ten sam układ działa na 1366 px i na 4K.
// - CIEMNY ZAWSZE, niezależnie od motywu urządzenia: jasne tło na rzutniku
//   w hali świeci i zjada kontrast.
// - SAM SIĘ ODŚWIEŻA co 15 s; nic tu się nie klika. Bez ramki aplikacji
//   (`jestSciezkaWidgetu()` w lib/widget.ts: bez banera cookies i paska).
// - Kolory jak w całym Bojo: zielony mecz w toku i awans, bursztynowy zegar
//   po czasie gry, szary przerwy.
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Coffee } from 'lucide-react';
import { getTurniej } from '@/lib/turnieje';
import { getDruzyny } from '@/lib/turniejDruzyny';
import { getMecze, getAreny, getGrupy, getPrzerwy } from '@/lib/turniejMecze';
import { centrumTurnieju, postepTurnieju } from '@/lib/turniejPulpit';
import { tabeleTurnieju } from '@/lib/turniejTabela';
import { terminarzZPrzerwami, stanTurnieju, etykietaTerminu } from '@/lib/turniejEtykiety';
import { podiumTurnieju, medal } from '@/lib/turniejPodium';
import { czasGry, poCzasie } from '@/lib/turniejWynik';
import { chwilaWPolsce, terazWPolsce } from '@/lib/czasPolski';
import { useAdres } from '@/lib/useAdres';
import { withCount } from '@/lib/plural';
import { nazwaSlotu } from '@/components/turnieje/KartaMeczu';
import type { Turniej, TurniejArena, TurniejDruzyna, TurniejGrupa, TurniejMecz, TurniejPrzerwa } from '@/types';

const godzina = (m: Pick<TurniejMecz, 'zaplanowanyAt'>) =>
  m.zaplanowanyAt ? chwilaWPolsce(m.zaplanowanyAt).godzina.slice(0, 5) : '';

export default function EkranClient() {
  const { id } = useParams<{ id: string }>();
  const adres = useAdres('turniej', id) ?? id;
  const [turniej, setTurniej] = useState<Turniej | null | undefined>(undefined);
  const [druzyny, setDruzyny] = useState<TurniejDruzyna[]>([]);
  const [mecze, setMecze] = useState<TurniejMecz[]>([]);
  const [areny, setAreny] = useState<TurniejArena[]>([]);
  const [grupy, setGrupy] = useState<TurniejGrupa[]>([]);
  const [przerwy, setPrzerwy] = useState<TurniejPrzerwa[]>([]);
  const [teraz, setTeraz] = useState<Date | null>(null);

  useEffect(() => {
    let aktualne = true;
    const wczytaj = async () => {
      const t = await getTurniej(id).catch(() => null);
      if (!aktualne) return;
      setTurniej(t);
      if (!t) return;
      // Każda sekcja osobno: brak jednej (np. przerw bez migracji 176) nie
      // może zgasić całego ekranu na ścianie.
      const [d, m, a, g, p] = await Promise.allSettled([
        getDruzyny(id), getMecze(id), getAreny(id), getGrupy(id), getPrzerwy(id),
      ]);
      if (!aktualne) return;
      if (d.status === 'fulfilled') setDruzyny(d.value);
      if (m.status === 'fulfilled') setMecze(m.value);
      if (a.status === 'fulfilled') setAreny(a.value);
      if (g.status === 'fulfilled') setGrupy(g.value);
      if (p.status === 'fulfilled') setPrzerwy(p.value);
    };
    void wczytaj();
    const odswiez = window.setInterval(() => { void wczytaj(); }, 15_000);
    return () => { aktualne = false; window.clearInterval(odswiez); };
  }, [id]);

  // Zegar po montażu (AGENTS.md: „teraz” nie w renderze serwera).
  useEffect(() => {
    setTeraz(new Date());
    const t = window.setInterval(() => setTeraz(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const druzynyPoId = useMemo(() => new Map(druzyny.map((d) => [d.id, d.nazwa])), [druzyny]);
  const meczePoId = useMemo(() => new Map(mecze.map((m) => [m.id, m])), [mecze]);
  const arenyPoId = useMemo(() => new Map(areny.map((a) => [a.id, a.nazwa])), [areny]);
  const grupyPoId = useMemo(() => new Map(grupy.map((g) => [g.id, g])), [grupy]);

  if (turniej === undefined || !teraz) {
    return <Tlo><p className="m-auto text-[2em] text-slate-400">Ładuję…</p></Tlo>;
  }
  if (turniej === null) {
    return <Tlo><p className="m-auto text-[2em] text-slate-400">Nie znaleziono turnieju.</p></Tlo>;
  }

  const nazwa = (m: TurniejMecz, s: 'a' | 'b') => nazwaSlotu(m, s, druzynyPoId, meczePoId, grupyPoId);
  const c = centrumTurnieju(mecze, teraz, { najblizsze: 6, ostatnie: 4, liczbaAren: areny.length });
  const postep = postepTurnieju(mecze);
  const tabele = tabeleTurnieju(turniej, grupy, mecze, druzyny);
  const tabeleGrup = tabele.filter((t) => !t.grupa?.finalowa || t.wiersze.length > 0);
  const kilkaAren = areny.length > 1;
  const stan = stanTurnieju(turniej, mecze);
  const tabelaLigi = turniej.format === 'liga' && tabele.length === 1
    ? tabele[0].wiersze
    : turniej.format === 'grupy_finalowa' ? tabele.find((t) => t.grupa?.finalowa)?.wiersze : undefined;
  const podium = stan.label === 'Zakończony' ? podiumTurnieju(mecze, druzynyPoId, tabelaLigi) : [];
  const zegarSciany = terazWPolsce(teraz).godzina.slice(0, 5);
  const linkDoStrony = `bojo.pl/turnieje/${adres}`;

  const naglowek = (
    <header className="flex items-center gap-[1.2em] border-b border-white/10 px-[1.6em] py-[0.8em]">
      <span className="rounded-[0.35em] bg-primary-700 px-[0.45em] py-[0.1em] font-display text-[1.4em] font-bold">bojo</span>
      <h1 className="min-w-0 flex-1 truncate font-display text-[2em] font-bold">{turniej.nazwa}</h1>
      {postep.wszystkie > 0 && podium.length === 0 && (
        <p className="shrink-0 text-[1.3em] text-slate-300">
          <span className="font-display text-[1.4em] font-bold tabular-nums text-white">{postep.rozegrane}</span>
          {' '}z {withCount(postep.wszystkie, 'meczu', 'meczów', 'meczów')}
        </p>
      )}
      <p className="shrink-0 font-display text-[2em] font-bold tabular-nums">{zegarSciany}</p>
    </header>
  );
  const stopka = (
    <footer className="flex items-center justify-between border-t border-white/10 px-[1.6em] py-[0.6em] text-[1.1em] text-slate-400">
      <span>Wyniki na żywo w telefonie: <span className="font-semibold text-white">{linkDoStrony}</span></span>
      <span>Bojo · turnieje amatorskie</span>
    </footer>
  );

  // ── Po turnieju: podium na cały ekran ────────────────────────────────────
  if (podium.length > 0) {
    return (
      <Tlo>
        {naglowek}
        <main className="flex flex-1 flex-col items-center justify-center gap-[1.2em] text-center">
          <p className="text-[1.6em] font-semibold uppercase tracking-[0.2em] text-primary-300">Turniej zakończony</p>
          {podium.map((p) => (
            <p
              key={p.druzynaId}
              className={p.miejsce === 1 ? 'font-display text-[5em] font-bold leading-tight' : 'text-[2.6em] font-semibold text-slate-200'}
            >
              {medal(p.miejsce)} {p.nazwa}
            </p>
          ))}
          <p className="mt-[1em] text-[1.6em] text-slate-300">Dziękujemy za wspólną grę!</p>
        </main>
        {stopka}
      </Tlo>
    );
  }

  const nastepny = c.najblizsze.find((m) => m.druzynaAId && m.druzynaBId) ?? c.najblizsze[0];
  const kolejne = c.najblizsze.filter((m) => c.naZywo.length > 0 || m.id !== nastepny?.id).slice(0, 5);

  return (
    <Tlo>
      {naglowek}
      <main className="grid min-h-0 flex-1 grid-cols-[1.35fr_1fr] gap-[1.6em] px-[1.6em] py-[1.2em]">
        <div className="flex min-h-0 min-w-0 flex-col gap-[1.2em]">
          {/* NA ŻYWO albo NASTĘPNY: największa rzecz na ekranie. */}
          {c.naZywo.length > 0 ? (
            <section className={`grid gap-[1em] ${c.naZywo.length > 1 ? 'grid-cols-2' : ''}`}>
              {c.naZywo.map((m) => {
                const zegar = czasGry(m.rozpoczetyAt, teraz, turniej.czasMeczuMin);
                const poCzasieGry = poCzasie(m.rozpoczetyAt, turniej.czasMeczuMin, teraz);
                const arena = m.arenaId ? arenyPoId.get(m.arenaId) : undefined;
                const duzy = c.naZywo.length === 1;
                return (
                  <div key={m.id} className="rounded-[1em] border-2 border-primary-500 bg-primary-950/40 px-[1.4em] py-[1em]">
                    <div className="flex items-center justify-between text-[1.2em]">
                      <span className="inline-flex items-center gap-[0.4em] font-semibold uppercase tracking-wide text-primary-300">
                        <span className="h-[0.6em] w-[0.6em] animate-pulse rounded-full bg-primary-400" aria-hidden />
                        Na żywo{kilkaAren && arena ? ` · ${arena}` : ''} · M{m.numer}
                      </span>
                      {zegar && (
                        <span className={`font-display font-bold tabular-nums ${poCzasieGry ? 'text-amber-300' : 'text-white'}`}>{zegar}</span>
                      )}
                    </div>
                    <div className="mt-[0.4em] grid grid-cols-[1fr_auto_1fr] items-center gap-[0.8em]">
                      <span className={`min-w-0 break-words font-display font-bold leading-tight ${duzy ? 'text-[2.6em]' : 'text-[1.7em]'}`}>{nazwa(m, 'a')}</span>
                      <span className={`font-display font-bold tabular-nums ${duzy ? 'text-[6em]' : 'text-[3.6em]'}`}>{m.wynikA}:{m.wynikB}</span>
                      <span className={`min-w-0 break-words text-right font-display font-bold leading-tight ${duzy ? 'text-[2.6em]' : 'text-[1.7em]'}`}>{nazwa(m, 'b')}</span>
                    </div>
                  </div>
                );
              })}
            </section>
          ) : nastepny ? (
            <section className="rounded-[1em] border border-white/15 bg-white/5 px-[1.4em] py-[1em]">
              <p className="text-[1.2em] font-semibold uppercase tracking-wide text-slate-300">
                Następny mecz{nastepny.zaplanowanyAt ? ` · ${godzina(nastepny)}` : ''}{kilkaAren && nastepny.arenaId ? ` · ${arenyPoId.get(nastepny.arenaId)}` : ''}
              </p>
              <p className="mt-[0.4em] font-display text-[2.8em] font-bold leading-tight">
                {nazwa(nastepny, 'a')} <span className="text-slate-400">–</span> {nazwa(nastepny, 'b')}
              </p>
            </section>
          ) : (
            <section className="rounded-[1em] border border-white/15 bg-white/5 px-[1.4em] py-[1em]">
              <p className="font-display text-[2.4em] font-bold">
                {turniej.status === 'trwa' ? 'Za chwilę kolejne mecze' : `Start: ${etykietaTerminu(turniej.dataStartu, turniej.godzinaStartu)}`}
              </p>
            </section>
          )}

          {kolejne.length > 0 && (
            <section className="min-h-0">
              <h2 className="mb-[0.4em] text-[1.2em] font-semibold uppercase tracking-wide text-slate-400">Kolejne mecze</h2>
              <div className="divide-y divide-white/10">
                {terminarzZPrzerwami(kolejne, przerwy.filter((p) => new Date(p.doAt) > teraz), turniej).map((w) => (
                  w.typ === 'przerwa' ? (
                    <p key={w.przerwaId ?? `p-${w.od}`} className="flex items-center gap-[0.6em] py-[0.45em] text-[1.4em] text-slate-300">
                      <Coffee className="h-[1em] w-[1em] shrink-0 text-slate-500" aria-hidden />
                      <span className="tabular-nums">{w.od}–{w.do}</span>
                      <span className="truncate">{w.nazwa ?? 'Przerwa'}</span>
                    </p>
                  ) : (
                    <div key={w.mecz.id} className="flex items-center gap-[0.8em] py-[0.45em] text-[1.6em]">
                      <span className="w-[3.2em] shrink-0 font-bold tabular-nums">{godzina(w.mecz)}</span>
                      <span className="min-w-0 flex-1 truncate">{nazwa(w.mecz, 'a')} <span className="text-slate-500">–</span> {nazwa(w.mecz, 'b')}</span>
                      {kilkaAren && w.mecz.arenaId && (
                        <span className="shrink-0 text-[0.75em] text-slate-400">{arenyPoId.get(w.mecz.arenaId)}</span>
                      )}
                    </div>
                  )
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="flex min-h-0 min-w-0 flex-col gap-[1.2em] overflow-hidden">
          {tabeleGrup.length > 0 && (
            <section>
              <h2 className="mb-[0.4em] text-[1.2em] font-semibold uppercase tracking-wide text-slate-400">
                {tabeleGrup.some((t) => t.grupa) ? 'Grupy' : 'Tabela'}
              </h2>
              <div className={`grid gap-[0.8em] ${tabeleGrup.length > 2 ? 'grid-cols-2' : ''}`}>
                {tabeleGrup.map(({ grupa, wiersze }) => {
                  const awans = grupa && !grupa.finalowa && turniej.awansujeZGrupy < wiersze.length ? turniej.awansujeZGrupy : 0;
                  return (
                    <div key={grupa?.id ?? 'liga'} className="rounded-[0.6em] bg-white/5 px-[0.8em] py-[0.5em]">
                      {grupa && (
                        <p className="mb-[0.2em] text-[1em] font-semibold text-slate-300">
                          Grupa {grupa.nazwa}{grupa.finalowa ? ' (finałowa)' : ''}
                        </p>
                      )}
                      <table className="w-full text-[1.25em]">
                        <tbody>
                          {wiersze.map((w, i) => (
                            <tr key={w.druzynaId} className={i < awans ? 'text-white' : 'text-slate-300'}>
                              <td className={`w-[1.6em] py-[0.15em] pl-[0.3em] tabular-nums ${i < awans ? 'border-l-[0.2em] border-primary-400 font-bold text-primary-300' : 'text-slate-500'}`}>{i + 1}</td>
                              <td className="max-w-0 truncate py-[0.15em] font-medium">{w.nazwa}</td>
                              <td className="w-[2.6em] py-[0.15em] text-right tabular-nums text-slate-400">{w.bramkiZdobyte}:{w.bramkiStracone}</td>
                              <td className="w-[2em] py-[0.15em] text-right font-bold tabular-nums">{w.punkty}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {c.ostatnie.length > 0 && (
            <section className="min-h-0">
              <h2 className="mb-[0.4em] text-[1.2em] font-semibold uppercase tracking-wide text-slate-400">Ostatnie wyniki</h2>
              <div className="divide-y divide-white/10">
                {/* Przy trzech i więcej grupach tabele zajmują więcej wysokości:
                    mniej wierszy, zamiast uciętego ostatniego. */}
                {c.ostatnie.slice(0, tabeleGrup.length > 2 ? 2 : 4).map((m) => (
                  <div key={m.id} className="flex items-center gap-[0.6em] py-[0.35em] text-[1.35em]">
                    <span className="min-w-0 flex-1 truncate">{nazwa(m, 'a')} <span className="text-slate-500">–</span> {nazwa(m, 'b')}</span>
                    <span className="shrink-0 font-bold tabular-nums">
                      {m.status === 'walkower' ? 'wo.' : `${m.wynikA}:${m.wynikB}`}
                      {m.karneA !== undefined && m.karneB !== undefined && (
                        <span className="ml-[0.3em] text-[0.7em] font-normal text-slate-400">k. {m.karneA}:{m.karneB}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
      {stopka}
    </Tlo>
  );
}

/** Ciemne tło na cały ekran; rozmiar pisma liczony z szerokości okna. */
function Tlo({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex h-[100dvh] flex-col overflow-hidden bg-slate-950 text-white"
      style={{ fontSize: 'clamp(12px, 1.05vw, 40px)' }}
    >
      {children}
    </div>
  );
}
