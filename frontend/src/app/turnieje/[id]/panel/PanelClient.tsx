'use client';

import { tabeleGrupTurnieju, maRemisWTabeli } from '@/lib/turniejTabela';
import { useAdmin } from '@/lib/admin';
import { useAdres, useAdresWPasku } from '@/lib/useAdres';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download, Plus, Check, X as XIcon, Trash2, Ban, ChevronRight } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import CoverUpload from '@/components/ui/CoverUpload';
import PanelGaleria from '@/components/turnieje/PanelGaleria';
import PanelSponsorzy from '@/components/turnieje/PanelSponsorzy';
import PanelProsbaOWyglad from '@/components/turnieje/PanelProsbaOWyglad';
import KartaMeczu from '@/components/turnieje/KartaMeczu';
import CentrumTurnieju from '@/components/turnieje/CentrumTurnieju';
import WyborEkranu from '@/components/turnieje/WyborEkranu';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { usePotwierdzenie } from '@/lib/usePotwierdzenie';
import { blikPhoneDigits, formatBlikPhone } from '@/lib/payments';
import {
  getTurniej, uprawnieniaTurnieju, getOsobyTurnieju, czyTurniejProbny, utworzProbeTurnieju,
  dodajWspolorganizatora, usunOsobeTurnieju,
  updateTurniej, setStatusTurnieju, deleteTurniej,
  getBlikTurnieju, ustawBlikTurnieju, setOkladkaTurnieju,
} from '@/lib/turnieje';
import {
  getDruzynyZeSkladem, setStatusDruzyny, dodajDruzyneRecznie, getKontakty, usunDruzyne,
  ustawGrupeDruzyny, setWpisowe, przygotujLinkiKapitanow, tekstLinkowKapitanow, type LinkKapitana,
} from '@/lib/turniejDruzyny';
import {
  getGrupy, dodajGrupe, usunGrupe, getAreny, dodajArene, zmienNazweAreny, usunArene,
  ustawKolejnoscGrupy, ustawKomentarzGrupy,
  getMecze, zapiszTerminarz, updateMecz, rozpocznijMecz, dodajZdarzenie, zakonczMecz, cofnijOstatnieZdarzenie,
  getPrzerwy, dodajPrzerwe, zmienPrzerwe, usunPrzerwe,
} from '@/lib/turniejMecze';
import WierszPrzerwy from '@/components/turnieje/WierszPrzerwy';
import {
  domyslnaLiczbaGrup, rozlosujGrupy, meczeKazdyZKazdym, zbudujDrabinke, ulozHarmonogram,
  zamienDruzynyWDrabince, type MiejsceWDrabince,
  szacunekCzasu, type NowyMecz, drabinkaZGrup, grupaFinalowaZGrup, nazwaMiejscaWGrupie,
} from '@/lib/turniejFormat';
import {
  odmienZawodnikow, odmienDruzyny, etykietaTerminu, FORMAT_LABEL, etykietaTerminuMeczu, porownajTermin, terminarzZPrzerwami,
  meczeNachodzaceNaPrzerwe, przesuniecieZaPrzerwe,
} from '@/lib/turniejEtykiety';
import {
  pulpitPrzedTurniejem, postepTurnieju, mozeRozpoczacTurniej, centrumTurnieju,
} from '@/lib/turniejPulpit';
import { tabeleTurnieju } from '@/lib/turniejTabela';
import { minutaMeczu } from '@/lib/zegarMeczu';
import { plural, withCount } from '@/lib/plural';
import type { Turniej, TurniejDruzyna, TurniejOsoba, TurniejGrupa, TurniejArena, TurniejMecz, TurniejPrzerwa } from '@/types';
import type { KontaktDruzyny } from '@/lib/turniejDruzyny';
import { czyWolnyLos } from '@/lib/turniejWynik';
import { instantZCzasuPolskiego, chwilaWPolsce } from '@/lib/czasPolski';
import ZasadyGry, { type WartosciZasad } from '@/components/turnieje/ZasadyGry';
import SegmentedToggle from '@/components/ui/SegmentedToggle';
import type { TurniejCreate } from '@/types';

// Bez zakładki „Ludzie” (decyzja właściciela z 2026-11-08): na start jedna
// rola, organizator. Uprawnienia współorganizatorów zostają w bazie
// (`turniej_osoby`, 145), gdyby sędzia albo inna rola wróciła później.
// Bez „Pulpitu” od 2026-11-20 (decyzja właściciela): widok terminarza mówi
// organizatorowi więcej niż osobny pulpit, więc stan turnieju, „Rozpocznij”
// i „Przetestuj” stoją nad terminarzem. Podział na grupy siedzi w „Drużynach”
// (przełącznik grupy przy każdej drużynie): w terminarzu organizator szuka
// meczów, nie losowania.
type PanelTab = 'terminarz' | 'druzyny' | 'ustawienia';

