'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Copy, Download, Plus, Check, X as XIcon, Trash2, Ban, ChevronRight } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import CoverUpload from '@/components/ui/CoverUpload';
import PanelGaleria from '@/components/turnieje/PanelGaleria';
import PanelSponsorzy from '@/components/turnieje/PanelSponsorzy';
import PanelProsbaOWyglad from '@/components/turnieje/PanelProsbaOWyglad';
import KartaMeczu from '@/components/turnieje/KartaMeczu';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { usePotwierdzenie } from '@/lib/usePotwierdzenie';
import { blikPhoneDigits, formatBlikPhone } from '@/lib/payments';
import {
  getTurniej, uprawnieniaTurnieju, getOsobyTurnieju, czyTurniejProbny, utworzProbeTurnieju,
  updateTurniej, setStatusTurnieju, deleteTurniej,
  getBlikTurnieju, ustawBlikTurnieju, setOkladkaTurnieju,
} from '@/lib/turnieje';
import {
  getDruzynyZeSkladem, setStatusDruzyny, dodajDruzyneRecznie, getKontakty, usunDruzyne,
  ustawGrupeDruzyny, setWpisowe,
} from '@/lib/turniejDruzyny';
import {
  getGrupy, dodajGrupe, usunGrupe, getAreny, dodajArene, zmienNazweAreny, usunArene,
  getMecze, zapiszTerminarz,
} from '@/lib/turniejMecze';
import {
  domyslnaLiczbaGrup, rozlosujGrupy, meczeKazdyZKazdym, zbudujDrabinke, ulozHarmonogram,
  zamienDruzynyWDrabince, type MiejsceWDrabince,
  szacunekCzasu, type NowyMecz,
} from '@/lib/turniejFormat';
import { odmienZawodnikow, odmienDruzyny, etykietaTerminu, FORMAT_LABEL } from '@/lib/turniejEtykiety';
import {
  pulpitPrzedTurniejem, postepTurnieju, meczeDoWpisania, mozeRozpoczacTurniej,
} from '@/lib/turniejPulpit';
import { plural, withCount } from '@/lib/plural';
import type { Turniej, TurniejDruzyna, TurniejOsoba, TurniejGrupa, TurniejArena, TurniejMecz } from '@/types';
import type { KontaktDruzyny } from '@/lib/turniejDruzyny';
import { czyWolnyLos } from '@/lib/turniejWynik';
import ZasadyGry, { type WartosciZasad } from '@/components/turnieje/ZasadyGry';
import SegmentedToggle from '@/components/ui/SegmentedToggle';
import type { TurniejCreate } from '@/types';

// Bez zakładki „Ludzie” (decyzja właściciela z 2026-11-08): na start jedna
// rola, organizator. Uprawnienia współorganizatorów zostają w bazie
// (`turniej_osoby`, 145), gdyby sędzia albo inna rola wróciła później.
type PanelTab = 'pulpit' | 'druzyny' | 'terminarz' | 'ustawienia';

// Etykiety, nie surowe klucze z CSS-owym `capitalize`. Tamto wypisywało
// `Druzyny` bez ogonka, bo klucz jest bez polskich znaków (i musi być, bo
// idzie do adresu jako `?tab=`). Zgłoszone z testu na żywo.
const ETYKIETY_PANELU: Record<PanelTab, string> = {
  pulpit: 'Pulpit',
  druzyny: 'Drużyny',
  terminarz: 'Terminarz',
  ustawienia: 'Ustawienia',
};

const LITERY_GRUP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const inputCls =
  'w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-700 dark:text-slate-100';

function toCsv(kontakty: KontaktDruzyny[]): string {
  const naglowek = 'Drużyna,Kapitan,Telefon,E-mail,Wpisowe opłacone\n';
  const wiersze = kontakty.map((k) => [
    k.druzyna, k.kapitan ?? '', k.telefon ?? '', k.email ?? '', k.oplacone ? 'tak' : 'nie',
  ].map((v) => `"${v.replace(/"/g, '""')}"`).join(','));
  return naglowek + wiersze.join('\n');
}

