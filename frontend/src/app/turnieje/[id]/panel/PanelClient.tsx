'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Copy, Download, Plus, Check, X as XIcon, Trash2, Ban, ChevronRight } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import ToggleRow from '@/components/ui/ToggleRow';
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
  getTurniej, uprawnieniaTurnieju, getOsobyTurnieju, setUprawnieniaOsoby,
  usunOsobeZTurnieju, updateTurniej, setStatusTurnieju, deleteTurniej,
  getBlikTurnieju, ustawBlikTurnieju, setOkladkaTurnieju,
} from '@/lib/turnieje';
import {
  getDruzynyZeSkladem, setStatusDruzyny, dodajDruzyneRecznie, getKontakty, usunDruzyne,
  ustawGrupeDruzyny, setWpisowe,
} from '@/lib/turniejDruzyny';
import {
  getGrupy, dodajGrupe, usunGrupe, getAreny, dodajArene, zmienNazweAreny, usunArene,
  getMecze, zapiszTerminarz, przesunTerminarz,
} from '@/lib/turniejMecze';
import {
  domyslnaLiczbaGrup, rozlosujGrupy, meczeKazdyZKazdym, zbudujDrabinke, ulozHarmonogram,
  szacunekCzasu, type NowyMecz,
} from '@/lib/turniejFormat';
import { odmienZawodnikow, odmienDruzyny, etykietaTerminu } from '@/lib/turniejEtykiety';
import { pulpitPrzedTurniejem, opoznienieWMinutach, arenyTeraz } from '@/lib/turniejPulpit';
import { plural, withCount } from '@/lib/plural';
import type { Turniej, TurniejDruzyna, TurniejOsoba, TurniejGrupa, TurniejArena, TurniejMecz } from '@/types';
import type { KontaktDruzyny } from '@/lib/turniejDruzyny';

type PanelTab = 'pulpit' | 'druzyny' | 'ludzie' | 'terminarz' | 'ustawienia';

