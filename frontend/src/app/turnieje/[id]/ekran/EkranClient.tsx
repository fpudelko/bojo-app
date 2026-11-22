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
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { Coffee, Megaphone, Sun, Moon } from 'lucide-react';
import {
  UKLADY_EKRANU, CZAS_UKLADU_NA_ZMIANE_MS, czyUkladEkranu, ukladyNaZmiane, przerwaTeraz, adresDoPodpisu,
  type UkladEkranu, type MotywEkranu,
} from '@/lib/ekranTurnieju';
import { getTurniej } from '@/lib/turnieje';
import { getDruzyny, getDruzynyZeSkladem } from '@/lib/turniejDruzyny';
import { getMecze, getAreny, getGrupy, getPrzerwy, getZdarzeniaTurnieju } from '@/lib/turniejMecze';
import { obliczKlasyfikacje, posortujKlasyfikacje } from '@/lib/turniejStatystyki';
import { linkDoTurnieju } from '@/lib/turniejShare';
import { useAuth } from '@/lib/auth';
import KodQr from '@/components/ui/KodQr';
import { centrumTurnieju, postepTurnieju } from '@/lib/turniejPulpit';
import { tabeleTurnieju, miejscaWTabeli } from '@/lib/turniejTabela';
import { terminarzZPrzerwami, meczPrzed, stanTurnieju, etykietaTerminu, etykietaZdobyczy, etykietaFazyMeczu } from '@/lib/turniejEtykiety';
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