export default function PanelClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { potwierdz, oknoPotwierdzenia } = usePotwierdzenie();

  const [turniej, setTurniej] = useState<Turniej | null>(null);
  const [druzyny, setDruzyny] = useState<TurniejDruzyna[]>([]);
  const [osoby, setOsoby] = useState<TurniejOsoba[]>([]);
  const [grupy, setGrupy] = useState<TurniejGrupa[]>([]);
  const [areny, setAreny] = useState<TurniejArena[]>([]);
  const [mecze, setMecze] = useState<TurniejMecz[]>([]);
  const [ladowanie, setLadowanie] = useState(true);
  const [nowaNazwa, setNowaNazwa] = useState('');
  const [nowaArenaNazwa, setNowaArenaNazwa] = useState('');
  const [liczbaGrupWybor, setLiczbaGrupWybor] = useState<number | null>(null);
  const [podglad, setPodglad] = useState<NowyMecz[] | null>(null);
  // Pierwsza dotknięta drużyna przy ręcznej zamianie par w drabince.
  const [doZamiany, setDoZamiany] = useState<MiejsceWDrabince | null>(null);
  const [blikTelefon, setBlikTelefon] = useState<string | null>(null);
  const [blikWpis, setBlikWpis] = useState('');
  // Zasady gry w trakcie edycji; `null` = pokaż to, co jest w bazie.
  const [zasadyEdycja, setZasadyEdycja] = useState<WartosciZasad | null>(null);

  const tabParam = searchParams.get('tab');
  // Domyślnie PULPIT, nie „Drużyny": organizator wchodzi w panel z pytaniem
  // „jak mi idzie" (przed turniejem) albo „co się dzieje" (w jego dniu),
  // a nie po to, żeby przeczytać listę drużyn.
  const zakladka: PanelTab =
    tabParam === 'druzyny' ? 'druzyny'
      : tabParam === 'ustawienia' ? 'ustawienia'
      : tabParam === 'terminarz' ? 'terminarz'
      : 'pulpit';

  const wczytaj = async () => {
    const [t, d, o, g, a, m] = await Promise.all([
      getTurniej(id), getDruzynyZeSkladem(id), getOsobyTurnieju(id), getGrupy(id), getAreny(id), getMecze(id),
    ]);
    setTurniej(t);
    setDruzyny(d);
    setOsoby(o);
    setGrupy(g);
    setAreny(a);
    setMecze(m);
    if (t && t.wpisoweGrosze > 0) {
      const tel = await getBlikTurnieju(id).catch(() => null);
      setBlikTelefon(tel);
      setBlikWpis(tel ? formatBlikPhone(tel) : '');
    }
  };

  useEffect(() => {
    let aktualne = true;
    setLadowanie(true);
    wczytaj().finally(() => { if (aktualne) setLadowanie(false); });
    return () => { aktualne = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const uprawnienia = useMemo(
    () => (turniej ? uprawnieniaTurnieju(turniej, osoby.find((o) => o.userId === user?.id) ?? null, user?.id) : null),
    [turniej, osoby, user],
  );

  if (authLoading || ladowanie) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header />
        <div className="flex-1 py-24 text-center text-sm text-slate-400">Ładuję…</div>
      </div>
    );
  }

  if (!user) {
    if (typeof window !== 'undefined') window.location.href = `/logowanie?next=${encodeURIComponent(`/turnieje/${id}/panel`)}`;
    return null;
  }

  if (!turniej) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header />
        <div className="flex-1 py-24 text-center text-sm text-slate-500">Nie znaleziono turnieju.</div>
      </div>
    );
  }

  if (!uprawnienia?.mozeEdytowac && !uprawnienia?.mozeZarzadzacDruzynami) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header />
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-16 text-center">
          <p className="font-medium text-ink">Ten panel jest dla organizatora turnieju</p>
          <Link href={`/turnieje/${id}`} className="mt-3 inline-block text-sm text-primary-600">Wróć do turnieju</Link>
        </main>
      </div>
    );
  }

  // Galeria, sponsorzy (migracja `159`) i prośba o inny wygląd (migracja
  // `162`) — w Ustawieniach, NIE jako osobna zakładka panelu: sześć nie
  // mieści się w szerokości telefonu (lekcja z 2026-09-17 na stronie
  // turnieju).
  const sekcjeMediow = (
    <>
      <PanelGaleria turniejId={id} userId={user.id} potwierdz={potwierdz} />
      <PanelSponsorzy turniejId={id} potwierdz={potwierdz} />
      <PanelProsbaOWyglad turniejId={id} />
    </>
  );

  /**
   * Każdy zapis ustawień kończy się komunikatem, sukcesem albo błędem.
   * Do 2026-11-08 pola zapisywały się po wyjściu z nich bez żadnego sygnału,
   * a błąd (np. CHECK w bazie) ginął w konsoli: organizator nie wiedział,
   * czy zmiana poszła.
   */
  const zapiszUstawienie = async (dane: Partial<TurniejCreate>) => {
    try {
      await updateTurniej(id, dane);
      await wczytaj();
      toast('Zapisano');
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się zapisać zmiany', 'error');
      return false;
    }
  };
  const zasadyTurnieju: WartosciZasad = {
    czasMeczuMin: turniej.czasMeczuMin,
    przerwaMin: turniej.przerwaMin,
    punktyZaWygrana: turniej.punktyZaWygrana,
    punktyZaRemis: turniej.punktyZaRemis,
    awansujeZGrupy: turniej.awansujeZGrupy,
    meczO3Miejsce: turniej.meczO3Miejsce,
  };

  const kopiuj = async (tekst: string, etykieta = 'Link') => {
    try { await navigator.clipboard.writeText(tekst); toast(`${etykieta} skopiowany`); }
    catch { toast('Nie udało się skopiować', 'error'); }
  };

  const przyjmij = async (d: TurniejDruzyna, status: TurniejDruzyna['status']) => {
    try { await setStatusDruzyny(d.id, status); await wczytaj(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Nie udało się zapisać', 'error'); }
  };

  const dodajRecznie = async () => {
    if (nowaNazwa.trim().length < 2) return;
    try {
      const druzynaId = await dodajDruzyneRecznie(id, nowaNazwa);
      setNowaNazwa('');
      await wczytaj();
      const nowa = (await getDruzynyZeSkladem(id)).find((d) => d.id === druzynaId);
      if (nowa) {
        toast(`Dodano ${nowa.nazwa}`);
        void kopiuj(`${window.location.origin}/t/${nowa.kodDolaczenia}`, 'Link drużyny');
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się dodać drużyny', 'error');
    }
  };

  const usunDruzyneZTurnieju = async (d: TurniejDruzyna) => {
    const wynik = await potwierdz({
      tytul: `Usunąć drużynę ${d.nazwa}?`,
      konsekwencje: [`Zniknie ${odmienZawodnikow(d.liczbaZawodnikow ?? 0)}`, 'Link drużyny przestanie działać', 'Tego nie da się cofnąć'],
      potwierdzLabel: 'Usuń drużynę',
      wariant: 'destrukcyjny',
    });
    if (wynik !== 'tak') return;
    try { await usunDruzyne(d.id); await wczytaj(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Nie udało się usunąć drużyny', 'error'); }
  };

  const pobierzKontaktyCsv = async () => {
    try {
      const kontakty = await getKontakty(id);
      const blob = new Blob([toCsv(kontakty)], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `kontakty-${turniej.nazwa}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się pobrać kontaktów', 'error');
    }
  };

  const przelaczOplacone = async (d: TurniejDruzyna) => {
    try {
      await setWpisowe(d.id, !d.wpisoweOplaconeAt);
      await wczytaj();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się zapisać wpisowego', 'error');
    }
  };

  const zapiszBlikAkcja = async () => {
    try {
      await ustawBlikTurnieju(id, blikPhoneDigits(blikWpis));
      setBlikTelefon(blikPhoneDigits(blikWpis));
      toast('Numer BLIK zapisany');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się zapisać numeru BLIK', 'error');
    }
  };

  const zamknijLubOtworzZapisy = async () => {
    const nowyStatus = turniej.status === 'zamkniete_zapisy' ? 'zapisy' : 'zamkniete_zapisy';
    try { await setStatusTurnieju(id, nowyStatus); await wczytaj(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Nie udało się zmienić stanu zapisów', 'error'); }
  };

  const odwolaj = async () => {
    const wynik = await potwierdz({
      tytul: 'Odwołać turniej?',
      konsekwencje: ['Wszyscy zawodnicy dostaną powiadomienie', 'Turniej zostaje w aplikacji jako odwołany'],
      potwierdzLabel: 'Odwołaj turniej',
      wariant: 'destrukcyjny',
    });
    if (wynik !== 'tak') return;
    try { await setStatusTurnieju(id, 'odwolany'); await wczytaj(); toast('Turniej odwołany'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Nie udało się odwołać turnieju', 'error'); }
  };

  const usunTurniej = async () => {
    const wynik = await potwierdz({
      tytul: 'Usunąć turniej?',
      konsekwencje: [
        `${plural(druzyny.length, 'Zniknie', 'Znikną', 'Zniknie')} ${withCount(druzyny.length, 'drużyna', 'drużyny', 'drużyn')} i cały skład`,
        'Linki do turnieju i drużyn przestaną działać',
        'Tego nie da się cofnąć',
      ],
      potwierdzLabel: 'Usuń turniej',
      wariant: 'destrukcyjny',
    });
    if (wynik !== 'tak') return;
    try { await deleteTurniej(id); toast('Turniej usunięty'); router.push('/turnieje'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Nie udało się usunąć turnieju', 'error'); }
  };

  const czekajace = druzyny.filter((d) => d.status === 'zgloszona');
  const wTurnieju = druzyny.filter((d) => d.status === 'przyjeta');
  // Rozegrany mecz zamyka drogę do układania terminarza od nowa: baza broni
  // wyniku (`zapisz_terminarz` odmawia), więc interfejs ma tego nie proponować.
  // Wolny los się nie liczy (migracja 171): wstawia go sam generator, nikt
  // w nim nie zagrał, a liczony dawał „Rozegrano już 2 mecze" przed startem.
  const rozegranych = mecze.filter(
    (m) => (m.status === 'zakonczony' || m.status === 'walkower' || m.status === 'trwa') && !czyWolnyLos(m),
  ).length;
  const rezerwa = druzyny.filter((d) => d.status === 'rezerwa');

  const potrzebujeGrup = turniej.format === 'grupy_puchar';
  const liczbaGrupDomyslna = domyslnaLiczbaGrup(wTurnieju.length);

  /** Przeniesienie drużyny do innej grupy po losowaniu (2026-11-08). */
  const przeniesDoGrupy = async (druzyna: TurniejDruzyna, grupaId: string) => {
    if (druzyna.grupaId === grupaId) return;
    try {
      await ustawGrupeDruzyny(druzyna.id, grupaId);
      setPodglad(null);
      await wczytaj();
      const g = grupy.find((x) => x.id === grupaId);
      toast(`${druzyna.nazwa} w grupie ${g?.nazwa ?? ''}`.trim());
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się przenieść drużyny', 'error');
    }
  };

  const losujGrupy = async (bezLosowania = false) => {
    const n = liczbaGrupWybor ?? liczbaGrupDomyslna;
    if (grupy.length > 0) {
      const wynik = await potwierdz({
        tytul: 'Wylosować grupy jeszcze raz?',
        konsekwencje: ['Obecny podział na grupy zniknie', 'Wygenerowany wcześniej terminarz trzeba będzie zrobić od nowa'],
        potwierdzLabel: 'Losuj ponownie',
      });
      if (wynik !== 'tak') return;
    }
    try {
      for (const g of grupy) await usunGrupe(g.id);
      // „Ustaw ręcznie" dzieli drużyny po kolei (bez losowania), a resztę
      // organizator przestawia wyborem grupy przy każdej drużynie.
      const podzial = bezLosowania
        ? Array.from({ length: Math.max(1, n) }, (_, i) => wTurnieju.filter((_, k) => k % Math.max(1, n) === i))
        : rozlosujGrupy(wTurnieju, n);
      for (let i = 0; i < podzial.length; i++) {
        const g = await dodajGrupe(id, LITERY_GRUP[i] ?? `G${i + 1}`);
        await Promise.all(podzial[i].map((d) => ustawGrupeDruzyny(d.id, g.id)));
      }
      setPodglad(null);
      await wczytaj();
      toast(bezLosowania ? 'Grupy utworzone, przestaw drużyny niżej' : 'Grupy wylosowane');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się wylosować grup', 'error');
    }
  };

  const generujPodglad = () => {
    if (wTurnieju.length < 2) { toast('Potrzeba co najmniej 2 przyjętych drużyn', 'error'); return; }
    try {
      zbudujPodglad();
    } catch (e) {
      // CISZA JEST TU NAJGORSZĄ ODPOWIEDZIĄ. Generator rzucał wyjątek wewnątrz
      // obsługi kliknięcia (nieprawidłowa godzina startu dawała `RangeError:
      // Invalid time value`), więc organizator klikał główny przycisk panelu
      // i nie działo się NIC: ani terminarz, ani komunikat. To jest moment,
      // w którym wraca do Excela.
      toast(e instanceof Error ? e.message : 'Nie udało się ułożyć terminarza.', 'error');
    }
  };

  const zbudujPodglad = () => {
    let nowe: NowyMecz[];
    if (turniej.format === 'liga') {
      nowe = meczeKazdyZKazdym(wTurnieju.map((d) => d.id), { startNumer: 1 });
    } else if (turniej.format === 'puchar') {
      const losowe = rozlosujGrupy(wTurnieju.map((d) => d.id), 1)[0];
      nowe = zbudujDrabinke(losowe, { startNumer: 1, meczO3Miejsce: turniej.meczO3Miejsce });
    } else {
      if (grupy.length === 0) { toast('Najpierw wylosuj grupy', 'error'); return; }
      let numer = 1;
      nowe = grupy.flatMap((g) => {
        const wGrupie = wTurnieju.filter((d) => d.grupaId === g.id).map((d) => d.id);
        const czesc = meczeKazdyZKazdym(wGrupie, { startNumer: numer, grupaId: g.id });
        numer += czesc.length;
        return czesc;
      });
    }
    const ulozone = ulozHarmonogram(nowe, {
      arenyId: areny.map((a) => a.id),
      startAt: `${turniej.dataStartu}T${turniej.godzinaStartu}:00`,
      czasMeczuMin: turniej.czasMeczuMin,
      przerwaMin: turniej.przerwaMin,
    });
    setPodglad(ulozone);
  };

  const rozpocznijGenerowanie = async () => {
    if (mecze.length > 0) {
      const wynik = await potwierdz({
        tytul: 'Wygenerować terminarz jeszcze raz?',
        konsekwencje: ['Obecny terminarz zniknie i zostanie zastąpiony nowym', 'To nie zadziała, jeśli którykolwiek mecz już się zaczął'],
        potwierdzLabel: 'Generuj od nowa',
      });
      if (wynik !== 'tak') return;
    }
    generujPodglad();
  };

  const zapiszPodgladTerminarza = async () => {
    if (!podglad) return;
    try {
      await zapiszTerminarz(id, podglad);
      setPodglad(null);
      await wczytaj();
      toast('Terminarz zapisany');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się zapisać terminarza', 'error');
    }
  };

  const dodajAreneAkcja = async () => {
    if (nowaArenaNazwa.trim().length < 1) return;
    try {
      await dodajArene(id, nowaArenaNazwa.trim(), areny.length + 1);
      setNowaArenaNazwa('');
      await wczytaj();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się dodać areny', 'error');
    }
  };

  const usunAreneAkcja = async (arenaId: string) => {
    try { await usunArene(arenaId); await wczytaj(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Nie udało się usunąć areny', 'error'); }
  };


  // ── Pulpit ───────────────────────────────────────────────────────────────
  const pozycjePulpitu = turniej
    ? pulpitPrzedTurniejem(turniej, druzyny, mecze, !!blikTelefon)
    : [];
  // STEROWANIE KLIKANIEM, NIE ZEGAREM (decyzja właściciela z 2026-11-08).
  // Godziny w terminarzu na amatorskim turnieju rozjeżdżają się od pierwszego
  // meczu, więc pulpit nie liczy już „opóźnienia". Turniej startuje, gdy
  // organizator kliknie „Rozpocznij turniej", a mecz kończy się, gdy ktoś
  // wpisze jego wynik.
  const postep = postepTurnieju(mecze);
  const doWpisania = meczeDoWpisania(mecze);
  const mozeRozpoczac = mozeRozpoczacTurniej(turniej, mecze);
  const nazwaDruzynyPanel = (druzynaId?: string) =>
    (druzynaId ? druzyny.find((d) => d.id === druzynaId)?.nazwa : undefined) ?? 'TBD';

  const rozpocznijTurniej = async () => {
    const wynik = await potwierdz({
      tytul: 'Rozpocząć turniej?',
      konsekwencje: [
        'Zapisy zostaną zamknięte',
        'Od teraz wpisujesz wyniki meczów',
        'Zawodnicy z kontami dostaną powiadomienie przed swoim kolejnym meczem',
      ],
      potwierdzLabel: 'Rozpocznij turniej',
    });
    if (wynik !== 'tak') return;
    try { await setStatusTurnieju(id, 'trwa'); await wczytaj(); toast('Turniej rozpoczęty'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Nie udało się rozpocząć turnieju', 'error'); }
  };

  const proba = czyTurniejProbny(turniej);

  const przetestuj = async () => {
    const wynik = await potwierdz({
      tytul: 'Przetestować dzień turnieju?',
      konsekwencje: [
        'Powstanie kopia z tym samym terminarzem, od razu „w trakcie”',
        'Wpisujesz w niej wyniki jak w dniu turnieju',
        'Prawdziwy turniej i zawodnicy nic nie zobaczą ani nie dostaną',
      ],
      potwierdzLabel: 'Przetestuj',
    });
    if (wynik !== 'tak') return;
    try {
      const kopia = await utworzProbeTurnieju(id);
      toast('Próba gotowa. Klikaj śmiało');
      router.push(`/turnieje/${kopia}/panel`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się przygotować próby', 'error');
    }
  };

  const zakonczProbe = async () => {
    const wynik = await potwierdz({
      tytul: 'Zakończyć próbę?',
      konsekwencje: ['Kopia turnieju i wpisane w niej wyniki znikną', 'Prawdziwy turniej zostaje bez zmian'],
      potwierdzLabel: 'Zakończ próbę',
      wariant: 'destrukcyjny',
    });
    if (wynik !== 'tak') return;
    try { await deleteTurniej(id); toast('Próba usunięta'); router.push('/turnieje'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Nie udało się usunąć próby', 'error'); }
  };

  const zakonczTurniej = async () => {
    const zostalo = postep.wszystkie - postep.rozegrane;
    const wynik = await potwierdz({
      tytul: 'Zakończyć turniej?',
      konsekwencje: zostalo > 0
        ? [`${withCount(zostalo, 'mecz zostaje', 'mecze zostają', 'meczów zostaje')} bez wyniku`, 'Turniej pokaże się jako zakończony']
        : ['Turniej pokaże się jako zakończony'],
      potwierdzLabel: 'Zakończ turniej',
    });
    if (wynik !== 'tak') return;
    try { await setStatusTurnieju(id, 'zakonczony'); await wczytaj(); toast('Turniej zakończony'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Nie udało się zakończyć turnieju', 'error'); }
  };

  const druzynyPoId = new Map(druzyny.map((d) => [d.id, d.nazwa]));
  const meczePoId = new Map(mecze.map((m) => [m.id, m]));
  const arenyPoId = new Map(areny.map((a) => [a.id, a.nazwa]));

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header />
      <div className="sticky top-0 z-10 border-b border-slate-100 dark:border-slate-700 bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <button onClick={() => router.push(`/turnieje/${id}`)} aria-label="Wróć" className="shrink-0 text-slate-500 hover:text-ink">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="min-w-0 flex-1 truncate font-display text-lg font-bold text-ink">Panel: {turniej.nazwa}</h1>
        </div>
        {/* Cień przy prawej krawędzi. Bez niego pasek kończył się uciętym
            „Us…" i nic nie mówiło, że da się go przesunąć, a za krawędzią
            siedzą Ustawienia: zamknięcie zapisów i odwołanie turnieju, czyli
            akcje pod presją czasu. `md:hidden`, bo od tabletu pasek mieści się
            w całości i cień kłamałby o istnieniu dalszej treści. */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-canvas to-transparent md:hidden" />
          <div className="mx-auto flex max-w-2xl gap-1 overflow-x-auto px-4 pb-2 scrollbar-hide">
          {(['pulpit', 'druzyny', 'terminarz', 'ustawienia'] as PanelTab[]).map((z) => (
            <button
              key={z}
              onClick={() => router.push(`/turnieje/${id}/panel?tab=${z}`)}
              className={[
                'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                zakladka === z ? 'bg-primary-100 text-primary-700' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800',
              ].join(' ')}
            >
              {ETYKIETY_PANELU[z]}
            </button>
          ))}
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-5 px-4 py-5">
        {zakladka === 'pulpit' && (
          <div className="space-y-4">
            {/* W DNIU TURNIEJU pulpit jest wieżą kontrolną: ile rozegrano
                i które mecze czekają na wynik. Do 2026-11-08 stało tu „o ile
                jesteśmy spóźnieni" z przyciskiem „Przesuń resztę", liczone
                z godzin terminarza. Wycofane decyzją właściciela: turniejem
                steruje klikanie, a godziny i tak rozjeżdżają się od pierwszego
                meczu. Ręczne „Przesuń od meczu" z zakładki Terminarz też wypadło: godziny
                są orientacyjne i niczego nie uruchamiają. */}
            {proba && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/40 p-4 space-y-2">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">To jest próba</p>
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  Wpisuj wyniki, zmieniaj, sprawdzaj drabinkę. Nic z tego nie trafia do prawdziwego
                  turnieju, a zawodnicy nie dostają powiadomień.
                </p>
                <Button variant="outline" onClick={zakonczProbe} className="w-full">Zakończ próbę i usuń kopię</Button>
              </div>
            )}
            {turniej.status === 'trwa' ? (
              <>
                <div className="rounded-2xl border border-primary-100 dark:border-primary-900 bg-primary-50/60 dark:bg-primary-950/30 p-4">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                    <span className="inline-block h-2 w-2 rounded-full bg-primary-600" /> Turniej trwa
                  </p>
                  <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                    Rozegrane {postep.rozegrane} z {withCount(postep.wszystkie, 'meczu', 'meczów', 'meczów')}.
                  </p>
                </div>

                {/* Lista meczów do wpisania zamiast „co na której arenie o której".
                    Organizator po gwizdku stuka w mecz, wpisuje wynik i wraca. */}
                {doWpisania.length > 0 && (
                  <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Wpisz wynik</p>
                    <ul className="mt-1 divide-y divide-slate-100 dark:divide-slate-700">
                      {doWpisania.map((m) => (
                        <li key={m.id}>
                          <button
                            onClick={() => router.push(`/turnieje/${id}/mecz/${m.id}`)}
                            className="flex min-h-[48px] w-full items-center gap-2 text-left"
                          >
                            <span className="shrink-0 font-mono text-xs text-slate-400">M{m.numer}</span>
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                              {m.status === 'trwa' && '▶ '}
                              {nazwaDruzynyPanel(m.druzynaAId)} – {nazwaDruzynyPanel(m.druzynaBId)}
                            </span>
                            {m.status === 'trwa' && (
                              <span className="shrink-0 font-mono text-base font-bold text-ink">{m.wynikA}:{m.wynikB}</span>
                            )}
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!proba && (
                  <Button variant="outline" onClick={zakonczTurniej} className="w-full">
                    Zakończ turniej
                  </Button>
                )}
              </>
            ) : (
              <>
                <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
                  <p className="mb-3 font-display text-base font-bold text-ink">
                    {etykietaTerminu(turniej.dataStartu, turniej.godzinaStartu)}
                  </p>
                  <ul className="space-y-2">
                    {pozycjePulpitu.map((poz) => (
                      <li key={poz.klucz}>
                        <button
                          onClick={() => poz.zakladka && router.push(`/turnieje/${id}/panel?tab=${poz.zakladka}`)}
                          className="flex w-full items-start gap-2 text-left"
                        >
                          <span className="shrink-0 text-sm">
                            {poz.stan === 'gotowe' ? '✓' : poz.stan === 'uwaga' ? '⚠' : '✗'}
                          </span>
                          <span className={`min-w-0 flex-1 text-sm ${
                            poz.stan === 'gotowe' ? 'text-slate-600 dark:text-slate-300' : 'text-ink'
                          }`}>
                            {poz.tekst}
                          </span>
                          {poz.zakladka && poz.stan !== 'gotowe' && (
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* „Przetestuj" OBOK „Rozpocznij" (decyzja właściciela
                    z 2026-11-08): widok dnia turnieju organizator ma zobaczyć
                    wcześniej, na kopii, a nie pierwszy raz w sobotę o 10:00. */}
                {mozeRozpoczac && (
                  <div className="flex gap-2">
                    <Button onClick={rozpocznijTurniej} className="flex-1">Rozpocznij turniej</Button>
                    <Button variant="outline" onClick={przetestuj} className="flex-1">Przetestuj</Button>
                  </div>
                )}
                {mozeRozpoczac && (
                  <p className="text-xs text-slate-500">
                    „Przetestuj” robi kopię z tym samym terminarzem. Wpiszesz w niej wyniki jak w dniu
                    turnieju, a prawdziwy turniej i zawodnicy niczego nie zobaczą.
                  </p>
                )}

              </>
            )}
          </div>
        )}

        {zakladka === 'druzyny' && (
          <div className="space-y-6">
            {czekajace.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-blue-700">Czekają na decyzję</h2>
                {czekajace.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/60 dark:bg-blue-950/30 p-3">
                    <span className="min-w-0 flex-1 truncate font-medium text-ink">{d.nazwa}</span>
                    {/* Z tekstem, nie samą ikoną. To akcja, która wysyła sygnał
                        do kapitana i wchodzi do terminarza, a „ptaszek obok
                        krzyżyka" każe zgadywać, który jest który — organizator
                        klika to w biegu, jedną ręką. Etykieta tylko dla czytnika
                        ekranu nie pomaga nikomu, kto patrzy. */}
                    <button onClick={() => przyjmij(d, 'przyjeta')} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary-600 px-2.5 py-1.5 text-xs font-medium text-white"><Check className="h-3.5 w-3.5" /> Przyjmij</button>
                    <button onClick={() => przyjmij(d, 'rezerwa')} className="shrink-0 rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-600">Rezerwa</button>
                    <button onClick={() => przyjmij(d, 'odrzucona')} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500"><XIcon className="h-3.5 w-3.5" /> Odrzuć</button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-500">W turnieju ({wTurnieju.length})</h2>
              {wTurnieju.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
                  {/* Nazwa prowadzi na ekran drużyny: tam organizator wpisuje
                      skład, wskazuje kapitana i wysyła link (2026-11-08). */}
                  <Link href={`/turnieje/${id}/druzyna/${d.id}`} className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{d.nazwa}</span>
                    <span className="block text-xs text-slate-400">
                      {odmienZawodnikow(d.liczbaZawodnikow ?? 0)} · {d.kapitanId ? 'ma kapitana' : 'bez kapitana'}
                    </span>
                  </Link>
                  {turniej.wpisoweGrosze > 0 && (
                    <button
                      onClick={() => przelaczOplacone(d)}
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${d.wpisoweOplaconeAt ? 'bg-primary-50 text-primary-700' : 'bg-slate-100 text-slate-500'}`}
                    >
                      {d.wpisoweOplaconeAt ? 'Opłacone ✓' : 'Nieopłacone'}
                    </button>
                  )}
                  {/* Podpisany przycisk zamiast samej ikonki. Ikona kopiowania
                      stała tuż obok krzyżyka usuwania: łatwo było trafić nie
                      w to, co trzeba. Usuwanie drużyny jest dalej tutaj, ale
                      z odstępem i z oknem potwierdzenia. */}
                  <button
                    onClick={() => kopiuj(`Dołącz do drużyny ${d.nazwa} w turnieju ${turniej.nazwa}: ${window.location.origin}/t/${d.kodDolaczenia}`, 'Link drużyny')}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-600 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300"
                  >
                    <Copy className="h-3.5 w-3.5" /> Link do drużyny
                  </button>
                  <button onClick={() => usunDruzyneZTurnieju(d)} className="ml-2 text-slate-400 hover:text-red-500" aria-label={`Usuń drużynę ${d.nazwa}`}><XIcon className="h-4 w-4" /></button>
                </div>
              ))}
              {wTurnieju.length === 0 && <p className="text-sm text-slate-400">Jeszcze nikogo.</p>}
            </div>

            {rezerwa.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-500">Rezerwa</h2>
                {rezerwa.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
                    <span className="min-w-0 flex-1 truncate text-ink">{d.nazwa}</span>
                    <button onClick={() => przyjmij(d, 'przyjeta')} className="text-xs font-medium text-primary-600">Przyjmij</button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 border-t border-slate-100 dark:border-slate-700 pt-4">
              <div className="flex gap-2">
                <input value={nowaNazwa} onChange={(e) => setNowaNazwa(e.target.value)} placeholder="Nazwa drużyny" className={inputCls} />
                <Button size="sm" onClick={dodajRecznie} disabled={nowaNazwa.trim().length < 2} className="shrink-0 inline-flex items-center gap-1.5">
                  <Plus className="h-4 w-4" /> Dodaj
                </Button>
              </div>
              <button onClick={pobierzKontaktyCsv} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">
                <Download className="h-4 w-4" /> Pobierz kontakty (CSV)
              </button>
            </div>
          </div>
        )}

        {zakladka === 'terminarz' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-500">Areny</h2>
              {areny.map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5">
                  <input
                    defaultValue={a.nazwa}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== a.nazwa) zmienNazweAreny(a.id, v).then(wczytaj);
                    }}
                    className={`${inputCls} py-1.5`}
                  />
                  <button onClick={() => usunAreneAkcja(a.id)} className="shrink-0 text-slate-400 hover:text-red-500" aria-label="Usuń arenę"><XIcon className="h-4 w-4" /></button>
                </div>
              ))}
              <div className="flex gap-2">
                <input value={nowaArenaNazwa} onChange={(e) => setNowaArenaNazwa(e.target.value)} placeholder="Nazwa nowej areny" className={inputCls} />
                <Button size="sm" onClick={dodajAreneAkcja} disabled={nowaArenaNazwa.trim().length < 1} className="shrink-0 inline-flex items-center gap-1.5">
                  <Plus className="h-4 w-4" /> Dodaj
                </Button>
              </div>
            </div>

            {potrzebujeGrup && (
              <div className="space-y-2 border-t border-slate-100 dark:border-slate-700 pt-4">
                <h2 className="text-sm font-semibold text-slate-500">Grupy</h2>
                {grupy.length === 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={liczbaGrupWybor ?? liczbaGrupDomyslna}
                      onChange={(e) => setLiczbaGrupWybor(e.target.value === '' ? null : Number(e.target.value))}
                      onBlur={() => setLiczbaGrupWybor((v) => (v ? Math.max(1, v) : null))}
                      className={`${inputCls} w-20`}
                    />
                    <Button size="sm" onClick={() => losujGrupy()} disabled={wTurnieju.length < 2}>Losuj grupy</Button>
                    <Button size="sm" variant="outline" onClick={() => losujGrupy(true)} disabled={wTurnieju.length < 2}>Ustaw ręcznie</Button>
                    {/* Szary znaczy w tej apce „ta droga jest zamknięta, nic
                        się nie zepsuło", ale bez podanego warunku czyta się to
                        jako „chyba nie działa". Organizator utyka właśnie tutaj,
                        bo to jedyny krok, którego nie zrobi w Excelu lepiej. */}
                    {wTurnieju.length < 2 && (
                      <p className="w-full text-xs text-slate-400">
                        Potrzebne co najmniej 2 przyjęte drużyny (masz {wTurnieju.length}).
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* EDYCJA PO LOSOWANIU (decyzja właściciela z 2026-11-08):
                        losowanie jest punktem wyjścia, organizator przestawia
                        drużyny wyborem grupy. Po pierwszym rozegranym meczu
                        wybór jest zablokowany, tak jak układanie terminarza. */}
                    {grupy.map((g) => {
                      const wGrupie = wTurnieju.filter((d) => d.grupaId === g.id);
                      return (
                        <div key={g.id} className="rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
                          <p className="text-xs font-semibold text-slate-400">Grupa {g.nazwa} · {odmienDruzyny(wGrupie.length)}</p>
                          {wGrupie.length === 0 && <p className="mt-1 text-sm text-slate-400">Pusta</p>}
                          <ul className="mt-1 space-y-1">
                            {wGrupie.map((d) => (
                              <li key={d.id} className="flex items-center gap-2">
                                <span className="min-w-0 flex-1 truncate text-sm text-ink">{d.nazwa}</span>
                                <select
                                  value={g.id}
                                  disabled={rozegranych > 0}
                                  onChange={(e) => przeniesDoGrupy(d, e.target.value)}
                                  aria-label={`Grupa drużyny ${d.nazwa}`}
                                  className="shrink-0 rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs dark:bg-slate-700 dark:text-slate-100"
                                >
                                  {grupy.map((x) => <option key={x.id} value={x.id}>Grupa {x.nazwa}</option>)}
                                </select>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                    {wTurnieju.some((d) => !d.grupaId) && (
                      <div className="rounded-xl border border-amber-100 bg-amber-50/60 dark:bg-amber-950/30 p-3">
                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Bez grupy</p>
                        <ul className="mt-1 space-y-1">
                          {wTurnieju.filter((d) => !d.grupaId).map((d) => (
                            <li key={d.id} className="flex items-center gap-2">
                              <span className="min-w-0 flex-1 truncate text-sm text-ink">{d.nazwa}</span>
                              <select
                                value=""
                                disabled={rozegranych > 0}
                                onChange={(e) => e.target.value && przeniesDoGrupy(d, e.target.value)}
                                aria-label={`Grupa drużyny ${d.nazwa}`}
                                className="shrink-0 rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs dark:bg-slate-700 dark:text-slate-100"
                              >
                                <option value="">Wybierz…</option>
                                {grupy.map((x) => <option key={x.id} value={x.id}>Grupa {x.nazwa}</option>)}
                              </select>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {mecze.length > 0 && rozegranych === 0 && (
                      <p className="text-xs text-slate-500">Po zmianie grup wygeneruj terminarz od nowa.</p>
                    )}
                    <button onClick={() => losujGrupy()} className="text-sm font-medium text-primary-600">Losuj ponownie</button>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3 border-t border-slate-100 dark:border-slate-700 pt-4">
              <h2 className="text-sm font-semibold text-slate-500">Terminarz</h2>

              {podglad ? (
                <div className="space-y-3">
                  {(() => {
                    const szac = szacunekCzasu(podglad, { liczbaAren: Math.max(1, areny.length), czasMeczuMin: turniej.czasMeczuMin, przerwaMin: turniej.przerwaMin });
                    return (
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {/* Bez słowa „fal". To pojęcie z wnętrza generatora:
                            organizator nie planuje fal, tylko chce wiedzieć,
                            ile meczów i jak długo to potrwa. */}
                        Podgląd: {withCount(szac.liczbaMeczow, 'mecz', 'mecze', 'meczów')} do rozegrania, ok. {szac.czasCalkowityMin} min grania.
                      </p>
                    );
                  })()}
                  <div className="space-y-2">
                    {podglad.some((m) => m.faza !== 'grupa' && m.faza !== 'liga' && !m.zrodloAMeczId && !m.zrodloBMeczId) && (
                      <p className="text-xs text-slate-500">
                        Chcesz inne pary? Dotknij dwóch drużyn w pierwszej rundzie, a zamienią się miejscami.
                      </p>
                    )}
                    {podglad.map((m) => {
                      const pierwszaRunda = m.faza !== 'grupa' && m.faza !== 'liga' && !m.zrodloAMeczId && !m.zrodloBMeczId;
                      const slot = (strona: 'a' | 'b') => {
                        const druzynaId = strona === 'a' ? m.druzynaAId : m.druzynaBId;
                        const zrodlo = strona === 'a' ? m.zrodloAMeczId : m.zrodloBMeczId;
                        const typ = strona === 'a' ? m.zrodloATyp : m.zrodloBTyp;
                        if (!druzynaId) {
                          const nr = zrodlo ? podglad.find((x) => x.id === zrodlo)?.numer : undefined;
                          return (
                            <span className="text-slate-400">
                              {zrodlo ? `${typ === 'przegrany' ? 'Przegrany' : 'Zwycięzca'} M${nr ?? '?'}` : 'wolny los'}
                            </span>
                          );
                        }
                        const nazwa = druzynyPoId.get(druzynaId) ?? '-';
                        if (!pierwszaRunda) return <span className="text-ink">{nazwa}</span>;
                        const zaznaczona = doZamiany?.meczId === m.id && doZamiany.strona === strona;
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              if (!doZamiany) { setDoZamiany({ meczId: m.id, strona }); return; }
                              if (zaznaczona) { setDoZamiany(null); return; }
                              setPodglad((p) => (p ? zamienDruzynyWDrabince(p, doZamiany, { meczId: m.id, strona }) : p));
                              setDoZamiany(null);
                            }}
                            className={`rounded-md px-1.5 py-0.5 font-medium ${zaznaczona ? 'bg-primary-600 text-white' : 'text-ink underline decoration-dotted underline-offset-4'}`}
                          >
                            {nazwa}
                          </button>
                        );
                      };
                      return (
                      <div key={m.id} className="rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm">
                        <span className="text-xs text-slate-400">M{m.numer}</span>{' '}
                        {slot('a')}
                        {' vs '}
                        {slot('b')}
                        {m.zaplanowanyAt && (
                          /* `toLocaleString` dawało „24.10.2026, 10:00:00”:
                             sekundy w terminarzu nic nie znaczą, a data
                             cyfrowa czyta się gorzej niż słowna. Ten sam
                             zapis co wszędzie indziej w aplikacji. */
                          <span className="ml-2 text-xs text-slate-400">
                            {etykietaTerminu(m.zaplanowanyAt.slice(0, 10), m.zaplanowanyAt.slice(11, 16))}
                          </span>
                        )}
                      </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => { setDoZamiany(null); zapiszPodgladTerminarza(); }}>Zapisz terminarz</Button>
                    <Button size="sm" variant="outline" onClick={() => { setDoZamiany(null); setPodglad(null); }}>Anuluj</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {/* Po pierwszym ROZEGRANYM meczu generowanie od nowa jest
                      wyłączone, a nie tylko ostrzegane. Wcześniej przycisk był
                      aktywny, okno uprzedzało „to nie zadziała, jeśli…", a po
                      kliknięciu serwer słusznie odmawiał. Przycisk, który
                      zapowiada własną porażkę, wygląda na prowizorkę, a do tego
                      każe organizatorowi zgadywać, czy „nie zadziała" znaczy
                      „stracę wyniki". */}
                  <Button
                    size="sm"
                    onClick={rozpocznijGenerowanie}
                    disabled={wTurnieju.length < 2 || rozegranych > 0}
                  >
                    {mecze.length > 0 ? 'Wygeneruj terminarz od nowa' : 'Wygeneruj terminarz'}
                  </Button>
                  {rozegranych > 0 && (
                    <p className="text-xs text-slate-400">
                      Rozegrano już {withCount(rozegranych, 'mecz', 'mecze', 'meczów')}, więc terminarz da się
                      tylko przesuwać, nie układać od nowa.
                    </p>
                  )}
                  {wTurnieju.length < 2 && (
                    <p className="text-xs text-slate-400">
                      Potrzebne co najmniej 2 przyjęte drużyny (masz {wTurnieju.length}).
                    </p>
                  )}
                  {wTurnieju.length >= 2 && areny.length === 0 && (
                    <p className="text-xs text-slate-400">Dodaj przynajmniej jedną arenę, inaczej nie ma na czym ułożyć meczów.</p>
                  )}
                </div>
              )}

              {mecze.length > 0 && !podglad && (
                <div className="space-y-2 pt-2">
                  {mecze.map((m) => (
                    <KartaMeczu
                      key={m.id}
                      mecz={m}
                      druzynyPoId={druzynyPoId}
                      meczePoId={meczePoId}
                      arenyPoId={arenyPoId}
                      przygaszona={czyWolnyLos(m)}
                      onClick={() => router.push(`/turnieje/${id}/mecz/${m.id}`)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {zakladka === 'ustawienia' && uprawnienia?.jestOrganizatorem && (
          <div className="space-y-5">
            {/* Ta zakładka edytuje publiczną stronę turnieju (zakładka Info)
                razem z ustawieniami operacyjnymi (BLIK, zapisy) w jednym
                miejscu — świadomie, patrz komentarz przy `sekcjeMediow`
                niżej. Zdanie tutaj orientuje, dokąd się trafiło: kliknięcie
                „+ Dodaj zdjęcia" na Info otwiera WSZYSTKO poniżej, nie samą
                galerię, i bez tego zdania to zaskakuje. */}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tu edytujesz publiczną stronę turnieju (nazwę, zdjęcia, sponsorów i inne
              elementy, które widzi każdy na zakładce Info) oraz ustawienia zapisów.
            </p>

            {/* Okładka: miniatura na liście `/turnieje` i (od 2026-11-08)
                szeroki baner na górze strony turnieju. */}
            <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
              <h2 className="mb-3 text-sm font-semibold text-ink">Okładka</h2>
              <div className="relative h-28 overflow-hidden rounded-xl bg-gradient-to-br from-primary-700 to-primary-900">
                {turniej.okladkaUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={turniej.okladkaUrl} alt="" className="h-full w-full object-cover" />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <CoverUpload
                    currentUrl={turniej.okladkaUrl}
                    path={`turnieje/${id}/cover`}
                    onSaved={async (url) => {
                      try {
                        await setOkladkaTurnieju(id, url ?? null);
                        setTurniej((t) => (t ? { ...t, okladkaUrl: url ?? undefined } : t));
                      } catch { toast('Nie udało się zapisać okładki', 'error'); }
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Nazwa turnieju</label>
              <input
                defaultValue={turniej.nazwa}
                onBlur={(e) => { if (e.target.value.trim() !== turniej.nazwa) zapiszUstawienie({ nazwa: e.target.value }); }}
                className={inputCls}
              />
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Opis</label>
              <textarea
                defaultValue={turniej.opis ?? ''}
                onBlur={(e) => { if (e.target.value !== (turniej.opis ?? '')) zapiszUstawienie({ opis: e.target.value }); }}
                rows={3}
                className={inputCls}
              />
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Regulamin</label>
              <textarea
                defaultValue={turniej.regulamin ?? ''}
                onBlur={(e) => { if (e.target.value !== (turniej.regulamin ?? '')) zapiszUstawienie({ regulamin: e.target.value }); }}
                rows={3}
                className={inputCls}
              />
            </div>

            {/* TERMIN, MIEJSCE I DRUŻYNY. Do 2026-11-08 po utworzeniu turnieju
                nie dało się zmienić żadnej z tych rzeczy: „jednak start o 9:00"
                kończyło się kasowaniem turnieju. Format zmienia się tylko przed
                pierwszym terminarzem, bo od niego zależy układ meczów. */}
            <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
              <h2 className="text-sm font-semibold text-ink">Termin, miejsce i drużyny</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Data startu</label>
                  <input
                    type="date"
                    defaultValue={turniej.dataStartu}
                    onBlur={(e) => { if (e.target.value && e.target.value !== turniej.dataStartu) zapiszUstawienie({ dataStartu: e.target.value }); }}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Godzina startu</label>
                  <input
                    type="time"
                    defaultValue={(turniej.godzinaStartu ?? '').slice(0, 5)}
                    onBlur={(e) => { if (e.target.value && e.target.value !== (turniej.godzinaStartu ?? '').slice(0, 5)) zapiszUstawienie({ godzinaStartu: e.target.value }); }}
                    className={inputCls}
                  />
                </div>
              </div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Miejsce</label>
              <input
                defaultValue={turniej.miejsceNazwa ?? ''}
                maxLength={80}
                onBlur={(e) => { if (e.target.value.trim() !== (turniej.miejsceNazwa ?? '')) zapiszUstawienie({ miejsceNazwa: e.target.value }); }}
                className={inputCls}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Ile drużyn najwyżej</label>
                  <input
                    type="number" min={2} max={64}
                    defaultValue={turniej.maxDruzyn}
                    onBlur={(e) => {
                      const n = Math.min(64, Math.max(2, Number(e.target.value) || 2));
                      if (n !== turniej.maxDruzyn) zapiszUstawienie({ maxDruzyn: n });
                    }}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Zawodników w drużynie</label>
                  <input
                    type="number" min={1} max={40}
                    defaultValue={turniej.maxZawodnikow}
                    onBlur={(e) => {
                      const n = Math.min(40, Math.max(1, Number(e.target.value) || 1));
                      // Minimalny skład wypadł z modułu; wysyłamy 1, żeby CHECK
                      // `min <= max` (145) nie odrzucił małego składu w starym turnieju.
                      if (n !== turniej.maxZawodnikow) zapiszUstawienie({ maxZawodnikow: n, minZawodnikow: 1 });
                    }}
                    className={inputCls}
                  />
                </div>
              </div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Wpisowe za drużynę (zł)</label>
              <input
                type="text" inputMode="decimal"
                defaultValue={turniej.wpisoweGrosze > 0 ? String(turniej.wpisoweGrosze / 100) : ''}
                placeholder="0"
                onBlur={(e) => {
                  const grosze = Math.max(0, Math.round((parseFloat(e.target.value.replace(',', '.')) || 0) * 100));
                  if (grosze !== turniej.wpisoweGrosze) zapiszUstawienie({ wpisoweGrosze: grosze });
                }}
                className={inputCls}
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Format</label>
                <select
                  value={turniej.format}
                  disabled={mecze.length > 0}
                  onChange={(e) => zapiszUstawienie({ format: e.target.value as Turniej['format'] })}
                  className={inputCls}
                >
                  {(['grupy_puchar', 'puchar', 'liga'] as const).map((f) => (
                    <option key={f} value={f}>{FORMAT_LABEL[f]}</option>
                  ))}
                </select>
                {mecze.length > 0 && (
                  <p className="mt-1 text-xs text-slate-500">Format zmienisz po usunięciu terminarza (Terminarz → Wygeneruj od nowa).</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Kto widzi turniej</label>
                <SegmentedToggle
                  value={turniej.widocznosc}
                  onChange={(v) => zapiszUstawienie({ widocznosc: v })}
                  ariaLabel="Widoczność turnieju"
                  options={[
                    { value: 'publiczny', label: 'Na liście turniejów' },
                    { value: 'na_link', label: 'Tylko z linku' },
                  ]}
                />
                <p className="mt-1 text-xs text-slate-500">
                  „Tylko z linku": turnieju nie ma na liście w Bojo, ale każdy, kto dostanie link, go zobaczy.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
              <h2 className="text-sm font-semibold text-ink">Zasady gry</h2>
              <ZasadyGry
                format={turniej.format}
                wartosci={zasadyEdycja ?? zasadyTurnieju}
                onChange={(z) => setZasadyEdycja((w) => ({ ...(w ?? zasadyTurnieju), ...z }))}
                onZatwierdz={async (z) => {
                  const klucz = Object.keys(z)[0] as keyof WartosciZasad;
                  if (zasadyTurnieju[klucz] === z[klucz]) return;
                  if (await zapiszUstawienie(z)) setZasadyEdycja(null);
                }}
              />
              <p className="text-xs text-slate-500">Czas meczu i przerwa liczą orientacyjne godziny w terminarzu. Niczego nie uruchamiają same.</p>
            </div>

            {turniej.wpisoweGrosze > 0 && (
              <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Numer BLIK do wpisowego {blikTelefon && <span className="font-normal text-primary-700">(zapisany)</span>}
                </label>
                <div className="flex gap-2">
                  <input
                    value={blikWpis}
                    onChange={(e) => setBlikWpis(formatBlikPhone(e.target.value))}
                    placeholder="500 600 700"
                    className={inputCls}
                  />
                  <Button size="sm" onClick={zapiszBlikAkcja} disabled={blikPhoneDigits(blikWpis).length !== 9} className="shrink-0">
                    Zapisz
                  </Button>
                </div>
                <p className="text-xs text-slate-400">Zobaczą go kapitanowie zgłoszonych drużyn.</p>
              </div>
            )}

            {sekcjeMediow}

            <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
              {/* Termin graniczny obok ręcznego zamknięcia, nie zamiast niego:
                  data pilnuje zapisów, gdy organizator o nich zapomni, a
                  przycisk zamyka je wcześniej, gdy komplet zbierze się szybciej. */}
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Zapisy do</label>
              <input
                type="date"
                defaultValue={turniej.zapisyDo ? turniej.zapisyDo.slice(0, 10) : ''}
                max={turniej.dataStartu}
                onBlur={(e) => {
                  const nowa = e.target.value ? `${e.target.value}T23:59:59` : '';
                  if ((turniej.zapisyDo ?? '').slice(0, 10) === e.target.value) return;
                  zapiszUstawienie({ zapisyDo: nowa });
                }}
                className={inputCls}
              />
              <p className="text-xs text-slate-400">
                Po tym dniu nikt nie zgłosi drużyny. Puste = zapisy zamykasz ręcznie.
              </p>

              <Button variant="outline" onClick={zamknijLubOtworzZapisy} className="w-full">
                {turniej.status === 'zamkniete_zapisy' ? 'Otwórz zapisy' : 'Zamknij zapisy'}
              </Button>
              <div className="flex items-center justify-between gap-3 pt-1">
                {turniej.status !== 'odwolany' && (
                  <button onClick={odwolaj} className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-red-600">
                    <Ban className="h-3.5 w-3.5" /> Odwołaj turniej
                  </button>
                )}
                <button onClick={usunTurniej} className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" /> Usuń turniej
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Współorganizator z `moze_edytowac` nie widzi reszty Ustawień
            (te zostają przy organizatorze), ale galerią i sponsorami
            zarządzać może — pozwala mu na to RLS z migracji `159`
            (`czy_zarzadza_turniejem()`), więc interfejs nie może być
            węższy niż baza. */}
        {zakladka === 'ustawienia' && !uprawnienia?.jestOrganizatorem && uprawnienia?.mozeEdytowac && (
          <div className="space-y-5">{sekcjeMediow}</div>
        )}
      </main>
      {oknoPotwierdzenia}
    </div>
  );
}
