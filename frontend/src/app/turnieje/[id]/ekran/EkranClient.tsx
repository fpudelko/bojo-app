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
import { getDruzyny, getDruzynyZeSkladem } from '@/lib/turniejDruzyny';
import { getMecze, getAreny, getGrupy, getPrzerwy, getZdarzeniaTurnieju } from '@/lib/turniejMecze';
import { obliczKlasyfikacje, posortujKlasyfikacje } from '@/lib/turniejStatystyki';
import { linkDoTurnieju } from '@/lib/turniejShare';
import { useAuth } from '@/lib/auth';
import KodQr from '@/components/ui/KodQr';
import { centrumTurnieju, postepTurnieju } from '@/lib/turniejPulpit';
import { tabeleTurnieju } from '@/lib/turniejTabela';
import { terminarzZPrzerwami, stanTurnieju, etykietaTerminu, etykietaZdobyczy, etykietaFazyMeczu } from '@/lib/turniejEtykiety';
import { podiumTurnieju, medal } from '@/lib/turniejPodium';
import { czasGry, poCzasie } from '@/lib/turniejWynik';
import { chwilaWPolsce, terazWPolsce } from '@/lib/czasPolski';
import { useAdres } from '@/lib/useAdres';
import { withCount } from '@/lib/plural';
import { nazwaSlotu } from '@/components/turnieje/KartaMeczu';
import type { Turniej, TurniejArena, TurniejDruzyna, TurniejGrupa, TurniejMecz, TurniejPrzerwa, TurniejZdarzenie } from '@/types';