// Etykiety, nie surowe klucze z CSS-owym `capitalize`. Tamto wypisywało
// `Druzyny` bez ogonka, bo klucz jest bez polskich znaków (i musi być, bo
// idzie do adresu jako `?tab=`). Zgłoszone z testu na żywo.
const ETYKIETY_PANELU: Record<PanelTab, string> = {
  pulpit: 'Pulpit',
  druzyny: 'Drużyny',
  ludzie: 'Ludzie',
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
  const [szukajOsoby, setSzukajOsoby] = useState('');
  const [nowaArenaNazwa, setNowaArenaNazwa] = useState('');
  const [liczbaGrupWybor, setLiczbaGrupWybor] = useState<number | null>(null);
  const [podglad, setPodglad] = useState<NowyMecz[] | null>(null);
  const [przesunMeczId, setPrzesunMeczId] = useState('');
  const [przesunMinuty, setPrzesunMinuty] = useState(15);
  const [blikTelefon, setBlikTelefon] = useState<string | null>(null);
  const [blikWpis, setBlikWpis] = useState('');

  const tabParam = searchParams.get('tab');
  // Domyślnie PULPIT, nie „Drużyny": organizator wchodzi w panel z pytaniem
  // „jak mi idzie" (przed turniejem) albo „co się dzieje" (w jego dniu),
  // a nie po to, żeby przeczytać listę drużyn.
  const zakladka: PanelTab =
    tabParam === 'druzyny' ? 'druzyny'
      : tabParam === 'ludzie' ? 'ludzie'
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

  const kandydaci = useMemo(() => {
    const wKlubie = new Set(osoby.map((o) => o.userId));
    const widziani = new Map<string, string>();
    druzyny.forEach((d) => {
      d.zawodnicy?.forEach((z) => {
        if (z.userId && !wKlubie.has(z.userId)) widziani.set(z.userId, z.imie);
      });
    });
    const lista = Array.from(widziani, ([userId, imie]) => ({ userId, imie }));
    if (!szukajOsoby.trim()) return lista;
    const q = szukajOsoby.trim().toLowerCase();
    return lista.filter((k) => k.imie.toLowerCase().includes(q));
  }, [druzyny, osoby, szukajOsoby]);

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

  const dodajOsobe = async (userId: string) => {
    try { await setUprawnieniaOsoby(id, userId, { mozeProwadzic: true }); await wczytaj(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Nie udało się dodać osoby', 'error'); }
  };

  const zmienUprawnienie = async (userId: string, pole: 'mozeEdytowac' | 'mozeProwadzic' | 'mozeZarzadzacDruzynami', wartosc: boolean) => {
    try { await setUprawnieniaOsoby(id, userId, { [pole]: wartosc }); await wczytaj(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Nie udało się zapisać uprawnienia', 'error'); }
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
  const rozegranych = mecze.filter(
    (m) => m.status === 'zakonczony' || m.status === 'walkower' || m.status === 'trwa',
  ).length;
  const rezerwa = druzyny.filter((d) => d.status === 'rezerwa');

  const potrzebujeGrup = turniej.format === 'grupy_puchar';
  const liczbaGrupDomyslna = domyslnaLiczbaGrup(wTurnieju.length);

  const losujGrupy = async () => {
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
      const podzial = rozlosujGrupy(wTurnieju, n);
      for (let i = 0; i < podzial.length; i++) {
        const g = await dodajGrupe(id, LITERY_GRUP[i] ?? `G${i + 1}`);
        await Promise.all(podzial[i].map((d) => ustawGrupeDruzyny(d.id, g.id)));
      }
      setPodglad(null);
      await wczytaj();
      toast('Grupy wylosowane');
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
  const opoznienie = opoznienieWMinutach(mecze);
  const areny_teraz = arenyTeraz(areny, mecze);
  const meczeDoPrzesuniecia = mecze
    .filter((m) => m.status === 'zaplanowany' && m.zaplanowanyAt)
    .sort((a, b) => a.zaplanowanyAt!.localeCompare(b.zaplanowanyAt!));
  const nazwaDruzynyPanel = (druzynaId?: string) =>
    (druzynaId ? druzyny.find((d) => d.id === druzynaId)?.nazwa : undefined) ?? 'TBD';

  /** Obsuwa do pełnych pięciu minut — organizator myśli „o dziesięć", nie
   *  „o siedem". Minimum pięć, żeby przycisk nigdy nie proponował zera. */
  const zaokraglijDo5 = (minuty: number) => Math.max(5, Math.round(minuty / 5) * 5);

  const przesunOdNajblizszego = async () => {
    const pierwszy = meczeDoPrzesuniecia[0];
    if (!pierwszy || opoznienie === null) return;
    try {
      await przesunTerminarz(id, pierwszy.id, zaokraglijDo5(opoznienie));
      await wczytaj();
      toast('Terminarz przesunięty');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się przesunąć terminarza', 'error');
    }
  };

  const przesunAkcja = async () => {
    if (!przesunMeczId) return;
    try {
      await przesunTerminarz(id, przesunMeczId, przesunMinuty);
      await wczytaj();
      toast('Terminarz przesunięty');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się przesunąć terminarza', 'error');
    }
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
          {(['pulpit', 'druzyny', 'ludzie', 'terminarz', 'ustawienia'] as PanelTab[]).map((z) => (
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
            {/* W DNIU TURNIEJU pulpit jest wieżą kontrolną, a nie listą zadań:
                co trwa na każdej arenie, co jest następne i o ile jesteśmy
                spóźnieni. „Przesuń resztę" stoi TUTAJ, a nie w zakładce
                Terminarz, bo to jest ekran, w który organizator zagląda co
                kwadrans — plan modułu nazywa ten przycisk najmocniejszą
                funkcją organizatorską i trzymanie go dwa dotknięcia dalej
                było jej marnowaniem. */}
            {turniej.status === 'trwa' ? (
              <>
                <div className="rounded-2xl border border-primary-100 dark:border-primary-900 bg-primary-50/60 dark:bg-primary-950/30 p-4">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                    <span className="inline-block h-2 w-2 rounded-full bg-primary-600" /> Turniej trwa
                  </p>
                  <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                    {opoznienie === null
                      ? 'Idziecie zgodnie z planem.'
                      : `Opóźnienie: +${opoznienie} min względem terminarza.`}
                  </p>
                  {opoznienie !== null && meczeDoPrzesuniecia.length > 0 && (
                    <Button
                      variant="outline"
                      onClick={przesunOdNajblizszego}
                      className="mt-3 w-full"
                    >
                      Przesuń resztę o {zaokraglijDo5(opoznienie)} min
                    </Button>
                  )}
                </div>

                {areny_teraz.map(({ arena, trwa, nastepny }) => (
                  <div key={arena.id} className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{arena.nazwa}</p>
                    {trwa && (
                      <button
                        onClick={() => router.push(`/turnieje/${id}/mecz/${trwa.id}`)}
                        className="mt-1 flex w-full items-center gap-2 text-left"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                          ▶ {nazwaDruzynyPanel(trwa.druzynaAId)} – {nazwaDruzynyPanel(trwa.druzynaBId)}
                        </span>
                        <span className="shrink-0 font-mono text-base font-bold text-ink">
                          {trwa.wynikA}:{trwa.wynikB}
                        </span>
                      </button>
                    )}
                    {nastepny && (
                      <button
                        onClick={() => router.push(`/turnieje/${id}/mecz/${nastepny.id}`)}
                        className="mt-1 block w-full truncate text-left text-sm text-slate-500 dark:text-slate-400"
                      >
                        {nastepny.zaplanowanyAt ? `${nastepny.zaplanowanyAt.slice(11, 16)} ` : 'potem '}
                        {nazwaDruzynyPanel(nastepny.druzynaAId)} – {nazwaDruzynyPanel(nastepny.druzynaBId)}
                      </button>
                    )}
                  </div>
                ))}
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

                <Link href={`/turnieje/${id}`}>
                  <Button variant="outline" className="w-full">Zobacz turniej oczami kapitana</Button>
                </Link>
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
                <div key={d.id} className="flex items-center gap-2 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
                  <span className="min-w-0 flex-1 truncate text-ink">{d.nazwa}</span>
                  <span className="text-xs text-slate-400">{odmienZawodnikow(d.liczbaZawodnikow ?? 0)}</span>
                  {turniej.wpisoweGrosze > 0 && (
                    <button
                      onClick={() => przelaczOplacone(d)}
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${d.wpisoweOplaconeAt ? 'bg-primary-50 text-primary-700' : 'bg-slate-100 text-slate-500'}`}
                    >
                      {d.wpisoweOplaconeAt ? 'Opłacone ✓' : 'Nieopłacone'}
                    </button>
                  )}
                  <button onClick={() => kopiuj(`${window.location.origin}/t/${d.kodDolaczenia}`, 'Link drużyny')} className="text-slate-400 hover:text-ink" aria-label="Kopiuj link"><Copy className="h-4 w-4" /></button>
                  <button onClick={() => usunDruzyneZTurnieju(d)} className="text-slate-400 hover:text-red-500" aria-label="Usuń drużynę"><XIcon className="h-4 w-4" /></button>
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

        {zakladka === 'ludzie' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-500">Uprawnieni</h2>
              {osoby.length === 0 && <p className="text-sm text-slate-400">Tylko Ty zarządzasz tym turniejem.</p>}
              {osoby.map((o) => (
                <div key={o.userId} className="rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-3.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-medium text-ink">{o.imie ?? 'Osoba'}</span>
                    <button onClick={() => usunOsobeZTurnieju(id, o.userId).then(wczytaj)} className="text-slate-400 hover:text-red-500" aria-label="Usuń uprawnienia"><XIcon className="h-4 w-4" /></button>
                  </div>
                  <ToggleRow label="Może prowadzić mecze" desc="Rozpoczyna i kończy mecze, wpisuje gole" checked={o.mozeProwadzic} onChange={(v) => zmienUprawnienie(o.userId, 'mozeProwadzic', v)} />
                  <ToggleRow label="Może zarządzać drużynami" desc="Przyjmuje zgłoszenia, dodaje i wycofuje drużyny" checked={o.mozeZarzadzacDruzynami} onChange={(v) => zmienUprawnienie(o.userId, 'mozeZarzadzacDruzynami', v)} />
                  {uprawnienia?.jestOrganizatorem && (
                    <ToggleRow label="Może edytować turniej" desc="Wszystko powyżej plus ustawienia i terminarz" checked={o.mozeEdytowac} onChange={(v) => zmienUprawnienie(o.userId, 'mozeEdytowac', v)} />
                  )}
                </div>
              ))}
            </div>

            {uprawnienia?.jestOrganizatorem && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-500">Dodaj osobę</h2>
                <input value={szukajOsoby} onChange={(e) => setSzukajOsoby(e.target.value)} placeholder="Szukaj wśród kapitanów i zawodników…" className={inputCls} />
                <div className="space-y-1.5">
                  {kandydaci.slice(0, 8).map((k) => (
                    <button key={k.userId} onClick={() => dodajOsobe(k.userId)} className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm text-ink hover:bg-slate-50 dark:hover:bg-slate-800">
                      <span className="truncate">{k.imie}</span>
                      <Plus className="h-4 w-4 text-primary-600" />
                    </button>
                  ))}
                  {szukajOsoby && kandydaci.length === 0 && <p className="text-sm text-slate-400">Nikogo nie znaleziono.</p>}
                </div>
              </div>
            )}
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
                    <Button size="sm" onClick={losujGrupy} disabled={wTurnieju.length < 2}>Losuj grupy</Button>
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
                    {grupy.map((g) => (
                      <div key={g.id} className="rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
                        <p className="text-xs font-semibold text-slate-400">Grupa {g.nazwa}</p>
                        <p className="text-sm text-ink">
                          {odmienDruzyny(wTurnieju.filter((d) => d.grupaId === g.id).length)}:{' '}
                          {wTurnieju.filter((d) => d.grupaId === g.id).map((d) => d.nazwa).join(', ') || '-'}
                        </p>
                      </div>
                    ))}
                    <button onClick={losujGrupy} className="text-sm font-medium text-primary-600">Losuj ponownie</button>
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
                    {podglad.map((m) => (
                      <div key={m.id} className="rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm">
                        <span className="text-xs text-slate-400">M{m.numer}</span>{' '}
                        <span className="text-ink">{druzynyPoId.get(m.druzynaAId ?? '') ?? (m.zrodloAMeczId ? 'TBD' : '-')}</span>
                        {' vs '}
                        <span className="text-ink">{druzynyPoId.get(m.druzynaBId ?? '') ?? (m.zrodloBMeczId ? 'TBD' : '-')}</span>
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
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={zapiszPodgladTerminarza}>Zapisz terminarz</Button>
                    <Button size="sm" variant="outline" onClick={() => setPodglad(null)}>Anuluj</Button>
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
                      {plural(rozegranych, 'Rozegrano już', 'Rozegrano już', 'Rozegrano już')}{' '}
                      {withCount(rozegranych, 'mecz', 'mecze', 'meczów')}, więc terminarz da się
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
                      onClick={() => router.push(`/turnieje/${id}/mecz/${m.id}`)}
                    />
                  ))}
                  <div className="flex flex-wrap items-end gap-2 pt-2">
                    <div>
                      <label className="block text-xs text-slate-500">Przesuń od meczu</label>
                      <select value={przesunMeczId} onChange={(e) => setPrzesunMeczId(e.target.value)} className={`${inputCls} py-1.5`}>
                        <option value="">Wybierz…</option>
                        {mecze.filter((m) => m.status === 'zaplanowany').map((m) => (
                          <option key={m.id} value={m.id}>M{m.numer}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500">O ile minut</label>
                      <input
                        type="number" value={przesunMinuty || ''}
                        onChange={(e) => setPrzesunMinuty(e.target.value === '' ? 0 : Number(e.target.value))}
                        className={`${inputCls} w-24 py-1.5`}
                      />
                    </div>
                    <Button size="sm" variant="outline" onClick={przesunAkcja} disabled={!przesunMeczId}>Przesuń</Button>
                  </div>
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

            {/* Okładka pojawia się dziś jedynie jako miniatura na liście
                turniejów (`t.okladkaUrl` w `KartaTurnieju`) — pole i
                `setOkladkaTurnieju()` istniały od Etapu 0 modułu, ale bez
                miejsca w interfejsie, żeby je ustawić. */}
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
                onBlur={(e) => e.target.value.trim() !== turniej.nazwa && updateTurniej(id, { nazwa: e.target.value }).then(wczytaj)}
                className={inputCls}
              />
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Opis</label>
              <textarea
                defaultValue={turniej.opis ?? ''}
                onBlur={(e) => updateTurniej(id, { opis: e.target.value }).then(wczytaj)}
                rows={3}
                className={inputCls}
              />
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Regulamin</label>
              <textarea
                defaultValue={turniej.regulamin ?? ''}
                onBlur={(e) => updateTurniej(id, { regulamin: e.target.value }).then(wczytaj)}
                rows={3}
                className={inputCls}
              />
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
                  updateTurniej(id, { zapisyDo: nowa }).then(wczytaj);
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