// UKŁAD EKRANU i MOTYW (2026-11-21, prośby właściciela): lista układów,
// adres i „co teraz pokazać” żyją w `lib/ekranTurnieju.ts`, wspólnie z panelem.

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
  const [uklad, setUklad] = useState<UkladEkranu>('wszystko');
  const [motyw, setMotyw] = useState<MotywEkranu>('ciemny');
  const [krokUkladu, setKrokUkladu] = useState(0);
  // Sterowanie widać tylko chwilę po ruchu myszy albo dotknięciu: na ścianie
  // przez cały dzień wisiałyby przyciski, których kibic i tak nie użyje.
  const [sterowanie, setSterowanie] = useState(false);
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
    const parametry = new URLSearchParams(window.location.search);
    const w = parametry.get('widok');
    if (w && (WIDOKI as readonly string[]).includes(w)) setPrzypietyWidok(w as Widok);
    const u = parametry.get('uklad');
    if (czyUkladEkranu(u)) setUklad(u);
    if (parametry.get('motyw') === 'jasny') setMotyw('jasny');
    const t = window.setInterval(() => setKrok((k) => k + 1), CZAS_WIDOKU_MS);
    const tu = window.setInterval(() => setKrokUkladu((k) => k + 1), CZAS_UKLADU_NA_ZMIANE_MS);
    return () => { window.clearInterval(t); window.clearInterval(tu); };
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

  useEffect(() => {
    let schowaj: number | undefined;
    const pokaz = () => {
      setSterowanie(true);
      window.clearTimeout(schowaj);
      schowaj = window.setTimeout(() => setSterowanie(false), 3000);
    };
    window.addEventListener('mousemove', pokaz);
    window.addEventListener('touchstart', pokaz);
    return () => {
      window.clearTimeout(schowaj);
      window.removeEventListener('mousemove', pokaz);
      window.removeEventListener('touchstart', pokaz);
    };
  }, []);

  const ustawWAdresie = (klucz: string, wartosc: string | null) => {
    const url = new URL(window.location.href);
    if (wartosc) url.searchParams.set(klucz, wartosc); else url.searchParams.delete(klucz);
    window.history.replaceState(null, '', url.pathname + url.search);
  };
  const zmienUklad = (u: UkladEkranu) => {
    setUklad(u);
    setKrokUkladu(0);
    ustawWAdresie('uklad', u === 'wszystko' ? null : u);
  };
  const zmienMotyw = (m: MotywEkranu) => {
    setMotyw(m);
    ustawWAdresie('motyw', m === 'jasny' ? 'jasny' : null);
  };

  const przypnijWidok = (w: Widok | null) => {
    setPrzypietyWidok(w);
    if (w === null) setKrok(0);
    const url = new URL(window.location.href);
    if (w) url.searchParams.set('widok', w); else url.searchParams.delete('widok');
    window.history.replaceState(null, '', url.pathname + url.search);
  };

  if (turniej === undefined || !teraz) {
    return <Tlo motyw={motyw}><p className="m-auto text-[2em] text-[color:var(--e-tekst3)]">Ładuję…</p></Tlo>;
  }
  if (turniej === null) {
    return <Tlo motyw={motyw}><p className="m-auto text-[2em] text-[color:var(--e-tekst3)]">Nie znaleziono turnieju.</p></Tlo>;
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
  // ── Ogłoszenie i zbiórka (180) ───────────────────────────────────────────
  const komunikat = turniej.ekranKomunikat?.trim() || '';
  const linkZbiorki = turniej.ekranLink && /^https?:\/\//i.test(turniej.ekranLink) ? turniej.ekranLink : '';
  const opisZbiorki = turniej.ekranLinkOpis?.trim() || 'Wesprzyj zbiórkę';
  const maOgloszenie = !!komunikat || !!linkZbiorki;
  const doRozegrania = mecze
    .filter((m) => m.status === 'zaplanowany' || m.status === 'trwa')
    .sort((a, b) => (a.status === 'trwa' ? -1 : b.status === 'trwa' ? 1 : 0) || (a.zaplanowanyAt ?? '').localeCompare(b.zaplanowanyAt ?? '') || a.numer - b.numer);

  // „Na zmianę”: układy, które mają co pokazać, po kolei co 20 s.
  const sekwencja = ukladyNaZmiane({
    maMecz: c.naZywo.length > 0 || c.najblizsze.length > 0,
    maTabele: tabeleGrup.length > 0,
    maTerminarz: doRozegrania.length > 0,
    maOgloszenie,
  });
  const ukl: UkladEkranu = uklad === 'zmiana' ? sekwencja[krokUkladu % sekwencja.length] : uklad;

  const dostepne: Widok[] = [
    ...(tabeleGrup.length > 0 ? ['tabele' as const] : []),
    ...(rozegrane.length > 0 ? ['wyniki' as const] : []),
    ...(strzelcy.length > 0 ? ['strzelcy' as const] : []),
    ...(meczeFinalu.length > 0 ? ['final' as const] : []),
  ].filter((w) => ukl !== 'mecze' || w === 'wyniki' || w === 'final');
  const widok: Widok | undefined = przypietyWidok && dostepne.includes(przypietyWidok)
    ? przypietyWidok
    : dostepne[krok % Math.max(1, dostepne.length)];
  const TYTUL_WIDOKU: Record<Widok, string> = {
    tabele: tabeleGrup.some((t) => t.grupa) ? 'Grupy' : 'Tabela',
    wyniki: 'Wyniki',
    strzelcy: zdobycz.naglowek,
    final: finalowa ? 'Grupa finałowa' : 'Faza pucharowa',
  };

  // Kod QR: jedyna droga z hali do telefonu kibica. Duży, na białym tle
  // (w obu motywach: telefon czyta ciemne moduły na jasnym), z adresem obok
  // dla tych, którzy wolą przepisać. `kompakt`, gdy obok stoi drugi kod.
  const kartaQr = (opcje: { tekst: string; nadtytul: string; tytul: ReactNode; podpis: string; kompakt?: boolean; wyroznij?: boolean }) => (
    <div className={`flex min-w-0 flex-1 items-center gap-[1em] rounded-[1em] p-[0.9em] ${
      opcje.wyroznij ? 'border-2 border-[color:var(--e-zywo-ramka)] bg-[color:var(--e-komunikat)]' : 'bg-[color:var(--e-karta)]'
    }`}>
      <KodQr tekst={opcje.tekst} etykieta={`Kod QR: ${opcje.podpis}`} className={`${opcje.kompakt ? 'h-[7.5em] w-[7.5em]' : 'h-[9em] w-[9em]'} shrink-0 rounded-[0.4em]`} />
      <div className="min-w-0">
        <p className="truncate text-[1.2em] text-[color:var(--e-tekst2)]">{opcje.nadtytul}</p>
        <p className={`font-display font-bold leading-tight tracking-tight ${opcje.kompakt ? 'line-clamp-2 text-[2em]' : 'text-[3em] leading-none'}`}>{opcje.tytul}</p>
        <p className="mt-[0.3em] truncate text-[1em] text-[color:var(--e-tekst3)]">{opcje.podpis}</p>
      </div>
    </div>
  );
  const bojoTytul = <>bojo<span className="text-[color:var(--e-akcent)]">.pl</span></>;
  const kartaBojo = (kompakt = false) => kartaQr({
    tekst: link, nadtytul: 'Wyniki, tabele i Twoje mecze w telefonie', tytul: bojoTytul, podpis: linkBezProtokolu, kompakt,
  });
  const kartaZbiorki = (kompakt = false) => linkZbiorki ? kartaQr({
    tekst: linkZbiorki, nadtytul: 'Zeskanuj i wesprzyj', tytul: opisZbiorki, podpis: adresDoPodpisu(linkZbiorki), kompakt, wyroznij: true,
  }) : null;
  // Zbiórka pierwsza: na turnieju charytatywnym to ona jest celem dnia.
  const blokPromocji = (
    <div className="flex min-w-0 gap-[0.8em]">
      {kartaZbiorki(true)}
      {kartaBojo(!!linkZbiorki)}
    </div>
  );
  // Pasek ogłoszenia pod nagłówkiem, na każdym układzie poza „Ogłoszeniem”
  // (tam tekst jest całym ekranem).
  const pasekKomunikatu = komunikat && ukl !== 'ogloszenie' ? (
    <div className="flex items-center gap-[0.8em] bg-[color:var(--e-komunikat)] px-[1.6em] py-[0.6em]">
      <Megaphone className="h-[1.6em] w-[1.6em] shrink-0 text-[color:var(--e-akcent)]" aria-hidden />
      <p className="line-clamp-2 text-[1.5em] font-semibold">{komunikat}</p>
    </div>
  ) : null;

  const naglowek = (
    <header className="flex items-center gap-[1.2em] border-b border-[color:var(--e-linia)] px-[1.6em] py-[0.8em]">
      <span className="shrink-0 rounded-[0.35em] bg-primary-700 px-[0.5em] py-[0.1em] font-display text-[1.6em] font-bold text-[#ffffff]">bojo.pl</span>
      <h1 className="min-w-0 flex-1 truncate font-display text-[2em] font-bold">{turniej.nazwa}</h1>
      {postep.wszystkie > 0 && podium.length === 0 && (
        <p className="shrink-0 text-[1.3em] text-[color:var(--e-tekst2)]">
          <span className="font-display text-[1.4em] font-bold tabular-nums text-[color:var(--e-tekst)]">{postep.rozegrane}</span>
          {' '}z {withCount(postep.wszystkie, 'meczu', 'meczów', 'meczów')}
        </p>
      )}
      <p className="shrink-0 font-display text-[2em] font-bold tabular-nums">{zegarSciany}</p>
    </header>
  );

  // ── Po turnieju: podium na cały ekran ────────────────────────────────────
  if (podium.length > 0) {
    return (
      <Tlo motyw={motyw}>
        {naglowek}
        {pasekKomunikatu}
        <main className="flex flex-1 flex-col items-center justify-center gap-[1.2em] text-center">
          <p className="text-[1.6em] font-semibold uppercase tracking-[0.2em] text-[color:var(--e-akcent)]">Turniej zakończony</p>
          {podium.map((p) => (
            <p
              key={p.druzynaId}
              className={p.miejsce === 1 ? 'font-display text-[5em] font-bold leading-tight' : 'text-[2.6em] font-semibold text-[color:var(--e-tekst2)]'}
            >
              {medal(p.miejsce)} {p.nazwa}
            </p>
          ))}
          <p className="mt-[0.6em] text-[1.6em] text-[color:var(--e-tekst2)]">Dziękujemy za wspólną grę!</p>
          <div className="mt-[1em] w-[60em] max-w-full">{blokPromocji}</div>
        </main>
      </Tlo>
    );
  }

  const nastepny = c.najblizsze.find((m) => m.druzynaAId && m.druzynaBId) ?? c.najblizsze[0];
  const kolejne = c.najblizsze.filter((m) => c.naZywo.length > 0 || m.id !== nastepny?.id).slice(0, ukl === 'wynik' ? 3 : 5);
  const przerwa = c.naZywo.length === 0 ? przerwaTeraz(przerwy, teraz) : null;


  // ── Klocki ekranu (wspólne dla układów) ──────────────────────────────────
  // Wszystkie rozmiary są w `em`, więc ten sam klocek w opakowaniu z większym
  // `font-size` po prostu rośnie (układ „Wynik na żywo”, „Tabele”).
  const blokTeraz = (
    c.naZywo.length > 0 ? (
            <section className={`grid gap-[1em] ${c.naZywo.length > 1 ? 'grid-cols-2' : ''}`}>
              {c.naZywo.map((m) => {
                const zegar = czasGry(m.rozpoczetyAt, teraz, turniej.czasMeczuMin);
                const poCzasieGry = poCzasie(m.rozpoczetyAt, turniej.czasMeczuMin, teraz);
                const arena = m.arenaId ? arenyPoId.get(m.arenaId) : undefined;
                const duzy = c.naZywo.length === 1;
                return (
                  <div key={m.id} className="rounded-[1em] border-2 border-[color:var(--e-zywo-ramka)] bg-[color:var(--e-zywo-tlo)] px-[1.4em] py-[1em]">
                    <div className="flex items-center justify-between text-[1.2em]">
                      <span className="inline-flex items-center gap-[0.4em] font-semibold uppercase tracking-wide text-[color:var(--e-akcent)]">
                        <span className="h-[0.6em] w-[0.6em] animate-pulse rounded-full bg-primary-400" aria-hidden />
                        Na żywo{kilkaAren && arena ? ` · ${arena}` : ''} · M{m.numer}
                      </span>
                      {zegar && (
                        <span className={`font-display font-bold tabular-nums ${poCzasieGry ? 'text-[color:var(--e-uwaga)]' : 'text-[color:var(--e-tekst)]'}`}>{zegar}</span>
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
          ) : przerwa ? (
            // PRZERWA W TOKU (176): nazwa organizatora („Licytacje”) zamiast
            // „Następny mecz o 13:00”, który wyglądał jak zawieszony ekran.
            <section className="rounded-[1em] border border-[color:var(--e-linia)] bg-[color:var(--e-karta)] px-[1.4em] py-[1em]">
              <p className="inline-flex items-center gap-[0.5em] text-[1.2em] font-semibold uppercase tracking-wide text-[color:var(--e-tekst2)]">
                <Coffee className="h-[1em] w-[1em]" aria-hidden /> Przerwa do {chwilaWPolsce(przerwa.doAt).godzina.slice(0, 5)}
              </p>
              <p className="mt-[0.3em] font-display text-[2.8em] font-bold leading-tight">{przerwa.nazwa}</p>
              {przerwa.opis && <p className="mt-[0.3em] line-clamp-2 text-[1.4em] text-[color:var(--e-tekst2)]">{przerwa.opis}</p>}
              {nastepny && (
                <p className="mt-[0.6em] text-[1.3em] text-[color:var(--e-tekst3)]">
                  Potem{nastepny.zaplanowanyAt ? ` o ${godzina(nastepny)}` : ''}: {nazwa(nastepny, 'a')} – {nazwa(nastepny, 'b')}
                </p>
              )}
            </section>
          ) : nastepny ? (
            <section className="rounded-[1em] border border-[color:var(--e-linia)] bg-[color:var(--e-karta)] px-[1.4em] py-[1em]">
              <p className="text-[1.2em] font-semibold uppercase tracking-wide text-[color:var(--e-tekst2)]">
                Następny mecz{nastepny.zaplanowanyAt ? ` · ${godzina(nastepny)}` : ''}{kilkaAren && nastepny.arenaId ? ` · ${arenyPoId.get(nastepny.arenaId)}` : ''}
              </p>
              <p className="mt-[0.4em] font-display text-[2.8em] font-bold leading-tight">
                {nazwa(nastepny, 'a')} <span className="text-[color:var(--e-tekst3)]">–</span> {nazwa(nastepny, 'b')}
              </p>
            </section>
          ) : (
            <section className="rounded-[1em] border border-[color:var(--e-linia)] bg-[color:var(--e-karta)] px-[1.4em] py-[1em]">
              <p className="font-display text-[2.4em] font-bold">
                {turniej.status === 'trwa' ? 'Za chwilę kolejne mecze' : `Start: ${etykietaTerminu(turniej.dataStartu, turniej.godzinaStartu)}`}
              </p>
            </section>
          )
  );
  const blokKolejne = (
    kolejne.length > 0 && (
            <section className="min-h-0">
              <h2 className="mb-[0.4em] text-[1.2em] font-semibold uppercase tracking-wide text-[color:var(--e-tekst3)]">Kolejne mecze</h2>
              <div className="divide-y divide-[color:var(--e-linia)]">
                {terminarzZPrzerwami(kolejne, przerwy.filter((p) => new Date(p.doAt) > teraz), { ...turniej, poprzedni: meczPrzed(mecze, kolejne[0]) }).map((w) => (
                  w.typ === 'przerwa' ? (
                    <p key={w.przerwaId ?? `p-${w.od}`} className="flex items-center gap-[0.6em] py-[0.45em] text-[1.4em] text-[color:var(--e-tekst2)]">
                      <Coffee className="h-[1em] w-[1em] shrink-0 text-[color:var(--e-tekst4)]" aria-hidden />
                      <span className="tabular-nums">{w.od}–{w.do}</span>
                      <span className="truncate">{w.nazwa ?? 'Przerwa'}</span>
                    </p>
                  ) : (
                    <div key={w.mecz.id} className="flex items-center gap-[0.8em] py-[0.45em] text-[1.6em]">
                      <span className="w-[3.2em] shrink-0 font-bold tabular-nums">{godzina(w.mecz)}</span>
                      <span className="min-w-0 flex-1 truncate">{nazwa(w.mecz, 'a')} <span className="text-[color:var(--e-tekst4)]">–</span> {nazwa(w.mecz, 'b')}</span>
                      {kilkaAren && w.mecz.arenaId && (
                        <span className="shrink-0 text-[0.75em] text-[color:var(--e-tekst3)]">{arenyPoId.get(w.mecz.arenaId)}</span>
                      )}
                    </div>
                  )
                ))}
              </div>
            </section>
          )
  );
  const blokTabele = (kolumny: number) => (
    <div className="grid gap-[0.8em]" style={{ gridTemplateColumns: `repeat(${kolumny}, minmax(0, 1fr))` }}>
                    {tabeleGrup.map(({ grupa, wiersze }) => {
                      const awans = grupa && !grupa.finalowa && turniej.awansujeZGrupy < wiersze.length ? turniej.awansujeZGrupy : 0;
                      // Miejsca ex aequo (179): ta sama liczba przy drużynach z identycznym bilansem.
                      const miejsca = miejscaWTabeli(wiersze);
                      return (
                        <div key={grupa?.id ?? 'liga'} className="rounded-[0.6em] bg-[color:var(--e-karta)] px-[0.8em] py-[0.5em]">
                          {grupa && (
                            <p className="mb-[0.2em] text-[1.1em] font-semibold text-[color:var(--e-tekst2)]">
                              Grupa {grupa.nazwa}{grupa.finalowa ? ' (finałowa)' : ''}
                            </p>
                          )}
                          <table className="w-full text-[1.35em]">
                            <thead>
                              <tr className="text-[0.65em] uppercase tracking-wide text-[color:var(--e-tekst4)]">
                                <th />
                                <th className="text-left font-medium">Drużyna</th>
                                <th className="text-right font-medium">M</th>
                                <th className="text-right font-medium">Bramki</th>
                                <th className="text-right font-medium">Pkt</th>
                              </tr>
                            </thead>
                            <tbody>
                              {wiersze.map((w, i) => (
                                <tr key={w.druzynaId} className={i < awans ? 'text-[color:var(--e-tekst)]' : 'text-[color:var(--e-tekst2)]'}>
                                  <td className={`w-[1.6em] py-[0.15em] pl-[0.3em] tabular-nums ${i < awans ? 'border-l-[0.2em] border-[color:var(--e-akcent)] font-bold text-[color:var(--e-akcent)]' : 'text-[color:var(--e-tekst4)]'}`}>{miejsca[i]}</td>
                                  <td className="max-w-0 truncate py-[0.15em] font-medium">{w.nazwa}</td>
                                  <td className="w-[1.8em] py-[0.15em] text-right tabular-nums text-[color:var(--e-tekst3)]">{w.mecze}</td>
                                  <td className="w-[3.4em] py-[0.15em] text-right tabular-nums text-[color:var(--e-tekst3)]">{w.bramkiZdobyte}:{w.bramkiStracone}</td>
                                  <td className="w-[2.2em] py-[0.15em] text-right font-bold tabular-nums">{w.punkty}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
  );

  return (
    <Tlo motyw={motyw}>
      {naglowek}
      {pasekKomunikatu}
      {ukl === 'terminarz' ? (
        // TERMINARZ DNIA: wszystkie mecze do rozegrania w kolumnach, w kolejności
        // godzin, z przerwami. Odpowiedź na najczęstsze pytanie przy stoliku
        // organizatora: „kiedy gramy?”.
        <main className="flex min-h-0 flex-1 flex-col gap-[1em] px-[1.6em] py-[1.2em]">
          <h2 className="text-[1.3em] font-semibold uppercase tracking-wide text-[color:var(--e-tekst3)]">
            Terminarz · {withCount(doRozegrania.length, 'mecz', 'mecze', 'meczów')} do końca
          </h2>
          <div
            className="min-h-0 flex-1 overflow-hidden"
            style={{ columnCount: doRozegrania.length > 24 ? 3 : doRozegrania.length > 8 ? 2 : 1, columnGap: '2.4em', fontSize: doRozegrania.length > 36 ? '0.9em' : doRozegrania.length > 16 ? '1.1em' : '1.35em' }}
          >
            {terminarzZPrzerwami(doRozegrania, przerwy.filter((p) => new Date(p.doAt) > teraz), { ...turniej, poprzedni: doRozegrania[0]?.status === 'trwa' ? undefined : meczPrzed(mecze, doRozegrania[0]) }).map((w) => (
              w.typ === 'przerwa' ? (
                <p key={w.przerwaId ?? `p-${w.od}`} className="flex break-inside-avoid items-center gap-[0.5em] py-[0.35em] text-[1.3em] text-[color:var(--e-tekst3)]">
                  <Coffee className="h-[1em] w-[1em] shrink-0" aria-hidden />
                  <span className="tabular-nums">{w.od}–{w.do}</span>
                  <span className="truncate">{w.nazwa ?? 'Przerwa'}</span>
                </p>
              ) : (
                <div
                  key={w.mecz.id}
                  className={`flex break-inside-avoid items-center gap-[0.7em] border-b border-[color:var(--e-linia)] py-[0.35em] text-[1.5em] ${
                    w.mecz.status === 'trwa' ? 'font-semibold text-[color:var(--e-akcent)]' : ''
                  }`}
                >
                  <span className="w-[2.9em] shrink-0 font-bold tabular-nums">{w.mecz.status === 'trwa' ? 'teraz' : godzina(w.mecz)}</span>
                  <span className="min-w-0 flex-1 truncate">{nazwa(w.mecz, 'a')} <span className="text-[color:var(--e-tekst4)]">–</span> {nazwa(w.mecz, 'b')}</span>
                  {kilkaAren && w.mecz.arenaId && <span className="shrink-0 text-[0.7em] text-[color:var(--e-tekst3)]">{arenyPoId.get(w.mecz.arenaId)}</span>}
                </div>
              )
            ))}
          </div>
          <div className="w-[60%]">{blokPromocji}</div>
        </main>
      ) : ukl === 'ogloszenie' ? (
        // OGŁOSZENIE: tekst organizatora i kod QR zbiórki na cały ekran
        // (przerwy, dekoracja, licytacje). Mecz w toku zostaje paskiem na dole.
        <main className="flex min-h-0 flex-1 flex-col gap-[1.4em] px-[2.4em] py-[1.6em]">
          {maOgloszenie ? (
            <div className="flex min-h-0 flex-1 items-center gap-[3em]">
              <div className="min-w-0 flex-1">
                {komunikat && <p className="whitespace-pre-line font-display text-[3.6em] font-bold leading-tight">{komunikat}</p>}
                {linkZbiorki && (
                  <p className="mt-[0.8em] text-[2em] font-semibold text-[color:var(--e-akcent)]">{opisZbiorki}</p>
                )}
                {linkZbiorki && <p className="mt-[0.2em] text-[1.4em] text-[color:var(--e-tekst3)]">{adresDoPodpisu(linkZbiorki)}</p>}
              </div>
              {linkZbiorki && (
                <div className="shrink-0 text-center">
                  <KodQr tekst={linkZbiorki} etykieta={`Kod QR: ${adresDoPodpisu(linkZbiorki)}`} className="h-[24em] w-[24em] rounded-[0.8em]" />
                  <p className="mt-[0.6em] text-[1.6em] font-semibold">Zeskanuj i wesprzyj</p>
                </div>
              )}
            </div>
          ) : (
            <p className="m-auto max-w-[40em] text-center text-[2em] text-[color:var(--e-tekst3)]">
              Brak ogłoszenia. Organizator dodaje je w panelu turnieju: Ustawienia → Ekran na halę.
            </p>
          )}
          <div className="flex items-end gap-[1.6em]">
            <div className="min-w-0 flex-1 text-[1.4em]">
              {c.naZywo.map((m) => (
                <p key={m.id} className="truncate">
                  <span className="mr-[0.5em] text-[0.75em] font-semibold uppercase tracking-wide text-[color:var(--e-akcent)]">Na żywo</span>
                  {nazwa(m, 'a')} <span className="font-display font-bold tabular-nums">{m.wynikA}:{m.wynikB}</span> {nazwa(m, 'b')}
                </p>
              ))}
            </div>
            <div className="w-[34em] shrink-0">{kartaBojo(true)}</div>
          </div>
        </main>
      ) : ukl === 'wynik' ? (
        // TABLICA WYNIKÓW: mecz w toku (albo następny) na pół ekranu.
        <main className="flex min-h-0 flex-1 flex-col gap-[1.2em] px-[1.6em] py-[1.2em]">
          <div className="flex min-h-0 flex-1 flex-col justify-center" style={{ fontSize: c.naZywo.length > 1 ? '1.4em' : '1.9em' }}>
            {blokTeraz}
          </div>
          <div className="grid grid-cols-[1.1fr_1fr] items-end gap-[1.6em]">
            <div className="min-w-0">{blokKolejne}</div>
            {blokPromocji}
          </div>
        </main>
      ) : ukl === 'tabele' ? (
        // WSZYSTKIE TABELE NARAZ, duże. Mecz w toku jednym paskiem nad nimi.
        <main className="flex min-h-0 flex-1 flex-col gap-[1em] px-[1.6em] py-[1.2em]">
          <div className="flex items-center gap-[1.6em]">
            <div className="min-w-0 flex-1 space-y-[0.5em]">
              {c.naZywo.length > 0 ? c.naZywo.map((m) => (
                <p key={m.id} className="flex items-center gap-[0.6em] truncate text-[1.8em] font-semibold">
                  <span className="h-[0.45em] w-[0.45em] shrink-0 animate-pulse rounded-full bg-primary-400" aria-hidden />
                  <span className="text-[0.6em] uppercase tracking-wide text-[color:var(--e-akcent)]">Na żywo</span>
                  <span className="truncate">{nazwa(m, 'a')}</span>
                  <span className="font-display font-bold tabular-nums">{m.wynikA}:{m.wynikB}</span>
                  <span className="truncate">{nazwa(m, 'b')}</span>
                </p>
              )) : nastepny ? (
                <p className="truncate text-[1.6em] text-[color:var(--e-tekst2)]">
                  <span className="text-[0.7em] uppercase tracking-wide text-[color:var(--e-tekst3)]">Następny{nastepny.zaplanowanyAt ? ` · ${godzina(nastepny)}` : ''}</span>{' '}
                  {nazwa(nastepny, 'a')} <span className="text-[color:var(--e-tekst4)]">–</span> {nazwa(nastepny, 'b')}
                </p>
              ) : null}
            </div>
            <div className="w-[48%] shrink-0" style={{ fontSize: '0.75em' }}>{blokPromocji}</div>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden" style={{ fontSize: tabeleGrup.length > 4 ? '1em' : tabeleGrup.length > 2 ? '1.2em' : '1.6em' }}>
            {tabeleGrup.length > 0
              ? blokTabele(Math.min(3, tabeleGrup.length))
              : <p className="text-[1.6em] text-[color:var(--e-tekst3)]">Tabele pojawią się po pierwszym meczu.</p>}
          </div>
        </main>
      ) : (
      <main className="grid min-h-0 flex-1 grid-cols-[1.35fr_1fr] gap-[1.6em] px-[1.6em] py-[1.2em]">
          <div className="flex min-h-0 min-w-0 flex-col gap-[1.2em]">
            {blokTeraz}
  
            {blokKolejne}
            {/* Kod QR na dole lewej kolumny: widać go cały czas, niezależnie
                od tego, który widok kręci się po prawej. */}
            <div className="mt-auto">{blokPromocji}</div>
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
                        w === widok ? 'bg-[color:var(--e-aktywny)] text-[color:var(--e-aktywny-tekst)]' : 'text-[color:var(--e-tekst4)] hover:text-[color:var(--e-tekst2)]'
                      }`}
                    >
                      {TYTUL_WIDOKU[w]}{przypietyWidok === w ? ' · stałe' : ''}
                    </button>
                  ))}
                </div>
                <div key={widok} className="min-h-0 flex-1 animate-fade-in">
                  {widok === 'tabele' && blokTabele(tabeleGrup.length > 2 ? 2 : 1)}
  
                  {widok === 'wyniki' && (
                    <div className="divide-y divide-[color:var(--e-linia)]">
                      {rozegrane.slice(0, 10).map((m) => (
                        <div key={m.id} className="flex items-center gap-[0.8em] py-[0.4em] text-[1.4em]">
                          <span className="w-[2.6em] shrink-0 text-[0.75em] text-[color:var(--e-tekst4)]">{etykietaFazyMeczu(m, grupyPoId).replace('Grupa ', 'Gr. ')}</span>
                          <span className="min-w-0 flex-1 truncate">{nazwa(m, 'a')} <span className="text-[color:var(--e-tekst4)]">–</span> {nazwa(m, 'b')}</span>
                          <span className="shrink-0 font-display font-bold tabular-nums">
                            {m.status === 'walkower' ? 'wo.' : `${m.wynikA}:${m.wynikB}`}
                            {m.karneA !== undefined && m.karneB !== undefined && (
                              <span className="ml-[0.3em] text-[0.7em] font-normal text-[color:var(--e-tekst3)]">k. {m.karneA}:{m.karneB}</span>
                            )}
                          </span>
                        </div>
                      ))}
                      {rozegrane.length > 10 && (
                        <p className="pt-[0.5em] text-[1.1em] text-[color:var(--e-tekst3)]">
                          i {withCount(rozegrane.length - 10, 'mecz', 'mecze', 'meczów')} wcześniej · wszystkie na {linkBezProtokolu.split('/')[0]}
                        </p>
                      )}
                    </div>
                  )}
  
                  {widok === 'strzelcy' && (
                    <ol className="divide-y divide-[color:var(--e-linia)]">
                      {strzelcy.slice(0, 10).map((w, i) => (
                        <li key={w.zawodnikId} className="flex items-center gap-[0.8em] py-[0.4em] text-[1.4em]">
                          <span className={`w-[1.4em] shrink-0 text-right font-bold tabular-nums ${i < 3 ? 'text-[color:var(--e-akcent)]' : 'text-[color:var(--e-tekst4)]'}`}>{i + 1}</span>
                          <span className="min-w-0 flex-1 truncate">
                            <span className="font-semibold">{w.imie}</span>
                            {w.druzynaNazwa && <span className="text-[color:var(--e-tekst3)]"> · {w.druzynaNazwa}</span>}
                          </span>
                          <span className="shrink-0 font-display text-[1.2em] font-bold tabular-nums">{w.gole}</span>
                        </li>
                      ))}
                    </ol>
                  )}
  
                  {widok === 'final' && (
                    <div className="divide-y divide-[color:var(--e-linia)]">
                      {meczeFinalu.slice(0, 10).map((m) => {
                        const wynik = m.status === 'zakonczony' || m.status === 'walkower' || m.status === 'trwa';
                        return (
                          <div key={m.id} className="flex items-center gap-[0.8em] py-[0.45em] text-[1.4em]">
                            <span className="w-[3.2em] shrink-0 font-bold tabular-nums">{godzina(m)}</span>
                            <span className="min-w-0 flex-1">
                              {!finalowa && <span className="block text-[0.65em] uppercase tracking-wide text-[color:var(--e-tekst4)]">{etykietaFazyMeczu(m, grupyPoId)}</span>}
                              <span className="block truncate">{nazwa(m, 'a')} <span className="text-[color:var(--e-tekst4)]">–</span> {nazwa(m, 'b')}</span>
                            </span>
                            {wynik && (
                              <span className={`shrink-0 font-display font-bold tabular-nums ${m.status === 'trwa' ? 'text-[color:var(--e-akcent)]' : ''}`}>
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
      )}

      {/* STEROWANIE UKŁADEM: chwilę po ruchu myszy albo dotknięciu. */}
      <nav
        aria-label="Układ ekranu"
        className={`fixed bottom-[1em] left-1/2 flex -translate-x-1/2 gap-[0.3em] rounded-full bg-[color:var(--e-panel)] p-[0.35em] shadow-2xl ring-1 ring-[color:var(--e-linia)] transition-opacity duration-300 ${
          sterowanie ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        {UKLADY_EKRANU.map((u) => (
          <button
            key={u.klucz}
            type="button"
            onClick={() => zmienUklad(u.klucz)}
            aria-pressed={uklad === u.klucz}
            className={`whitespace-nowrap rounded-full px-[0.9em] py-[0.45em] text-[1.05em] font-semibold ${
              uklad === u.klucz ? 'bg-[color:var(--e-aktywny)] text-[color:var(--e-aktywny-tekst)]' : 'text-[color:var(--e-tekst2)] hover:bg-[color:var(--e-karta)]'
            }`}
          >
            {u.etykieta}
          </button>
        ))}
        <button
          type="button"
          onClick={() => zmienMotyw(motyw === 'ciemny' ? 'jasny' : 'ciemny')}
          aria-label={motyw === 'ciemny' ? 'Jasny motyw' : 'Ciemny motyw'}
          title={motyw === 'ciemny' ? 'Jasny motyw' : 'Ciemny motyw'}
          className="ml-[0.4em] rounded-full px-[0.8em] py-[0.45em] text-[color:var(--e-tekst2)] hover:bg-[color:var(--e-karta)]"
        >
          {motyw === 'ciemny' ? <Sun className="h-[1.3em] w-[1.3em]" /> : <Moon className="h-[1.3em] w-[1.3em]" />}
        </button>
      </nav>
    </Tlo>
  );
}

// MOTYW EKRANU (2026-11-21): ciemny domyślnie (rzutnik w ciemnej hali),
// jasny na telewizor w jasnej sali albo do druku zrzutu. Kolory jako zmienne
// CSS, a klasy ekranu czytają je (`text-[color:var(--e-tekst)]`): jeden
// zestaw klas, dwie palety. Zielony z palety Bojo w obu.
const PALETY: Record<MotywEkranu, Record<string, string>> = {
  ciemny: {
    '--e-tlo': '#020617', '--e-tekst': '#ffffff', '--e-tekst2': '#cbd5e1', '--e-tekst3': '#94a3b8', '--e-tekst4': '#64748b',
    '--e-karta': 'rgba(255,255,255,0.06)', '--e-linia': 'rgba(255,255,255,0.12)', '--e-panel': 'rgba(30,41,59,0.95)',
    '--e-akcent': '#7dd8a8', '--e-zywo-ramka': '#22a361', '--e-zywo-tlo': 'rgba(6,29,18,0.6)', '--e-uwaga': '#fcd34d',
    '--e-aktywny': '#ffffff', '--e-aktywny-tekst': '#020617', '--e-komunikat': 'rgba(34,163,97,0.18)',
  },
  jasny: {
    '--e-tlo': '#f8fafc', '--e-tekst': '#0f172a', '--e-tekst2': '#334155', '--e-tekst3': '#475569', '--e-tekst4': '#64748b',
    '--e-karta': '#ffffff', '--e-linia': '#e2e8f0', '--e-panel': 'rgba(255,255,255,0.97)',
    '--e-akcent': '#15663E', '--e-zywo-ramka': '#15803d', '--e-zywo-tlo': '#f0fdf5', '--e-uwaga': '#b45309',
    '--e-aktywny': '#0f172a', '--e-aktywny-tekst': '#ffffff', '--e-komunikat': '#d8f5e4',
  },
};

/** Tło na cały ekran w wybranym motywie; rozmiar pisma liczony z szerokości okna. */
// SCENA 16:9 (2026-11-22, zgłoszenie właściciela): ekran ma wyglądać jak na
// komputerze na KAŻDYM urządzeniu. Telefon w pionie dostawał układ ściśnięty
// do wąskiej kolumny (nazwy drużyn po słowie w linii, ucięte kolejne mecze).
// Teraz scena ma zawsze proporcje 16:9 i mieści się w oknie (pasy nad i pod
// albo po bokach), a pismo liczy się z szerokości SCENY, nie okna: na
// telefonie to ten sam widok w mniejszej skali, po obróceniu na cały ekran.
const SZEROKOSC_SCENY = 'min(100vw, calc(100dvh * 16 / 9))';

function Tlo({ children, motyw }: { children: React.ReactNode; motyw: MotywEkranu }) {
  return (
    <div
      className="flex h-[100dvh] w-full items-center justify-center overflow-hidden bg-[color:var(--e-tlo)] text-[color:var(--e-tekst)]"
      style={PALETY[motyw] as React.CSSProperties}
    >
      <div
        className="flex flex-col overflow-hidden"
        style={{
          width: SZEROKOSC_SCENY,
          aspectRatio: '16 / 9',
          fontSize: `calc(${SZEROKOSC_SCENY} * 0.0105)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