// WIDOKI PRAWEJ KOLUMNY (2026-11-21): na hali ekran wisi kilka godzin, więc
// prawa strona zmienia się co kilkanaście sekund: tabele, wszystkie wyniki,
// strzelcy, faza końcowa. Lewa (na żywo, kolejne mecze) stoi w miejscu, bo
// to na nią patrzy się „w biegu”. `?widok=tabele` (albo wyniki, strzelcy,
// final) zatrzymuje rotację na jednym widoku, np. na drugi telewizor.
type Widok = 'tabele' | 'wyniki' | 'strzelcy' | 'final';
const WIDOKI: readonly Widok[] = ['tabele', 'wyniki', 'strzelcy', 'final'];
const CZAS_WIDOKU_MS = 12_000;

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
  const [zdarzenia, setZdarzenia] = useState<TurniejZdarzenie[]>([]);
  const [przypietyWidok, setPrzypietyWidok] = useState<Widok | null>(null);
  const [krok, setKrok] = useState(0);
  const { user } = useAuth();

  useEffect(() => {
    let aktualne = true;
    const wczytaj = async () => {
      const t = await getTurniej(id).catch(() => null);
      if (!aktualne) return;
      setTurniej(t);
      if (!t) return;
      // Każda sekcja osobno: brak jednej (np. przerw bez migracji 176) nie
      // może zgasić całego ekranu na ścianie.
      // Składy (do klasyfikacji strzelców) tylko dla zalogowanego, tak jak
      // na stronie turnieju: ekran zwykle otwiera organizator z panelu.
      // Bez konta ekran pokazuje wszystko poza strzelcami.
      const [d, m, a, g, p, z] = await Promise.allSettled([
        user ? getDruzynyZeSkladem(id).catch(() => getDruzyny(id)) : getDruzyny(id),
        getMecze(id), getAreny(id), getGrupy(id), getPrzerwy(id), getZdarzeniaTurnieju(id),
      ]);
      if (!aktualne) return;
      if (d.status === 'fulfilled') setDruzyny(d.value);
      if (z.status === 'fulfilled') setZdarzenia(z.value);
      if (m.status === 'fulfilled') setMecze(m.value);
      if (a.status === 'fulfilled') setAreny(a.value);
      if (g.status === 'fulfilled') setGrupy(g.value);
      if (p.status === 'fulfilled') setPrzerwy(p.value);
    };
    void wczytaj();
    const odswiez = window.setInterval(() => { void wczytaj(); }, 15_000);
    return () => { aktualne = false; window.clearInterval(odswiez); };
  }, [id, user]);

  // `?widok=` czytany po montażu, nie przez useSearchParams (AGENTS.md).
  useEffect(() => {
    const w = new URLSearchParams(window.location.search).get('widok');
    if (w && (WIDOKI as readonly string[]).includes(w)) setPrzypietyWidok(w as Widok);
    const t = window.setInterval(() => setKrok((k) => k + 1), CZAS_WIDOKU_MS);
    return () => window.clearInterval(t);
  }, []);

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

  const przypnijWidok = (w: Widok | null) => {
    setPrzypietyWidok(w);
    if (w === null) setKrok(0);
    const url = new URL(window.location.href);
    if (w) url.searchParams.set('widok', w); else url.searchParams.delete('widok');
    window.history.replaceState(null, '', url.pathname + url.search);
  };

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
  const link = linkDoTurnieju(adres);
  const linkBezProtokolu = link.replace(/^https?:\/\//, '');

  // ── Dane widoków ─────────────────────────────────────────────────────────
  const rozegrane = mecze
    .filter((m) => (m.status === 'zakonczony' || m.status === 'walkower') && m.druzynaAId && m.druzynaBId)
    .sort((a, b) => (b.zakonczonyAt ?? b.zaplanowanyAt ?? '').localeCompare(a.zakonczonyAt ?? a.zaplanowanyAt ?? '') || b.numer - a.numer);
  const zawodnicy = druzyny.flatMap((d) => d.zawodnicy ?? []);
  const strzelcy = zawodnicy.length > 0
    ? posortujKlasyfikacje(obliczKlasyfikacje(zdarzenia, [], zawodnicy, druzynyPoId), 'gole').filter((w) => w.gole > 0)
    : [];
  const zdobycz = etykietaZdobyczy(turniej.sport);
  const finalowa = grupy.find((g) => g.finalowa);
  const meczeFinalu = mecze
    .filter((m) => (finalowa ? m.grupaId === finalowa.id : m.faza !== 'grupa' && m.faza !== 'liga') && !(m.status === 'walkower' && (!m.druzynaAId || !m.druzynaBId)))
    .sort((a, b) => (a.zaplanowanyAt ?? '').localeCompare(b.zaplanowanyAt ?? '') || a.numer - b.numer);
  const dostepne: Widok[] = [
    ...(tabeleGrup.length > 0 ? ['tabele' as const] : []),
    ...(rozegrane.length > 0 ? ['wyniki' as const] : []),
    ...(strzelcy.length > 0 ? ['strzelcy' as const] : []),
    ...(meczeFinalu.length > 0 ? ['final' as const] : []),
  ];
  const widok: Widok | undefined = przypietyWidok && dostepne.includes(przypietyWidok)
    ? przypietyWidok
    : dostepne[krok % Math.max(1, dostepne.length)];
  const TYTUL_WIDOKU: Record<Widok, string> = {
    tabele: tabeleGrup.some((t) => t.grupa) ? 'Grupy' : 'Tabela',
    wyniki: 'Wyniki',
    strzelcy: zdobycz.naglowek,
    final: finalowa ? 'Grupa finałowa' : 'Faza pucharowa',
  };

  // Kod QR: jedyna droga z hali do telefonu kibica. Duży, na białym tle,
  // z adresem obok dla tych, którzy wolą przepisać.
  const kartaQr = (poziomo: boolean) => (
    <div className={`flex items-center gap-[1.2em] rounded-[1em] bg-white/[0.06] p-[0.9em] ${poziomo ? '' : 'flex-col text-center'}`}>
      <KodQr tekst={link} etykieta={`Kod QR do turnieju: ${linkBezProtokolu}`} className="h-[9em] w-[9em] shrink-0 rounded-[0.4em]" />
      <div className="min-w-0">
        <p className="text-[1.25em] text-slate-300">Wyniki, tabele i Twoje mecze w telefonie</p>
        <p className="font-display text-[3em] font-bold leading-none tracking-tight">
          bojo<span className="text-primary-400">.pl</span>
        </p>
        <p className="mt-[0.3em] truncate text-[1.05em] text-slate-400">{linkBezProtokolu}</p>
      </div>
    </div>
  );

  const naglowek = (
    <header className="flex items-center gap-[1.2em] border-b border-white/10 px-[1.6em] py-[0.8em]">
      <span className="shrink-0 rounded-[0.35em] bg-primary-700 px-[0.5em] py-[0.1em] font-display text-[1.6em] font-bold">bojo.pl</span>
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
          <p className="mt-[0.6em] text-[1.6em] text-slate-300">Dziękujemy za wspólną grę!</p>
          <div className="mt-[1em]">{kartaQr(true)}</div>
        </main>
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
          {/* Kod QR na dole lewej kolumny: widać go cały czas, niezależnie
              od tego, który widok kręci się po prawej. */}
          <div className="mt-auto">{kartaQr(true)}</div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          {widok && (
            <>
              {/* Pasek widoków: który teraz i co będzie dalej. */}
              <div className="mb-[0.8em] flex items-center gap-[0.5em]">
                {/* WYBÓR WIDOKU KLIKNIĘCIEM (2026-11-21): organizator, który ma
                    ekran na drugim monitorze albo rzutniku z laptopa, klika
                    nazwę widoku i ekran zostaje na nim (np. tabele przed
                    fazą pucharową). Ponowne kliknięcie wraca do przełączania.
                    Wybór trafia do adresu (`?widok=`), więc przetrwa
                    odświeżenie strony. */}
                {dostepne.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => przypnijWidok(przypietyWidok === w ? null : w)}
                    aria-pressed={przypietyWidok === w}
                    className={`rounded-full px-[0.8em] py-[0.25em] text-[1.05em] font-semibold uppercase tracking-wide transition-colors ${
                      w === widok ? 'bg-white text-slate-950' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {TYTUL_WIDOKU[w]}{przypietyWidok === w ? ' · stałe' : ''}
                  </button>
                ))}
              </div>
              <div key={widok} className="min-h-0 flex-1 animate-fade-in">
                {widok === 'tabele' && (
                  <div className={`grid gap-[0.8em] ${tabeleGrup.length > 2 ? 'grid-cols-2' : ''}`}>
                    {tabeleGrup.map(({ grupa, wiersze }) => {
                      const awans = grupa && !grupa.finalowa && turniej.awansujeZGrupy < wiersze.length ? turniej.awansujeZGrupy : 0;
                      return (
                        <div key={grupa?.id ?? 'liga'} className="rounded-[0.6em] bg-white/5 px-[0.8em] py-[0.5em]">
                          {grupa && (
                            <p className="mb-[0.2em] text-[1.1em] font-semibold text-slate-300">
                              Grupa {grupa.nazwa}{grupa.finalowa ? ' (finałowa)' : ''}
                            </p>
                          )}
                          <table className="w-full text-[1.35em]">
                            <thead>
                              <tr className="text-[0.65em] uppercase tracking-wide text-slate-500">
                                <th />
                                <th className="text-left font-medium">Drużyna</th>
                                <th className="text-right font-medium">M</th>
                                <th className="text-right font-medium">Bramki</th>
                                <th className="text-right font-medium">Pkt</th>
                              </tr>
                            </thead>
                            <tbody>
                              {wiersze.map((w, i) => (
                                <tr key={w.druzynaId} className={i < awans ? 'text-white' : 'text-slate-300'}>
                                  <td className={`w-[1.6em] py-[0.15em] pl-[0.3em] tabular-nums ${i < awans ? 'border-l-[0.2em] border-primary-400 font-bold text-primary-300' : 'text-slate-500'}`}>{i + 1}</td>
                                  <td className="max-w-0 truncate py-[0.15em] font-medium">{w.nazwa}</td>
                                  <td className="w-[1.8em] py-[0.15em] text-right tabular-nums text-slate-400">{w.mecze}</td>
                                  <td className="w-[3.4em] py-[0.15em] text-right tabular-nums text-slate-400">{w.bramkiZdobyte}:{w.bramkiStracone}</td>
                                  <td className="w-[2.2em] py-[0.15em] text-right font-bold tabular-nums">{w.punkty}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                )}

                {widok === 'wyniki' && (
                  <div className="divide-y divide-white/10">
                    {rozegrane.slice(0, 10).map((m) => (
                      <div key={m.id} className="flex items-center gap-[0.8em] py-[0.4em] text-[1.4em]">
                        <span className="w-[2.6em] shrink-0 text-[0.75em] text-slate-500">{etykietaFazyMeczu(m, grupyPoId).replace('Grupa ', 'Gr. ')}</span>
                        <span className="min-w-0 flex-1 truncate">{nazwa(m, 'a')} <span className="text-slate-500">–</span> {nazwa(m, 'b')}</span>
                        <span className="shrink-0 font-display font-bold tabular-nums">
                          {m.status === 'walkower' ? 'wo.' : `${m.wynikA}:${m.wynikB}`}
                          {m.karneA !== undefined && m.karneB !== undefined && (
                            <span className="ml-[0.3em] text-[0.7em] font-normal text-slate-400">k. {m.karneA}:{m.karneB}</span>
                          )}
                        </span>
                      </div>
                    ))}
                    {rozegrane.length > 10 && (
                      <p className="pt-[0.5em] text-[1.1em] text-slate-400">
                        i {withCount(rozegrane.length - 10, 'mecz', 'mecze', 'meczów')} wcześniej · wszystkie na {linkBezProtokolu.split('/')[0]}
                      </p>
                    )}
                  </div>
                )}

                {widok === 'strzelcy' && (
                  <ol className="divide-y divide-white/10">
                    {strzelcy.slice(0, 10).map((w, i) => (
                      <li key={w.zawodnikId} className="flex items-center gap-[0.8em] py-[0.4em] text-[1.4em]">
                        <span className={`w-[1.4em] shrink-0 text-right font-bold tabular-nums ${i < 3 ? 'text-primary-300' : 'text-slate-500'}`}>{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-semibold">{w.imie}</span>
                          {w.druzynaNazwa && <span className="text-slate-400"> · {w.druzynaNazwa}</span>}
                        </span>
                        <span className="shrink-0 font-display text-[1.2em] font-bold tabular-nums">{w.gole}</span>
                      </li>
                    ))}
                  </ol>
                )}

                {widok === 'final' && (
                  <div className="divide-y divide-white/10">
                    {meczeFinalu.slice(0, 10).map((m) => {
                      const wynik = m.status === 'zakonczony' || m.status === 'walkower' || m.status === 'trwa';
                      return (
                        <div key={m.id} className="flex items-center gap-[0.8em] py-[0.45em] text-[1.4em]">
                          <span className="w-[3.2em] shrink-0 font-bold tabular-nums">{godzina(m)}</span>
                          <span className="min-w-0 flex-1">
                            {!finalowa && <span className="block text-[0.65em] uppercase tracking-wide text-slate-500">{etykietaFazyMeczu(m, grupyPoId)}</span>}
                            <span className="block truncate">{nazwa(m, 'a')} <span className="text-slate-500">–</span> {nazwa(m, 'b')}</span>
                          </span>
                          {wynik && (
                            <span className={`shrink-0 font-display font-bold tabular-nums ${m.status === 'trwa' ? 'text-primary-300' : ''}`}>
                              {m.wynikA}:{m.wynikB}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>

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