// Etykiety, nie surowe klucze z CSS-owym `capitalize`. Tamto wypisywało
// `Druzyny` bez ogonka, bo klucz jest bez polskich znaków (i musi być, bo
// idzie do adresu jako `?tab=`). Zgłoszone z testu na żywo.
const ETYKIETY_PANELU: Record<PanelTab, string> = {
  terminarz: 'Terminarz',
  druzyny: 'Drużyny',
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
  const jestAdmin = useAdmin();
  const adresTurnieju = useAdres('turniej', id) ?? id;
  useAdresWPasku({ [id]: adresTurnieju });
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
  const [emailWspolorganizatora, setEmailWspolorganizatora] = useState('');
  // Remis w tabeli (179): kolejność i komentarz grupy w trakcie edycji.
  const [kolejnoscEdycja, setKolejnoscEdycja] = useState<Record<string, string[]>>({});
  const [komentarzEdycja, setKomentarzEdycja] = useState<Record<string, string>>({});
  const [liczbaGrupWybor, setLiczbaGrupWybor] = useState<number | null>(null);
  const [podglad, setPodglad] = useState<NowyMecz[] | null>(null);
  // Pierwsza dotknięta drużyna przy ręcznej zamianie par w drabince.
  const [doZamiany, setDoZamiany] = useState<MiejsceWDrabince | null>(null);
  const [blikTelefon, setBlikTelefon] = useState<string | null>(null);
  // Linki kapitanów (181): `null` = jeszcze nie przygotowane w tej sesji.
  const [linkiKapitanow, setLinkiKapitanow] = useState<LinkKapitana[] | null>(null);
  const [blikWpis, setBlikWpis] = useState('');
  // Zasady gry w trakcie edycji; `null` = pokaż to, co jest w bazie.
  const [zasadyEdycja, setZasadyEdycja] = useState<WartosciZasad | null>(null);
  // USTAWIENIA BEZ AUTOZAPISU (decyzja właściciela z 2026-11-20). Do tej pory
  // każde pole zapisywało się samo po wyjściu z niego, więc „sprawdzę, jak to
  // wygląda” było od razu zmianą na żywo. Teraz zmiany zbierają się w szkicu,
  // a zapisuje je jeden przycisk przyklejony do dołu ekranu.
  const [szkic, setSzkic] = useState<Partial<TurniejCreate>>({});
  const [szkicAren, setSzkicAren] = useState<Record<string, string>>({});
  // Podbijane przy „Odrzuć”: pola są niekontrolowane, nowy klucz je odświeża.
  const [wersjaUstawien, setWersjaUstawien] = useState(0);
  const [zapisujeUstawienia, setZapisujeUstawienia] = useState(false);
  const maSzkic = Object.keys(szkic).length > 0 || Object.keys(szkicAren).length > 0 || zasadyEdycja !== null;
  useEffect(() => {
    if (!maSzkic) return;
    const ostrzez = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', ostrzez);
    return () => window.removeEventListener('beforeunload', ostrzez);
  }, [maSzkic]);
  // Ręczne godziny meczów (Luboń, 2026-11-18): id meczu → „HH:MM" w trakcie
  // edycji; `null` = terminarz w trybie czytania.
  const [godzinyEdycja, setGodzinyEdycja] = useState<Record<string, string> | null>(null);
  const [zapisujeGodziny, setZapisujeGodziny] = useState(false);
  // Arena meczu w tym samym trybie edycji co godziny (2026-11-20): id meczu → id areny.
  const [arenyEdycja, setArenyEdycja] = useState<Record<string, string>>({});
  // Przerwy z nazwą (176) i formularz jednej przerwy (nowej albo edytowanej).
  const [przerwy, setPrzerwy] = useState<TurniejPrzerwa[]>([]);
  const [przerwaEdycja, setPrzerwaEdycja] = useState<
    // `wiersz`: klucz wiersza przerwy w terminarzu, w którego miejscu stoi
    // formularz („Nazwij” / „Edytuj”). Bez niego (nowa przerwa) formularz
    // stoi nad terminarzem.
    { id?: string; wiersz?: string; nazwa: string; od: string; do: string; opis: string } | null
  >(null);

  // Zegar centrum dowodzenia (od `lg`, w trakcie turnieju): czas gry meczu
  // w toku i „miał zacząć się o…”. Ustawiany po montażu, żeby nie liczyć
  // „teraz” w renderze (AGENTS.md, „Serwer renderuje w UTC”).
  const [teraz, setTeraz] = useState<Date | null>(null);
  useEffect(() => {
    setTeraz(new Date());
    const t = window.setInterval(() => setTeraz(new Date()), 15_000);
    return () => window.clearInterval(t);
  }, []);

  // SAMO ODŚWIEŻANIE w trakcie turnieju (2026-11-21). Wynik wpisany przez
  // współorganizatora z telefonu ma się pojawić na laptopie bez przeładowania
  // strony: inaczej dwa ekrany pokazują dwa różne stany. Odpytywanie, nie
  // Realtime: tabele turnieju nie są w publikacji `supabase_realtime`, a mecz
  // co kilkanaście minut nie potrzebuje opóźnienia poniżej 15 s. Pauza, gdy
  // karta jest w tle albo organizator coś edytuje (podgląd terminarza,
  // godziny): odświeżenie nie może nadpisać tego, co ma przed oczami.
  const statusTurnieju = turniej?.status;
  const edytuje = podglad !== null || godzinyEdycja !== null;
  useEffect(() => {
    if (statusTurnieju !== 'trwa' || edytuje) return;
    const odswiez = () => {
      if (document.visibilityState !== 'visible') return;
      void Promise.all([getMecze(id), getDruzynyZeSkladem(id)])
        .then(([m, d]) => { setMecze(m); setDruzyny(d); })
        .catch(() => { /* następna próba za chwilę */ });
    };
    const t = window.setInterval(odswiez, 15_000);
    document.addEventListener('visibilitychange', odswiez);
    return () => { window.clearInterval(t); document.removeEventListener('visibilitychange', odswiez); };
  }, [id, statusTurnieju, edytuje]);

  const tabParam = searchParams.get('tab');
  // Domyślnie TERMINARZ (2026-11-20). Stary adres `?tab=pulpit` też tu trafia,
  // a `?tab=grupy` do „Drużyn”, gdzie dziś jest podział na grupy.
  const zakladka: PanelTab =
    tabParam === 'druzyny' || tabParam === 'grupy' ? 'druzyny'
      : tabParam === 'ustawienia' ? 'ustawienia'
      : 'terminarz';

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
    // Bez migracji 176 tabela nie istnieje: terminarz działa dalej bez nazw przerw.
    setPrzerwy(await getPrzerwy(id).catch(() => []));
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
    () => (turniej ? uprawnieniaTurnieju(turniej, osoby.find((o) => o.userId === user?.id) ?? null, user?.id, jestAdmin) : null),
    [turniej, osoby, user, jestAdmin],
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
  /** Zmiana pola w szkicu; powrót do wartości z bazy zdejmuje ją ze szkicu. */
  const ustawWSzkicu = <K extends keyof TurniejCreate>(klucz: K, wartosc: TurniejCreate[K], zBazy: TurniejCreate[K]) => {
    setSzkic((s) => {
      const nowy = { ...s };
      const rowne = typeof wartosc === 'string' && typeof zBazy === 'string'
        ? wartosc.trim() === zBazy.trim()
        : wartosc === zBazy;
      if (rowne) delete nowy[klucz]; else nowy[klucz] = wartosc;
      return nowy;
    });
  };

  const zasadyTurnieju: WartosciZasad = {
    czasMeczuMin: turniej.czasMeczuMin,
    przerwaMin: turniej.przerwaMin,
    punktyZaWygrana: turniej.punktyZaWygrana,
    punktyZaRemis: turniej.punktyZaRemis,
    awansujeZGrupy: turniej.awansujeZGrupy,
    meczO3Miejsce: turniej.meczO3Miejsce,
  };

  const zmianyZasad = (): Partial<WartosciZasad> => {
    if (!zasadyEdycja) return {};
    const wynik: Partial<WartosciZasad> = {};
    for (const k of Object.keys(zasadyEdycja) as (keyof WartosciZasad)[]) {
      if (zasadyEdycja[k] !== zasadyTurnieju[k]) Object.assign(wynik, { [k]: zasadyEdycja[k] });
    }
    return wynik;
  };

  const odrzucSzkic = () => {
    setSzkic({});
    setSzkicAren({});
    setZasadyEdycja(null);
    setWersjaUstawien((v) => v + 1);
  };

  const zapiszSzkic = async () => {
    const dane: Partial<TurniejCreate> = { ...szkic, ...zmianyZasad() };
    if (dane.maxDruzyn !== undefined) dane.maxDruzyn = Math.min(64, Math.max(2, Number(dane.maxDruzyn) || 2));
    // Minimalny skład wypadł z modułu; wysyłamy 1, żeby CHECK `min <= max`
    // (145) nie odrzucił małego składu w starym turnieju.
    if (dane.maxZawodnikow !== undefined) {
      dane.maxZawodnikow = Math.min(40, Math.max(1, Number(dane.maxZawodnikow) || 1));
      dane.minZawodnikow = 1;
    }
    if (dane.wpisoweGrosze !== undefined) dane.wpisoweGrosze = Math.max(0, Math.round(Number(dane.wpisoweGrosze) || 0));
    if (dane.dataStartu === '') delete dane.dataStartu;
    if (dane.godzinaStartu === '') delete dane.godzinaStartu;
    const zmianyAren = Object.entries(szkicAren).filter(([, n]) => n.trim().length > 0);
    setZapisujeUstawienia(true);
    try {
      if (Object.keys(dane).length > 0) await updateTurniej(id, dane);
      for (const [arenaId, nazwa] of zmianyAren) await zmienNazweAreny(arenaId, nazwa.trim());
      setSzkic({});
      setSzkicAren({});
      setZasadyEdycja(null);
      await wczytaj();
      toast('Zapisano zmiany');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się zapisać zmian', 'error');
    } finally {
      setZapisujeUstawienia(false);
    }
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
      wpiszAby: turniej.nazwa,
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
      wpiszAby: turniej.nazwa,
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

  const potrzebujeGrup = turniej.format === 'grupy_puchar' || turniej.format === 'grupy_finalowa';
  // Grupa finałowa (175) powstaje sama przy generowaniu terminarza i nie ma
  // przypisanych drużyn, więc nie pokazuje się w losowaniu ani przy wyborze.
  const grupyZwykle = grupy.filter((g) => !g.finalowa);
  // Grupy, w których jest remis do rozstrzygnięcia albo kolejność już ustalona
  // ręcznie (179). Tylko z rozegranym meczem: pusta tabela to nie remis.
  const tabeleDoRozstrzygniecia = tabeleGrupTurnieju(grupy, druzyny, mecze, {
    punktyZaWygrana: turniej.punktyZaWygrana, punktyZaRemis: turniej.punktyZaRemis,
  }).filter(({ grupa, wiersze }) => wiersze.some((w) => w.mecze > 0)
    && (!!grupa.kolejnoscReczna || maRemisWTabeli(wiersze)));
  const grupyPoId = new Map(grupy.map((g) => [g.id, g]));
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

  const generujPodglad = async () => {
    if (wTurnieju.length < 2) { toast('Potrzeba co najmniej 2 przyjętych drużyn', 'error'); return; }
    try {
      await zbudujPodglad();
    } catch (e) {
      // CISZA JEST TU NAJGORSZĄ ODPOWIEDZIĄ. Generator rzucał wyjątek wewnątrz
      // obsługi kliknięcia (nieprawidłowa godzina startu dawała `RangeError:
      // Invalid time value`), więc organizator klikał główny przycisk panelu
      // i nie działo się NIC: ani terminarz, ani komunikat. To jest moment,
      // w którym wraca do Excela.
      toast(e instanceof Error ? e.message : 'Nie udało się ułożyć terminarza.', 'error');
    }
  };

  const zbudujPodglad = async () => {
    let nowe: NowyMecz[];
    if (turniej.format === 'liga') {
      nowe = meczeKazdyZKazdym(wTurnieju.map((d) => d.id), { startNumer: 1 });
    } else if (turniej.format === 'puchar') {
      const losowe = rozlosujGrupy(wTurnieju.map((d) => d.id), 1)[0];
      nowe = zbudujDrabinke(losowe, { startNumer: 1, meczO3Miejsce: turniej.meczO3Miejsce });
    } else {
      if (grupyZwykle.length === 0) { toast('Najpierw wylosuj grupy', 'error'); return; }
      let numer = 1;
      const fazaGrupowa = grupyZwykle.flatMap((g) => {
        const wGrupie = wTurnieju.filter((d) => d.grupaId === g.id).map((d) => d.id);
        const czesc = meczeKazdyZKazdym(wGrupie, { startNumer: numer, grupaId: g.id });
        numer += czesc.length;
        return czesc;
      });
      // FAZA PO GRUPACH POWSTAJE OD RAZU (175). Do 2026-11-18 terminarz
      // „grupy → puchar" kończył się na grupach, a drabinkę trzeba było
      // dopisywać ręcznie (audyt 5, N1). Dziś mecze kolejnej fazy stoją
      // w terminarzu z podpisem „Zwycięzca A", a drużyny wpisuje baza, gdy
      // grupa rozegra ostatni mecz.
      const najmniejszaGrupa = Math.min(
        ...grupyZwykle.map((g) => wTurnieju.filter((d) => d.grupaId === g.id).length),
      );
      const awansuje = Math.max(1, Math.min(turniej.awansujeZGrupy, najmniejszaGrupa));
      const opcjeFazy = {
        startNumer: numer,
        startKolejka: Math.max(0, ...fazaGrupowa.map((m) => m.kolejka ?? 1)) + 1,
        awansuje,
        meczO3Miejsce: turniej.meczO3Miejsce,
      };
      let dalej: NowyMecz[] = [];
      if (grupyZwykle.length * awansuje >= 2) {
        if (turniej.format === 'grupy_finalowa') {
          let finalowa = grupy.find((g) => g.finalowa);
          if (!finalowa) {
            const zajete = new Set(grupyZwykle.map((g) => g.nazwa));
            finalowa = await dodajGrupe(id, zajete.has('F') ? 'Finałowa' : 'F', true);
            setGrupy((g) => [...g, finalowa!]);
          }
          dalej = grupaFinalowaZGrup(grupyZwykle, finalowa.id, opcjeFazy);
        } else {
          dalej = drabinkaZGrup(grupyZwykle, opcjeFazy);
        }
      }
      nowe = [...fazaGrupowa, ...dalej];
    }
    const ulozone = ulozHarmonogram(nowe, {
      arenyId: areny.map((a) => a.id),
      // Start w czasie POLSKIM, nie w strefie urządzenia organizatora.
      startAt: instantZCzasuPolskiego(turniej.dataStartu, turniej.godzinaStartu),
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

  const meczePoTerminie = [...mecze].sort(porownajTermin);

  const zapiszPrzerwe = async () => {
    if (!przerwaEdycja) return;
    const { nazwa, od, do: doGodz, opis } = przerwaEdycja;
    if (!nazwa.trim()) { toast('Nazwij przerwę, np. „Konkurs” albo „Dekoracja”', 'error'); return; }
    if (!od || !doGodz || doGodz <= od) { toast('Koniec przerwy musi być po jej początku', 'error'); return; }
    // Dzień: ten sam co dotąd przy edycji, dzień turnieju przy nowej przerwie.
    const istniejaca = przerwaEdycja.id ? przerwy.find((p) => p.id === przerwaEdycja.id) : undefined;
    const dzien = istniejaca ? chwilaWPolsce(istniejaca.odAt).data : turniej.dataStartu;
    const dane = {
      nazwa,
      opis,
      odAt: instantZCzasuPolskiego(dzien, od),
      doAt: instantZCzasuPolskiego(dzien, doGodz),
    };
    // PRZERWA NA MECZACH (2026-11-21): nie blokujemy, pytamy. Organizator
    // czasem świadomie gra obok przerwy na drugiej arenie; częściej pomylił
    // godzinę albo chce, żeby mecze poszły po przerwie.
    const kolizje = meczeNachodzaceNaPrzerwe(mecze, dane.odAt, dane.doAt, turniej.czasMeczuMin);
    let przesun: { id: string; zaplanowanyAt: string }[] = [];
    if (kolizje.length > 0) {
      const numery = [...kolizje].sort((a, b) => a.numer - b.numer).map((m) => `M${m.numer}`).join(', ');
      const wynik = await potwierdz({
        tytul: 'Przerwa nachodzi na mecze',
        konsekwencje: [
          `${od}–${doGodz} pokrywa się z: ${numery}`,
          '„Przesuń mecze”: te mecze i wszystkie po nich zaczną się po przerwie, odstępy zostają',
        ],
        potwierdzLabel: 'Przesuń mecze',
        akcjaDodatkowaLabel: 'Zapisz bez przesuwania',
        anulujLabel: 'Popraw godziny',
      });
      if (wynik === 'nie') return;
      if (wynik === 'tak') przesun = przesuniecieZaPrzerwe(mecze, dane.odAt, dane.doAt, turniej.czasMeczuMin);
    }
    try {
      if (przerwaEdycja.id) await zmienPrzerwe(przerwaEdycja.id, dane);
      else await dodajPrzerwe(id, dane);
      for (const z of przesun) await updateMecz(z.id, { zaplanowanyAt: z.zaplanowanyAt });
      setPrzerwaEdycja(null);
      setPrzerwy(await getPrzerwy(id));
      if (przesun.length > 0) await wczytaj();
      toast(przesun.length > 0
        ? `Przerwa zapisana, przesunięto ${withCount(przesun.length, 'mecz', 'mecze', 'meczów')}`
        : 'Przerwa zapisana');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się zapisać przerwy', 'error');
    }
  };
  const usunPrzerweAkcja = async (przerwaId: string) => {
    try {
      await usunPrzerwe(przerwaId);
      setPrzerwaEdycja(null);
      setPrzerwy(await getPrzerwy(id));
      toast('Przerwa usunięta');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się usunąć przerwy', 'error');
    }
  };

  const formularzPrzerwy = () => przerwaEdycja && (
    <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3.5">
      <p className="text-sm font-semibold text-ink">{przerwaEdycja.id ? 'Edytuj przerwę' : 'Nowa przerwa'}</p>
      <div>
        <label htmlFor="przerwa-nazwa" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Nazwa</label>
        <input
          id="przerwa-nazwa"
          value={przerwaEdycja.nazwa}
          maxLength={60}
          placeholder="np. Konkurs obijania poprzeczki"
          onChange={(e) => setPrzerwaEdycja((p) => (p ? { ...p, nazwa: e.target.value } : p))}
          className={inputCls}
        />
      </div>
      {/* `min-w-0` + `appearance-none`: pole godziny w Safari ma własną
          minimalną szerokość i wychodziło poza kartę. */}
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <label htmlFor="przerwa-od" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Od</label>
          <input id="przerwa-od" type="time" value={przerwaEdycja.od}
            onChange={(e) => setPrzerwaEdycja((p) => (p ? { ...p, od: e.target.value } : p))}
            className={`${inputCls} min-w-0 appearance-none`} />
        </div>
        <div className="min-w-0">
          <label htmlFor="przerwa-do" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Do</label>
          <input id="przerwa-do" type="time" value={przerwaEdycja.do}
            onChange={(e) => setPrzerwaEdycja((p) => (p ? { ...p, do: e.target.value } : p))}
            className={`${inputCls} min-w-0 appearance-none`} />
        </div>
      </div>
      <div>
        <label htmlFor="przerwa-opis" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Opis (opcjonalnie)</label>
        <textarea
          id="przerwa-opis"
          rows={2}
          maxLength={300}
          value={przerwaEdycja.opis}
          placeholder="np. Grupa C: przyjazd do 12:25. A i B zostają do końca konkursu."
          onChange={(e) => setPrzerwaEdycja((p) => (p ? { ...p, opis: e.target.value } : p))}
          className={inputCls}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={zapiszPrzerwe}>Zapisz przerwę</Button>
        <Button size="sm" variant="outline" onClick={() => setPrzerwaEdycja(null)}>Anuluj</Button>
        {przerwaEdycja.id && (
          <button
            type="button"
            onClick={() => usunPrzerweAkcja(przerwaEdycja.id!)}
            className="ml-auto text-sm font-medium text-red-600"
          >
            Usuń przerwę
          </button>
        )}
      </div>
    </div>
  );

  const zacznijEdycjeGodzin = () => {
    const start: Record<string, string> = {};
    for (const m of mecze) {
      start[m.id] = m.zaplanowanyAt ? chwilaWPolsce(m.zaplanowanyAt).godzina.slice(0, 5) : '';
    }
    setGodzinyEdycja(start);
    setArenyEdycja(Object.fromEntries(mecze.map((m) => [m.id, m.arenaId ?? ''])));
  };

  const zapiszGodziny = async () => {
    if (!godzinyEdycja) return;
    // Dzień zostaje ten sam co dotąd (albo dzień turnieju, gdy mecz nie miał
    // godziny): turniej jednodniowy, a pole dnia przy każdym meczu byłoby
    // trzydzieści trzy razy tym samym pytaniem.
    const zmiany = mecze.flatMap((m) => {
      if (m.status !== 'zaplanowany' || czyWolnyLos(m)) return [];
      const zmiana: { id: string; zaplanowanyAt?: string; arenaId?: string } = { id: m.id };
      const godzina = godzinyEdycja[m.id];
      if (godzina) {
        const dzien = m.zaplanowanyAt ? chwilaWPolsce(m.zaplanowanyAt).data : turniej.dataStartu;
        const nowa = instantZCzasuPolskiego(dzien, godzina);
        if (!m.zaplanowanyAt || new Date(m.zaplanowanyAt).getTime() !== new Date(nowa).getTime()) {
          zmiana.zaplanowanyAt = nowa;
        }
      }
      const arena = arenyEdycja[m.id];
      if (arena && arena !== (m.arenaId ?? '')) zmiana.arenaId = arena;
      return zmiana.zaplanowanyAt || zmiana.arenaId ? [zmiana] : [];
    });
    if (zmiany.length === 0) { setGodzinyEdycja(null); return; }
    setZapisujeGodziny(true);
    try {
      for (const { id: meczId, ...z } of zmiany) await updateMecz(meczId, z);
      setGodzinyEdycja(null);
      await wczytaj();
      toast(`Zapisano zmiany (${withCount(zmiany.length, 'mecz', 'mecze', 'meczów')})`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się zapisać godzin', 'error');
      await wczytaj();
    } finally {
      setZapisujeGodziny(false);
    }
  };

  const zapiszRozstrzygniecie = async (grupaId: string, kolejnosc: string[] | null, komentarz: string) => {
    try {
      await ustawKolejnoscGrupy(grupaId, kolejnosc);
      await ustawKomentarzGrupy(grupaId, komentarz);
      setKolejnoscEdycja((k) => { const n = { ...k }; delete n[grupaId]; return n; });
      setKomentarzEdycja((k) => { const n = { ...k }; delete n[grupaId]; return n; });
      await wczytaj();
      toast(kolejnosc ? 'Kolejność zapisana' : 'Wróciła kolejność liczona');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się zapisać kolejności', 'error');
    }
  };

  const dodajWspolorganizatoraAkcja = async () => {
    try {
      const nazwa = await dodajWspolorganizatora(id, emailWspolorganizatora);
      setEmailWspolorganizatora('');
      await wczytaj();
      toast(`${nazwa} jest współorganizatorem`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się dodać współorganizatora', 'error');
    }
  };

  const usunWspolorganizatoraAkcja = async (userId: string, imie?: string) => {
    const wynik = await potwierdz({
      tytul: `Odebrać uprawnienia${imie ? `: ${imie}` : ''}?`,
      konsekwencje: ['Ta osoba przestanie widzieć panel turnieju'],
      potwierdzLabel: 'Odbierz',
      wariant: 'destrukcyjny',
    });
    if (wynik !== 'tak') return;
    try { await usunOsobeTurnieju(id, userId); await wczytaj(); toast('Uprawnienia odebrane'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Nie udało się odebrać uprawnień', 'error'); }
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
  const mozeRozpoczac = mozeRozpoczacTurniej(turniej, mecze);

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

  // START A PIERWSZY MECZ (audyt 6, P-9). Od #463 godzinę startu da się
  // zmienić w Ustawieniach bez przeliczenia terminarza, więc nagłówek mówi
  // jedno, a pierwszy mecz drugie. Nie poprawiamy tego po cichu: organizator
  // wybiera, która godzina jest prawdziwa.
  const pierwszyMecz = mecze
    .filter((m) => m.zaplanowanyAt && m.status === 'zaplanowany')
    .sort((a, b) => a.zaplanowanyAt!.localeCompare(b.zaplanowanyAt!))[0];
  const pierwszyMeczPl = pierwszyMecz?.zaplanowanyAt ? chwilaWPolsce(pierwszyMecz.zaplanowanyAt) : null;
  const startNieZgadzaSie = !!pierwszyMeczPl && turniej.status !== 'trwa' && turniej.status !== 'zakonczony'
    && (pierwszyMeczPl.data !== turniej.dataStartu || pierwszyMeczPl.godzina !== (turniej.godzinaStartu ?? '').slice(0, 5));

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

  // ── Centrum dowodzenia (od `lg`, w trakcie turnieju) ─────────────────────
  const trwa = turniej.status === 'trwa';
  const centrum = centrumTurnieju(mecze, teraz ?? new Date(0), { liczbaAren: areny.length });
  const meczNaZywo = centrum.naZywo[0];
  const nastepnyGotowy = centrum.doRozpoczecia;

  const cofnijAkcja = async (m: TurniejMecz) => {
    try {
      const cofniete = await cofnijOstatnieZdarzenie(m.id);
      await wczytaj();
      if (!cofniete) { toast('Nie ma czego cofnąć'); return; }
      const kto = druzynyPoId.get(cofniete.druzynaId) ?? '';
      const co = cofniete.typ === 'gol' ? 'gol' : cofniete.typ === 'samobojczy' ? 'gol samobójczy'
        : cofniete.typ === 'punkty' ? 'punkty' : 'kartkę';
      toast(`Cofnięto ${co}${kto ? `: ${kto}` : ''}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się cofnąć', 'error');
    }
  };

  const rozpocznijMeczAkcja = async (m: TurniejMecz) => {
    try { await rozpocznijMecz(m.id); await wczytaj(); toast(`M${m.numer} rozpoczęty`); }
    catch (e) { toast(e instanceof Error ? e.message : 'Nie udało się rozpocząć meczu', 'error'); }
  };

  // Gol bez strzelca, jednym kliknięciem. Wynik liczy wyzwalacz (147) ze
  // zdarzeń, więc to ten sam zapis co „GOL” na stronie meczu; strzelca można
  // dopisać tam. Wynik na ekranie rośnie od razu, baza go potwierdza.
  const golAkcja = async (m: TurniejMecz, druzynaId: string) => {
    const strona = druzynaId === m.druzynaAId ? 'wynikA' : 'wynikB';
    setMecze((lista) => lista.map((x) => (x.id === m.id ? { ...x, [strona]: x[strona] + 1 } : x)));
    try {
      await dodajZdarzenie(m.id, { druzynaId, typ: 'gol', minuta: minutaMeczu(m, new Date(), turniej.czasMeczuMin) });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się zapisać gola', 'error');
    }
    await wczytaj();
  };

  const zakonczMeczAkcja = async (m: TurniejMecz) => {
    const wynik = await potwierdz({
      tytul: `Zakończyć M${m.numer}?`,
      konsekwencje: [
        `Wynik ${m.wynikA}:${m.wynikB} trafi do tabeli`,
        'Pomyłkę poprawisz na stronie meczu',
      ],
      potwierdzLabel: 'Zakończ mecz',
    });
    if (wynik !== 'tak') return;
    try { await zakonczMecz(m.id); await wczytaj(); toast(`M${m.numer} zakończony`); }
    catch (e) { toast(e instanceof Error ? e.message : 'Nie udało się zakończyć meczu', 'error'); }
  };

  const zmienGodzinyZPaska = () => {
    if (zakladka !== 'terminarz') router.push(`/turnieje/${id}/panel?tab=terminarz`);
    zacznijEdycjeGodzin();
    window.setTimeout(() => document.getElementById('terminarz')?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header />
      <div className="sticky top-0 z-10 border-b border-slate-100 dark:border-slate-700 bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 lg:max-w-6xl lg:px-6 2xl:max-w-7xl">
          <button onClick={() => router.push(`/turnieje/${id}`)} aria-label="Wróć" className="shrink-0 text-slate-500 hover:text-ink">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="min-w-0 flex-1 truncate font-display text-lg font-bold text-ink">Panel: {turniej.nazwa}</h1>
          {/* PASEK STANU od `lg` (2026-11-21): gdzie jesteśmy i co kliknąć
              teraz, niezależnie od zakładki. Na telefonie postęp stoi nad
              terminarzem, a pasek nie zmieściłby się obok nazwy. Bez
              „opóźnienia”: decyzja właściciela z 2026-11-08. */}
          {trwa && (
            <div className="hidden shrink-0 items-center gap-3 lg:flex">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-950/50 dark:text-primary-300">
                <span className="h-2 w-2 rounded-full bg-primary-600" aria-hidden /> Turniej trwa
              </span>
              {postep.wszystkie > 0 && (
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  <span className="font-display text-lg font-bold tabular-nums text-ink">{postep.rozegrane}</span>
                  {' '}z {withCount(postep.wszystkie, 'meczu', 'meczów', 'meczów')}
                </span>
              )}
              {mecze.length > 0 && (
                <Button size="sm" variant="outline" onClick={zmienGodzinyZPaska}>
                  {areny.length > 1 ? 'Zmień godziny i areny' : 'Zmień godziny'}
                </Button>
              )}
              <Link
                href={`/turnieje/${id}`}
                className="inline-flex min-h-[36px] items-center rounded-xl border border-slate-300 px-3 text-sm font-medium text-ink hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
              >
                Strona publiczna
              </Link>
              {/* Nowa karta: ekran idzie na rzutnik albo drugi monitor, panel
                  zostaje na laptopie. */}
              {/* Wybór układu przed otwarciem (2026-11-21): co ma dominować na
                  ścianie. Układ da się też zmienić na samym ekranie. */}
              <details className="relative">
                <summary className="inline-flex min-h-[36px] cursor-pointer list-none items-center rounded-xl border border-slate-300 px-3 text-sm font-medium text-ink hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800 [&::-webkit-details-marker]:hidden">
                  Ekran na halę
                </summary>
                <div className="absolute right-0 z-20 mt-1 max-h-[75vh] w-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  <WyborEkranu adresTurnieju={adresTurnieju} />
                </div>
              </details>
              {meczNaZywo ? (
                <Link
                  href={`/turnieje/${id}/mecz/${meczNaZywo.id}`}
                  className="inline-flex min-h-[36px] items-center rounded-xl bg-primary-600 px-3 text-sm font-semibold text-white hover:bg-primary-700"
                >
                  Wpisz wynik M{meczNaZywo.numer}
                </Link>
              ) : nastepnyGotowy ? (
                <Button size="sm" onClick={() => rozpocznijMeczAkcja(nastepnyGotowy)}>
                  Rozpocznij M{nastepnyGotowy.numer}
                </Button>
              ) : null}
            </div>
          )}
        </div>
        {/* Cień przy prawej krawędzi. Bez niego pasek kończył się uciętym
            „Us…" i nic nie mówiło, że da się go przesunąć, a za krawędzią
            siedzą Ustawienia: zamknięcie zapisów i odwołanie turnieju, czyli
            akcje pod presją czasu. `md:hidden`, bo od tabletu pasek mieści się
            w całości i cień kłamałby o istnieniu dalszej treści. */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-canvas to-transparent md:hidden" />
          <div className="mx-auto flex max-w-2xl gap-1 overflow-x-auto px-4 pb-2 scrollbar-hide lg:max-w-6xl lg:px-6 2xl:max-w-7xl">
          {(['terminarz', 'druzyny', 'ustawienia'] as PanelTab[]).map((z) => (
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

      {/* SZEROKI PANEL od `lg` (2026-11-21): przy 1440 px kolumna 640 px
          zostawiała ponad połowę ekranu pustą. Szeroko jest tylko to, co
          z szerokości korzysta (centrum dowodzenia w trakcie turnieju);
          formularze Drużyn i Ustawień zostają w czytelnej kolumnie. */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-5 lg:max-w-6xl lg:px-6 2xl:max-w-7xl">
        {zakladka === 'terminarz' && trwa && teraz && mecze.length > 0 && (
          <CentrumTurnieju
            turniej={turniej}
            mecze={mecze}
            przerwy={przerwy}
            druzynyPoId={druzynyPoId}
            meczePoId={meczePoId}
            arenyPoId={arenyPoId}
            grupyPoId={grupyPoId}
            tabele={tabeleTurnieju(turniej, grupy, mecze, druzyny)}
            liczbaZgloszen={czekajace.length}
            liczbaAren={areny.length}
            teraz={teraz}
            onCofnij={cofnijAkcja}
            onZegar={async (m, z) => {
              setMecze((lista) => lista.map((x) => (x.id === m.id ? { ...x, zegarOd: z.zegarOd ?? undefined, zegarSekundy: z.zegarSekundy, polowa: z.polowa } : x)));
              try { await updateMecz(m.id, z); }
              catch (e) { toast(e instanceof Error ? e.message : 'Nie udało się zapisać zegara', 'error'); await wczytaj(); }
            }}
            onRozpocznij={rozpocznijMeczAkcja}
            onGol={golAkcja}
            onZakoncz={zakonczMeczAkcja}
          />
        )}
        {/* Pod centrum dowodzenia pełny terminarz stoi pod jego lewą kolumną,
            nie na środku: inaczej wisiał między dwiema kolumnami. */}
        <div className={`mx-auto w-full max-w-2xl space-y-5 lg:max-w-3xl ${trwa && mecze.length > 0 ? 'lg:mx-0' : ''}`}>
        {/* STAN TURNIEJU NAD TERMINARZEM (dawny „Pulpit”, 2026-11-20): próba,
            „Rozpocznij / Przetestuj”, braki przed startem, postęp w trakcie.
            Listy „Wpisz wynik” już nie ma: terminarz pod spodem jest tą listą. */}
        {zakladka === 'terminarz' && (
          <div className="space-y-4">
            {/* Pierwsza rzecz w terminarzu: ile już rozegrano (2026-11-20). */}
            {postep.wszystkie > 0 && (
              <div className={`rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm ${trwa ? 'lg:hidden' : ''}`}>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Rozegrane <span className="font-display text-lg font-bold text-ink">{postep.rozegrane}</span>
                  {' '}z {withCount(postep.wszystkie, 'meczu', 'meczów', 'meczów')}
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-primary-600 transition-all"
                    style={{ width: `${Math.round((postep.rozegrane / postep.wszystkie) * 100)}%` }}
                  />
                </div>
              </div>
            )}
            {/* W DNIU TURNIEJU pulpit jest wieżą kontrolną: ile rozegrano
                i które mecze czekają na wynik. Do 2026-11-08 stało tu „o ile
                jesteśmy spóźnieni" z przyciskiem „Przesuń resztę", liczone
                z godzin terminarza. Wycofane decyzją właściciela: turniejem
                steruje klikanie, a godziny i tak rozjeżdżają się od pierwszego
                meczu. Ręczne „Przesuń od meczu" z zakładki Terminarz też wypadło: godziny
                są orientacyjne i niczego nie uruchamiają. */}
            {proba && (
              // Neutralny szary, nie bursztyn: próba to osobna, zamknięta droga
              // (nic nie trafia do prawdziwego turnieju), a nie ostrzeżenie
              // ani nowość (audyt 7, Z-8).
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4 space-y-2">
                <p className="text-sm font-semibold text-ink">To jest próba</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Wpisuj wyniki, zmieniaj, sprawdzaj drabinkę. Nic z tego nie trafia do prawdziwego
                  turnieju, a zawodnicy nie dostają powiadomień.
                </p>
                <Button variant="outline" onClick={zakonczProbe} className="w-full">Zakończ próbę i usuń kopię</Button>
              </div>
            )}
            {turniej.status === 'zakonczony' ? (
              // Pulpit zakończonego turnieju pokazywał listę przygotowań sprzed
              // startu. Teraz mówi to samo co strona publiczna.
              <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm space-y-2">
                <p className="text-sm font-semibold text-ink">Turniej zakończony</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Pomyłkę w wyniku poprawisz na stronie meczu.
                </p>
                <Link href={`/turnieje/${id}?tab=tabela`} className="inline-block text-sm font-medium text-primary-600">
                  Zobacz podium i tabele
                </Link>
              </div>
            ) : turniej.status === 'trwa' ? (
              <>
                {/* KOMPLET WYNIKÓW (audyt 2026-11-18, F5). Przy 33 z 33 pulpit
                    dalej mówił „Turniej trwa”, a strona publiczna już
                    „Zakończony” z podium. */}
                {postep.wszystkie > 0 && postep.rozegrane >= postep.wszystkie ? (
                  <div className="rounded-2xl border border-primary-100 dark:border-primary-900 bg-primary-50/60 dark:bg-primary-950/30 p-4 space-y-2">
                    <p className="text-sm font-semibold text-ink">Wszystkie mecze rozegrane</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Podium i tabele są już na stronie turnieju.
                      {!proba && ' Zakończ turniej, gdy skończycie dekorację.'}
                    </p>
                    <Link href={`/turnieje/${id}?tab=tabela`} className="inline-block text-sm font-medium text-primary-600">
                      Zobacz podium i tabele
                    </Link>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-primary-100 dark:border-primary-900 bg-primary-50/60 dark:bg-primary-950/30 p-4 lg:hidden">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                      <span className="inline-block h-2 w-2 rounded-full bg-primary-600" /> Turniej trwa
                    </p>
                    <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                      Stuknij mecz w terminarzu, żeby wpisać wynik.
                    </p>
                  </div>
                )}

              </>
            ) : (
              <>
                {/* Tylko to, czego brakuje: odhaczone „✓” zajmowały ekran nad
                    terminarzem i nic nie mówiły. */}
                {pozycjePulpitu.some((poz) => poz.stan !== 'gotowe') && (
                <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
                  <p className="mb-2 text-sm font-semibold text-ink">Przed startem</p>
                  <ul className="space-y-2">
                    {pozycjePulpitu.filter((poz) => poz.stan !== 'gotowe').map((poz) => (
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
                )}

                {startNieZgadzaSie && pierwszyMeczPl && (
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-2 shadow-sm">
                    <p className="text-sm font-semibold text-ink">⚠ Start i pierwszy mecz się nie zgadzają</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Na stronie turnieju start to {etykietaTerminu(turniej.dataStartu, turniej.godzinaStartu)}, a pierwszy
                      mecz w terminarzu jest {etykietaTerminu(pierwszyMeczPl.data, pierwszyMeczPl.godzina).toLowerCase()}.
                      Uczestnicy zobaczą obie godziny.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => zapiszUstawienie({ dataStartu: pierwszyMeczPl.data, godzinaStartu: pierwszyMeczPl.godzina })}
                      >
                        Ustaw start na {pierwszyMeczPl.godzina}
                      </Button>
                      {rozegranych === 0 && (
                        <Button size="sm" variant="outline" onClick={() => router.push(`/turnieje/${id}/panel?tab=terminarz`)}>
                          Ułóż terminarz od {(turniej.godzinaStartu ?? '').slice(0, 5)}
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* „Przetestuj" OBOK „Rozpocznij" (decyzja właściciela
                    z 2026-11-08): widok dnia turnieju organizator ma zobaczyć
                    wcześniej, na kopii, a nie pierwszy raz w sobotę o 10:00. */}
                {/* „Przetestuj” od 2026-11-21 tylko dla admina (decyzja
                    właściciela): organizator dostaje gotowy turniej, a próby
                    robi Bojo przed przekazaniem. */}
                {mozeRozpoczac && (
                  <div className="flex gap-2">
                    <Button onClick={rozpocznijTurniej} className="flex-1">Rozpocznij turniej</Button>
                    {jestAdmin && <Button variant="outline" onClick={przetestuj} className="flex-1">Przetestuj</Button>}
                  </div>
                )}
                {mozeRozpoczac && jestAdmin && (
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

            {/* REMIS W TABELI (179, 2026-11-21). Grupa finałowa w Luboniu
                skończyła się trzema drużynami z identycznym bilansem, a Bojo
                ogłosiło podium alfabetem. Karta pojawia się przy grupie z
                miejscem ex aequo (albo z kolejnością już ustaloną ręcznie):
                organizator przestawia drużyny i może dopisać, jak rozstrzygnął. */}
            {tabeleDoRozstrzygniecia.length > 0 && (
              <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-4 shadow-sm">
                <div>
                  <h2 className="text-sm font-semibold text-ink">Remis w tabeli</h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Drużyny z tymi samymi punktami, bilansem i bramkami zajmują miejsce ex aequo. Ustal kolejność strzałkami; komentarz pokaże się pod tabelą.
                  </p>
                </div>
                {tabeleDoRozstrzygniecia.map(({ grupa, wiersze }) => {
                  const kolejnosc = kolejnoscEdycja[grupa.id] ?? wiersze.map((w) => w.druzynaId);
                  const komentarz = komentarzEdycja[grupa.id] ?? grupa.komentarz ?? '';
                  const przesun = (i: number, o: number) => {
                    const nowa = [...kolejnosc];
                    [nowa[i], nowa[i + o]] = [nowa[i + o], nowa[i]];
                    setKolejnoscEdycja((k) => ({ ...k, [grupa.id]: nowa }));
                  };
                  return (
                    <div key={grupa.id} className="space-y-2 rounded-xl border border-slate-100 dark:border-slate-700 p-3">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                        Grupa {grupa.nazwa}{grupa.finalowa ? ' (finałowa)' : ''}
                      </p>
                      <ol className="space-y-1">
                        {kolejnosc.map((dId, i) => {
                          const w = wiersze.find((x) => x.druzynaId === dId);
                          return (
                            <li key={dId} className="flex items-center gap-2">
                              <span className="w-5 shrink-0 text-center text-sm font-semibold text-slate-500">{i + 1}</span>
                              <span className="min-w-0 flex-1 break-words text-sm font-medium text-ink">
                                {w?.nazwa ?? '?'} <span className="text-xs font-normal text-slate-500">{w ? `${w.punkty} pkt, ${w.bramkiZdobyte}:${w.bramkiStracone}` : ''}</span>
                              </span>
                              <button onClick={() => przesun(i, -1)} disabled={i === 0} aria-label={`Wyżej: ${w?.nazwa ?? ''}`}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 disabled:opacity-30">↑</button>
                              <button onClick={() => przesun(i, 1)} disabled={i === kolejnosc.length - 1} aria-label={`Niżej: ${w?.nazwa ?? ''}`}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 disabled:opacity-30">↓</button>
                            </li>
                          );
                        })}
                      </ol>
                      <textarea
                        value={komentarz}
                        maxLength={300}
                        rows={2}
                        placeholder="Komentarz pod tabelą, np. „O 1. miejscu zdecydowały karne po meczu”"
                        onChange={(e) => setKomentarzEdycja((k) => ({ ...k, [grupa.id]: e.target.value }))}
                        className={inputCls}
                        aria-label={`Komentarz pod tabelą grupy ${grupa.nazwa}`}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" onClick={() => zapiszRozstrzygniecie(grupa.id, kolejnosc, komentarz)}>Zapisz kolejność</Button>
                        {grupa.kolejnoscReczna && (
                          <button onClick={() => zapiszRozstrzygniecie(grupa.id, null, komentarz)} className="min-h-[44px] px-2 text-sm font-medium text-slate-500">
                            Wróć do liczonej
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* PODZIAŁ NA GRUPY W OSOBNEJ KARCIE (2026-11-21): grupy jedna pod
                drugą z drużynami i przełącznikiem przy każdej. Lista „W turnieju”
                niżej jest już tylko listą drużyn (skład, kapitan, wpisowe). */}
            {potrzebujeGrup && (
              <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3 shadow-sm">
                <h2 className="text-sm font-semibold text-ink">Podział na grupy</h2>
                {grupyZwykle.length === 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor="liczba-grup" className="text-sm text-slate-600 dark:text-slate-300">Ile grup</label>
                    <input
                      id="liczba-grup"
                      type="number"
                      min={1}
                      value={liczbaGrupWybor ?? liczbaGrupDomyslna}
                      onChange={(e) => setLiczbaGrupWybor(e.target.value === '' ? null : Number(e.target.value))}
                      onBlur={() => setLiczbaGrupWybor((v) => (v ? Math.max(1, v) : null))}
                      className={`${inputCls} w-20`}
                    />
                    <Button size="sm" onClick={() => losujGrupy()} disabled={wTurnieju.length < 2}>Losuj grupy</Button>
                    <Button size="sm" variant="outline" onClick={() => losujGrupy(true)} disabled={wTurnieju.length < 2}>Ustaw ręcznie</Button>
                    {wTurnieju.length < 2 && (
                      <p className="w-full text-xs text-slate-500">
                        Potrzebne co najmniej 2 przyjęte drużyny (masz {wTurnieju.length}).
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    {[...grupyZwykle.map((g) => ({ klucz: g.id, nazwa: `Grupa ${g.nazwa}`, druzyny: wTurnieju.filter((d) => d.grupaId === g.id), bez: false })),
                      { klucz: 'bez', nazwa: 'Bez grupy', druzyny: wTurnieju.filter((d) => !d.grupaId || !grupyZwykle.some((g) => g.id === d.grupaId)), bez: true }]
                      .filter((g) => !g.bez || g.druzyny.length > 0)
                      .map((g) => (
                        <div key={g.klucz} className={`rounded-xl border p-3 ${g.bez ? 'border-amber-100 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30' : 'border-slate-100 dark:border-slate-700'}`}>
                          <p className={`text-xs font-semibold ${g.bez ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-300'}`}>
                            {g.nazwa} · {odmienDruzyny(g.druzyny.length)}
                          </p>
                          {g.druzyny.length === 0 && <p className="mt-1 text-sm text-slate-500">Pusta</p>}
                          <ul className="mt-1 divide-y divide-slate-100 dark:divide-slate-700">
                            {g.druzyny.map((d) => (
                              <li key={d.id} className="flex min-h-[44px] items-center gap-2 py-1">
                                <span className="min-w-0 flex-1 break-words text-sm font-medium text-ink">{d.nazwa}</span>
                                {/* Przełącznik grupy: po pierwszym rozegranym meczu
                                    zablokowany, jak układanie terminarza. */}
                                {rozegranych === 0 && (
                                  <select
                                    value={g.bez ? '' : g.klucz}
                                    onChange={(e) => e.target.value && przeniesDoGrupy(d, e.target.value)}
                                    aria-label={`Grupa drużyny ${d.nazwa}`}
                                    className="shrink-0 rounded-lg border border-slate-300 dark:border-slate-600 bg-white px-2 py-1.5 text-xs font-medium dark:bg-slate-700 dark:text-slate-100"
                                  >
                                    {g.bez && <option value="">Wybierz…</option>}
                                    {grupyZwykle.map((x) => <option key={x.id} value={x.id}>Grupa {x.nazwa}</option>)}
                                  </select>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    {rozegranych > 0 ? (
                      <p className="text-xs text-slate-500">Rozegrano już mecze, więc grup nie da się zmienić.</p>
                    ) : (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <button onClick={() => losujGrupy()} className="min-h-[44px] text-sm font-medium text-primary-600">Losuj ponownie</button>
                        {mecze.length > 0 && <p className="text-xs text-slate-500">Po zmianie grup wygeneruj terminarz od nowa.</p>}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* LINKI DLA KAPITANÓW (181, 2026-11-22): drużyny wpisane przez
                organizatora nie mają kapitana. Jednorazowy link na drużynę:
                kapitan loguje się i przejmuje ją sam, a organizator wkleja
                komplet na WhatsApp jednym przyciskiem. */}
            {wTurnieju.length > 0 && uprawnienia?.mozeZarzadzacDruzynami && (
              <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3 shadow-sm">
                <div>
                  <h2 className="text-sm font-semibold text-ink">Linki dla kapitanów</h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Każda drużyna bez kapitana dostaje swój link. Kapitan otwiera go, loguje się i przejmuje drużynę.
                    Link działa raz.
                  </p>
                </div>
                {linkiKapitanow === null ? (
                  <Button
                    size="sm"
                    onClick={async () => {
                      try { setLinkiKapitanow(await przygotujLinkiKapitanow(id)); }
                      catch (e) { toast(e instanceof Error ? e.message : 'Nie udało się przygotować linków', 'error'); }
                    }}
                  >
                    Przygotuj linki
                  </Button>
                ) : (
                  <>
                    <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                      {linkiKapitanow.map((l) => (
                        <li key={l.druzynaId} className="flex min-h-[44px] items-center gap-2 py-1.5 text-sm">
                          <span className="min-w-0 flex-1 break-words font-medium text-ink">{l.nazwa}</span>
                          {l.kod ? (
                            <button
                              type="button"
                              onClick={() => kopiuj(`${window.location.origin}/k/${l.kod}`, `Link kapitana: ${l.nazwa}`)}
                              className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-ink dark:border-slate-600"
                            >
                              Kopiuj link
                            </button>
                          ) : (
                            <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                              kapitan: {l.kapitan ?? 'jest'}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {linkiKapitanow.some((l) => l.kod) ? (
                      <Button
                        size="sm"
                        onClick={() => kopiuj(tekstLinkowKapitanow(turniej.nazwa, linkiKapitanow, window.location.origin), 'Komplet linków')}
                        className="w-full"
                      >
                        Kopiuj wszystkie linki (do wklejenia na WhatsApp)
                      </Button>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">Wszystkie drużyny mają kapitanów.</p>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-500">W turnieju ({wTurnieju.length})</h2>
              {/* Wiersz: nazwa (dwie linie, bez wielokropka) i pod nią skład,
                  po prawej wpisowe i usunięcie. „Link do drużyny” wypadł
                  (2026-11-21): rozpychał wiersz na telefonie, a link wysyła się
                  z ekranu drużyny (dotknięcie nazwy). */}
              {wTurnieju.map((d) => (
                <div key={d.id} className="flex items-center gap-2 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
                  <Link href={`/turnieje/${id}/druzyna/${d.id}`} className="min-w-0 flex-1">
                    <span className="block line-clamp-2 break-words font-medium text-ink">{d.nazwa}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
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
                  <button onClick={() => usunDruzyneZTurnieju(d)} className="flex h-11 w-11 shrink-0 items-center justify-center text-slate-400 hover:text-red-500" aria-label={`Usuń drużynę ${d.nazwa}`}>
                    <XIcon className="h-4 w-4" />
                  </button>
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
          <div id="terminarz" className="scroll-mt-32 space-y-6">
            {trwa && mecze.length > 0 && (
              <h2 className="hidden font-display text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 lg:block">
                Cały terminarz
              </h2>
            )}
            <div className="space-y-3">

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
                    {podglad.some((m) => m.faza !== 'grupa' && m.faza !== 'liga' && !m.zrodloAMeczId && !m.zrodloBMeczId && !!m.druzynaAId && !!m.druzynaBId) && (
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
                        const zGrupy = strona === 'a' ? m.zrodloAGrupaId : m.zrodloBGrupaId;
                        const miejsce = strona === 'a' ? m.zrodloAMiejsce : m.zrodloBMiejsce;
                        if (!druzynaId && zGrupy && miejsce) {
                          return (
                            <span className="text-slate-400">
                              {nazwaMiejscaWGrupie(grupyPoId.get(zGrupy)?.nazwa ?? '?', miejsce)}
                            </span>
                          );
                        }
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
                            {etykietaTerminuMeczu(m.zaplanowanyAt)}
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
                  {/* RĘCZNE GODZINY (Luboń, 2026-11-18). Harmonogram turnieju
                      charytatywnego miał przerwę na konkurs, dekorację i mecz
                      finałowy wpleciony między mecze grupy C: tego generator
                      nie zgadnie. Organizator przepisuje godziny z kartki,
                      a lista układa się po godzinie, nie po numerze. */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Mecze w kolejności godzin.</p>
                    {godzinyEdycja ? (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={zapiszGodziny} disabled={zapisujeGodziny}>
                          {zapisujeGodziny ? 'Zapisuję…' : 'Zapisz'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setGodzinyEdycja(null)} disabled={zapisujeGodziny}>
                          Anuluj
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setPrzerwaEdycja({ nazwa: '', od: '', do: '', opis: '' })}>
                          Dodaj przerwę
                        </Button>
                        <Button size="sm" variant="outline" onClick={zacznijEdycjeGodzin}>
                          {areny.length > 1 ? 'Zmień godziny i areny' : 'Zmień godziny'}
                        </Button>
                      </div>
                    )}
                  </div>
                  {/* PRZERWA Z NAZWĄ (176, Luboń): „Konkurs obijania poprzeczki”
                      z opisem „grupa C do 12:25” zamiast gołego „Przerwa”.
                      Nowa przerwa: formularz nad terminarzem. „Nazwij” i
                      „Edytuj”: w miejscu przerwy, bez przewijania (2026-11-21). */}
                  {przerwaEdycja && !przerwaEdycja.wiersz && formularzPrzerwy()}
                  {terminarzZPrzerwami(meczePoTerminie, przerwy, turniej).map((w) => {
                    if (w.typ === 'przerwa') {
                      const nazwana = w.przerwaId ? przerwy.find((p) => p.id === w.przerwaId) : undefined;
                      const klucz = w.przerwaId ?? `p-${w.od}`;
                      if (przerwaEdycja?.wiersz === klucz) return <div key={klucz}>{formularzPrzerwy()}</div>;
                      return (
                        <WierszPrzerwy
                          key={klucz}
                          od={w.od}
                          do={w.do}
                          nazwa={w.nazwa}
                          opis={w.opis}
                          akcja={godzinyEdycja ? undefined : nazwana
                            ? { etykieta: 'Edytuj', onClick: () => setPrzerwaEdycja({ id: nazwana.id, wiersz: klucz, nazwa: nazwana.nazwa, od: w.od, do: w.do, opis: nazwana.opis ?? '' }) }
                            : { etykieta: 'Nazwij', onClick: () => setPrzerwaEdycja({ wiersz: klucz, nazwa: '', od: w.od, do: w.do, opis: '' }) }}
                        />
                      );
                    }
                    const m = w.mecz;
                    const edytowalny = godzinyEdycja && m.status === 'zaplanowany' && !czyWolnyLos(m);
                    return (
                      <div key={m.id}>
                        {edytowalny ? (
                          <div className="flex items-center gap-2">
                            <div className="flex w-28 shrink-0 flex-col gap-1.5">
                              <input
                                type="time"
                                aria-label={`Godzina meczu M${m.numer}`}
                                value={godzinyEdycja[m.id] ?? ''}
                                onChange={(e) => setGodzinyEdycja((g) => (g ? { ...g, [m.id]: e.target.value } : g))}
                                className={`${inputCls} min-w-0 appearance-none px-2`}
                              />
                              {/* Arena tylko, gdy jest z czego wybierać. */}
                              {areny.length > 1 && (
                                <select
                                  aria-label={`Arena meczu M${m.numer}`}
                                  value={arenyEdycja[m.id] ?? ''}
                                  onChange={(e) => setArenyEdycja((a) => ({ ...a, [m.id]: e.target.value }))}
                                  className={`${inputCls} px-2 py-1.5 text-xs`}
                                >
                                  {!arenyEdycja[m.id] && <option value="">Arena…</option>}
                                  {areny.map((a) => <option key={a.id} value={a.id}>{a.nazwa}</option>)}
                                </select>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <KartaMeczu
                                mecz={m}
                                druzynyPoId={druzynyPoId}
                                meczePoId={meczePoId}
                                arenyPoId={arenyPoId}
                                grupyPoId={grupyPoId}
                              />
                            </div>
                          </div>
                        ) : (
                          <KartaMeczu
                            mecz={m}
                            druzynyPoId={druzynyPoId}
                            meczePoId={meczePoId}
                            arenyPoId={arenyPoId}
                            grupyPoId={grupyPoId}
                            przygaszona={czyWolnyLos(m)}
                            onClick={godzinyEdycja ? undefined : () => router.push(`/turnieje/${id}/mecz/${m.id}`)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* „Zakończ turniej” pod terminarzem, nie nad nim: to ostatni ruch dnia. */}
        {zakladka === 'terminarz' && turniej.status === 'trwa' && !proba && (
          <Button variant="outline" onClick={zakonczTurniej} className="w-full">
            Zakończ turniej
          </Button>
        )}

        {/* Ustawienia dla organizatora, admina i współorganizatora (178,
            2026-11-21). Współorganizatorowi brakuje tylko kasowania turnieju
            i nadawania praw dalej: tego RLS z 145 i tak by nie przepuścił. */}
        {zakladka === 'ustawienia' && uprawnienia?.mozeEdytowac && (
          <div key={wersjaUstawien} className={`space-y-5 ${maSzkic ? 'pb-24' : ''}`}>
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

            {/* WSPÓŁORGANIZATORZY (178): konto po e-mailu, pełne prawa do
                prowadzenia turnieju. Dodaje i usuwa tylko organizator. */}
            {uprawnienia?.jestOrganizatorem && (
              <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
                <div>
                  <h2 className="text-sm font-semibold text-ink">Współorganizatorzy</h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Mogą wszystko co Ty, poza usunięciem turnieju: wpisywać wyniki, zmieniać terminarz, drużyny i ustawienia.
                  </p>
                </div>
                {osoby.filter((o) => o.mozeEdytowac).map((o) => (
                  <div key={o.userId} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{o.imie ?? 'Współorganizator'}</span>
                    <button
                      onClick={() => usunWspolorganizatoraAkcja(o.userId, o.imie)}
                      className="flex h-11 w-11 shrink-0 items-center justify-center text-slate-400 hover:text-red-500"
                      aria-label={`Odbierz uprawnienia: ${o.imie ?? 'współorganizator'}`}
                    >
                      <XIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    value={emailWspolorganizatora}
                    onChange={(e) => setEmailWspolorganizatora(e.target.value)}
                    placeholder="E-mail konta w Bojo"
                    aria-label="E-mail współorganizatora"
                    className={inputCls}
                  />
                  <Button
                    size="sm"
                    onClick={dodajWspolorganizatoraAkcja}
                    disabled={!emailWspolorganizatora.includes('@')}
                    className="shrink-0 inline-flex items-center gap-1.5"
                  >
                    <Plus className="h-4 w-4" /> Dodaj
                  </Button>
                </div>
              </div>
            )}

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
                defaultValue={szkic.nazwa ?? turniej.nazwa}
                onChange={(e) => ustawWSzkicu('nazwa', e.target.value, turniej.nazwa)}
                className={inputCls}
              />
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Opis</label>
              <textarea
                defaultValue={szkic.opis ?? turniej.opis ?? ''}
                onChange={(e) => ustawWSzkicu('opis', e.target.value, turniej.opis ?? '')}
                rows={3}
                className={inputCls}
              />
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Regulamin</label>
              <textarea
                defaultValue={szkic.regulamin ?? turniej.regulamin ?? ''}
                onChange={(e) => ustawWSzkicu('regulamin', e.target.value, turniej.regulamin ?? '')}
                rows={3}
                className={inputCls}
              />
            </div>

            {/* EKRAN NA HALĘ (180, 2026-11-21): ogłoszenie i link ze zbiórką
                wpisuje się tu, w bazie, nie w adresie ekranu. Organizator
                zmienia je z telefonu, a ekran na rzutniku podchwytuje zmianę
                przy najbliższym odświeżeniu (15 s). Zapis tym samym paskiem
                „Zapisz zmiany” co reszta Ustawień. */}
            <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-ink">Ekran na halę</h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Wyniki, tabele i terminarz na rzutnik albo telewizor. Ogłoszenie i kod QR zbiórki pokażą się na ekranie.
                </p>
              </div>
              <label htmlFor="ekran-komunikat" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Ogłoszenie na ekranie</label>
              <textarea
                id="ekran-komunikat"
                defaultValue={szkic.ekranKomunikat ?? turniej.ekranKomunikat ?? ''}
                onChange={(e) => ustawWSzkicu('ekranKomunikat', e.target.value, turniej.ekranKomunikat ?? '')}
                rows={2}
                maxLength={280}
                placeholder="np. Gramy dla Marysi! Licytacja koszulki o 13:00 przy stoliku organizatora."
                className={inputCls}
              />
              <label htmlFor="ekran-link" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Link pod kodem QR (zbiórka, fundacja)</label>
              <input
                id="ekran-link"
                type="url"
                inputMode="url"
                defaultValue={szkic.ekranLink ?? turniej.ekranLink ?? ''}
                onChange={(e) => ustawWSzkicu('ekranLink', e.target.value, turniej.ekranLink ?? '')}
                maxLength={500}
                placeholder="np. zrzutka.pl/gramy-dla-marysi"
                className={inputCls}
              />
              <label htmlFor="ekran-link-opis" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Podpis przy kodzie</label>
              <input
                id="ekran-link-opis"
                defaultValue={szkic.ekranLinkOpis ?? turniej.ekranLinkOpis ?? ''}
                onChange={(e) => ustawWSzkicu('ekranLinkOpis', e.target.value, turniej.ekranLinkOpis ?? '')}
                maxLength={60}
                placeholder="np. Wesprzyj leczenie Marysi"
                className={inputCls}
              />
              <div className="border-t border-slate-100 pt-3 dark:border-slate-700">
                <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">Otwórz ekran</p>
                <WyborEkranu adresTurnieju={adresTurnieju} />
              </div>
            </div>

            {/* TERMIN, MIEJSCE I DRUŻYNY. Do 2026-11-08 po utworzeniu turnieju
                nie dało się zmienić żadnej z tych rzeczy: „jednak start o 9:00"
                kończyło się kasowaniem turnieju. Format zmienia się tylko przed
                pierwszym terminarzem, bo od niego zależy układ meczów. */}
            <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
              <h2 className="text-sm font-semibold text-ink">Termin, miejsce i drużyny</h2>
              {/* `items-end` + `min-w-0`: pola daty i godziny w Safari mają własną
                  minimalną szerokość i wychodziły poza kartę (zgłoszenie 2026-11-22). */}
              <div className="grid grid-cols-2 items-end gap-3">
                <div className="min-w-0">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Data startu</label>
                  <input
                    type="date"
                    defaultValue={szkic.dataStartu ?? turniej.dataStartu}
                    onChange={(e) => ustawWSzkicu('dataStartu', e.target.value, turniej.dataStartu)}
                    className={`${inputCls} min-w-0 appearance-none`}
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Godzina startu</label>
                  <input
                    type="time"
                    defaultValue={szkic.godzinaStartu ?? (turniej.godzinaStartu ?? '').slice(0, 5)}
                    onChange={(e) => ustawWSzkicu('godzinaStartu', e.target.value, (turniej.godzinaStartu ?? '').slice(0, 5))}
                    className={`${inputCls} min-w-0 appearance-none`}
                  />
                </div>
              </div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Miejsce</label>
              <input
                defaultValue={szkic.miejsceNazwa ?? turniej.miejsceNazwa ?? ''}
                maxLength={80}
                onChange={(e) => ustawWSzkicu('miejsceNazwa', e.target.value, turniej.miejsceNazwa ?? '')}
                className={inputCls}
              />
              <div className="grid grid-cols-2 items-end gap-3">
                <div className="min-w-0">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Maks. drużyn</label>
                  <input
                    type="number" min={2} max={64}
                    defaultValue={szkic.maxDruzyn ?? turniej.maxDruzyn}
                    onChange={(e) => ustawWSzkicu('maxDruzyn', Number(e.target.value), turniej.maxDruzyn)}
                    className={inputCls}
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Maks. zawodników w drużynie</label>
                  <input
                    type="number" min={1} max={40}
                    defaultValue={szkic.maxZawodnikow ?? turniej.maxZawodnikow}
                    onChange={(e) => ustawWSzkicu('maxZawodnikow', Number(e.target.value), turniej.maxZawodnikow)}
                    className={inputCls}
                  />
                </div>
              </div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Wpisowe za drużynę (zł)</label>
              <input
                type="text" inputMode="decimal"
                defaultValue={(() => {
                  const g = szkic.wpisoweGrosze ?? turniej.wpisoweGrosze;
                  return g > 0 ? String(g / 100) : '';
                })()}
                placeholder="0"
                onChange={(e) => ustawWSzkicu(
                  'wpisoweGrosze',
                  Math.max(0, Math.round((parseFloat(e.target.value.replace(',', '.')) || 0) * 100)),
                  turniej.wpisoweGrosze,
                )}
                className={inputCls}
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Format</label>
                <select
                  value={szkic.format ?? turniej.format}
                  disabled={mecze.length > 0}
                  onChange={(e) => ustawWSzkicu('format', e.target.value as Turniej['format'], turniej.format)}
                  className={inputCls}
                >
                  {(['grupy_puchar', 'grupy_finalowa', 'puchar', 'liga'] as const).map((f) => (
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
                  value={szkic.widocznosc ?? turniej.widocznosc}
                  onChange={(v) => ustawWSzkicu('widocznosc', v, turniej.widocznosc)}
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

            {/* ARENY w Ustawieniach, nie w terminarzu (2026-11-20). Arena to
                każde miejsce, gdzie w tym samym czasie toczy się mecz: boisko,
                hala, kort. Przy dwóch i więcej aren terminarz pozwala wskazać
                arenę każdego meczu („Zmień godziny i areny”). */}
            <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-ink">Areny</h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Boisko, hala, kort: każde miejsce, na którym w tym samym czasie gra się mecz.
                </p>
              </div>
              {areny.map((a) => (
                <div key={a.id} className="flex items-center gap-2">
                  <input
                    defaultValue={szkicAren[a.id] ?? a.nazwa}
                    aria-label={`Nazwa areny ${a.nazwa}`}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSzkicAren((s) => {
                        const nowy = { ...s };
                        if (v.trim() === a.nazwa || v.trim() === '') delete nowy[a.id]; else nowy[a.id] = v;
                        return nowy;
                      });
                    }}
                    className={inputCls}
                  />
                  {areny.length > 1 && (
                    <button onClick={() => usunAreneAkcja(a.id)} className="flex h-11 w-11 shrink-0 items-center justify-center text-slate-400 hover:text-red-500" aria-label={`Usuń arenę ${a.nazwa}`}>
                      <XIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  value={nowaArenaNazwa}
                  onChange={(e) => setNowaArenaNazwa(e.target.value)}
                  placeholder="np. Hala B, Kort 1"
                  aria-label="Nazwa nowej areny"
                  className={inputCls}
                />
                <Button size="sm" variant="outline" onClick={dodajAreneAkcja} disabled={nowaArenaNazwa.trim().length < 1} className="shrink-0 inline-flex items-center gap-1.5">
                  <Plus className="h-4 w-4" /> Dodaj
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
              <h2 className="text-sm font-semibold text-ink">Zasady gry</h2>
              <ZasadyGry
                format={szkic.format ?? turniej.format}
                wartosci={zasadyEdycja ?? zasadyTurnieju}
                onChange={(z) => setZasadyEdycja((w) => {
                  const nowe = { ...(w ?? zasadyTurnieju), ...z };
                  // Powrót do wartości z bazy zdejmuje szkic zasad.
                  const bezZmian = (Object.keys(nowe) as (keyof WartosciZasad)[]).every((k) => nowe[k] === zasadyTurnieju[k]);
                  return bezZmian ? null : nowe;
                })}
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
                defaultValue={(szkic.zapisyDo ?? turniej.zapisyDo ?? '').slice(0, 10)}
                max={szkic.dataStartu ?? turniej.dataStartu}
                onChange={(e) => {
                  const zBazy = turniej.zapisyDo ? `${turniej.zapisyDo.slice(0, 10)}T23:59:59` : '';
                  ustawWSzkicu('zapisyDo', e.target.value ? `${e.target.value}T23:59:59` : '', zBazy);
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
                {uprawnienia?.jestOrganizatorem && (
                  <button onClick={usunTurniej} className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" /> Usuń turniej
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      </main>
      {/* Przyklejony do dołu, nad dolną nawigacją: widać go niezależnie od
          tego, które pole się zmieniło. */}
      {zakladka === 'ustawienia' && maSzkic && (
        <div
          className="fixed inset-x-0 z-[1210] border-t border-slate-200 bg-white/95 backdrop-blur shadow-[0_-2px_16px_rgba(0,0,0,0.08)] dark:border-slate-700 dark:bg-slate-800/95"
          style={{ bottom: 'var(--bottom-nav-h)' }}
        >
          <div className="mx-auto flex max-w-2xl gap-2 px-4 py-3">
            <Button variant="outline" onClick={odrzucSzkic} disabled={zapisujeUstawienia} className="shrink-0">Odrzuć</Button>
            <Button onClick={zapiszSzkic} disabled={zapisujeUstawienia} className="flex-1">
              {zapisujeUstawienia ? 'Zapisuję…' : 'Zapisz zmiany'}
            </Button>
          </div>
        </div>
      )}
      {oknoPotwierdzenia}
    </div>
  );
}
