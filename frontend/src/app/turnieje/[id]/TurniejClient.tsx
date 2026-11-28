'use client';

import WierszMeczu from '@/components/turnieje/WierszMeczu';
import { SHOW_TURNIEJ_OGLOSZENIA } from '@/lib/features';
import { useAdmin } from '@/lib/admin';
import { useAdres, useAdresWPasku } from '@/lib/useAdres';
import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, MapPin, Users, Navigation, Share2, ChevronDown, ChevronRight, Trophy, Wallet, UserRound, Bell, BellRing } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { usePotwierdzenie } from '@/lib/usePotwierdzenie';
import {
  getTurniej, uprawnieniaTurnieju, getMojaOsobe, przyjmujeZgloszenia,
  getOgloszenia, dodajOgloszenie, usunOgloszenie, getBlikTurnieju,
  domyslnaZakladka, czyTurniejProbny, czyObserwujeTurniej, obserwujTurniej } from '@/lib/turnieje';
import { getDruzyny, getDruzynyZeSkladem, getMojaDruzyne, zamienDruzyneWEkipe } from '@/lib/turniejDruzyny';
import { getMecze, getAreny, getGrupy, getZdarzeniaTurnieju, getPrzerwy } from '@/lib/turniejMecze';
import WierszPrzerwy from '@/components/turnieje/WierszPrzerwy';
import { chwilaWPolsce } from '@/lib/czasPolski';
import { FAZA_LABEL, FORMAT_LABEL, opisFormatu, etykietaTerminu, stanTurnieju, stanZapisowTurnieju, liczDruzynyWTurnieju, liczCzekajaceZgloszenia, etykietaZdobyczy, etykietaTerminuMeczu, porownajTermin, terminarzZPrzerwami, meczPrzed, zawezDoMeczow } from '@/lib/turniejEtykiety';
import { najpierwMoje, opisAwansu, tabeleTurnieju } from '@/lib/turniejTabela';
import { obliczKlasyfikacje, posortujKlasyfikacje } from '@/lib/turniejStatystyki';
import { linkDoTurnieju, udostepnijTurniej } from '@/lib/turniejShare';
import { getZdjecia, getSponsorzy } from '@/lib/turniejGaleria';
import { podiumTurnieju, tekstPodium, medal } from '@/lib/turniejPodium';
import { linkDojazdu } from '@/lib/utils';
import { withCount } from '@/lib/plural';
import { sportEmoji } from '@/lib/sports';
import TabelaGrupy from '@/components/turnieje/TabelaGrupy';
import Drabinka from '@/components/turnieje/Drabinka';
import Klasyfikacja from '@/components/turnieje/Klasyfikacja';
import Ogloszenia from '@/components/turnieje/Ogloszenia';
import Galeria from '@/components/turnieje/Galeria';
import Sponsorzy from '@/components/turnieje/Sponsorzy';
import ProsbyDoRozpatrzenia from '@/components/turnieje/ProsbyDoRozpatrzenia';
import RamkaTurnieju, { SZEROKOSC_TURNIEJU } from '@/components/turnieje/RamkaTurnieju';
import KartaDruzyny from '@/components/turnieje/KartaDruzyny';
import { nazwaSlotu } from '@/components/turnieje/KartaMeczu';
import SciankaLogowania from '@/components/turnieje/SciankaLogowania';
import type { Turniej, TurniejDruzyna, TurniejOsoba, TurniejMecz, TurniejArena, TurniejGrupa, TurniejZdarzenie, TurniejOgloszenie, TurniejZdjecie, TurniejSponsor, TurniejPrzerwa } from '@/types';
import { czyWolnyLos } from '@/lib/turniejWynik';

// Sześć zakładek zamiast czterech. „Terminarz" i „Wyniki" dzieliły wcześniej
// ten sam zbiór meczów, a tabela i drabinka siedziały razem w „Wynikach" —
// czyli jedna zakładka odpowiadała na trzy różne pytania naraz („kiedy gramy",
// „jak poszło", „kto awansuje"). Dziś każde ma swoje miejsce, a zakładki bez
// treści (tabela bez grup, drabinka bez fazy pucharowej) w ogóle się nie
// pokazują — pusta zakładka jest gorsza niż jej brak.
// TRZY zakładki, nie sześć — po przeglądzie modułu na żywo (2026-09-17).
//
// Sześć nie mieściło się w szerokości telefonu: „Drabinka" była ucięta, więc
// istniała wyłącznie dla kogoś, kto pomyślał, żeby przewinąć pasek w bok.
// Do tego połowa z nich pokazywała TE SAME karty meczów w innym opakowaniu:
// Terminarz mecze przyszłe, Wyniki te same karty po rozegraniu, Drabinka
// jeszcze raz półfinały i finał.
//
// „Info" WRACA jako zakładka (2026-09-19) — cofnięcie jednej, konkretnej
// części decyzji z 2026-09-17. Wtedy pełna karta (termin, miejsce, format,
// zasady, wpisowe, organizator, opis, regulamin) przeniosła się na sam
// początek strony jako „nagłówek", ale to znaczyło, że zasłania górną część
// KAŻDEJ zakładki — na Tabeli i drabince trzeba było przewinąć ją całą, żeby
// zobaczyć samą tabelę. Zostaje po niej jeden skondensowany wiersz (emoji,
// status, termin skrócony, liczba drużyn, Udostępnij) widoczny zawsze —
// to jest treść, której czytający potrzebuje niezależnie od tego, na którą
// zakładkę patrzy. Reszta wraca do bycia zakładką, bo to właśnie „rzecz do
// porównania" z resztą — ktoś, kto już wie, kiedy grają, nie musi jej wcale
// otwierać.
type Zakladka = 'info' | 'mecze' | 'tabela' | 'druzyny';


type WidokMeczow = 'najblizsze' | 'rozegrane';

/** Rozegrane mecze jednej grupy, zwinięte pod jej tabelą. */
function MeczeGrupy({ mecze, wiersz }: {
  mecze: TurniejMecz[];
  /** Jak narysować mecz (`WierszMeczu`, jeden wiersz). */
  wiersz: (m: TurniejMecz) => React.ReactNode;
}) {
  const [rozwiniete, setRozwiniete] = useState(false);
  if (mecze.length === 0) return null;
  return (
    <div>
      <button
        onClick={() => setRozwiniete((v) => !v)}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary-600"
        aria-expanded={rozwiniete}
      >
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${rozwiniete ? 'rotate-180' : ''}`} />
        {rozwiniete ? 'Zwiń' : `Wyniki i terminarz (${mecze.length})`}
      </button>
      {rozwiniete && (
        <div className="mt-2 space-y-2">
          {mecze.map(wiersz)}
        </div>
      )}
    </div>
  );
}

export default function TurniejClient() {
  const { id } = useParams<{ id: string }>();
  const jestAdmin = useAdmin();
  // Adres z nazwą (177): do linków udostępniania i do paska przeglądarki.
  const adresTurnieju = useAdres('turniej', id);
  useAdresWPasku({ [id]: adresTurnieju });
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const { potwierdz, oknoPotwierdzenia } = usePotwierdzenie();
  // Do listy turniejów tylko z linku (pusta historia). Na ten ekran prowadzi
  // też karta meczu, profil gracza i link z WhatsAppa, a `router.push` na
  // sztywnego rodzica odbijał wtedy systemowe „wstecz" z powrotem tutaj.

  const [turniej, setTurniej] = useState<Turniej | null>(null);
  const [druzyny, setDruzyny] = useState<TurniejDruzyna[]>([]);
  const [osoba, setOsoba] = useState<TurniejOsoba | null>(null);
  const [mecze, setMecze] = useState<TurniejMecz[]>([]);
  const [areny, setAreny] = useState<TurniejArena[]>([]);
  const [przerwy, setPrzerwy] = useState<TurniejPrzerwa[]>([]);
  const [grupy, setGrupy] = useState<TurniejGrupa[]>([]);
  const [zdarzenia, setZdarzenia] = useState<TurniejZdarzenie[]>([]);
  const [ogloszenia, setOgloszenia] = useState<TurniejOgloszenie[]>([]);
  /** Ogłoszeń nie dało się wczytać — puste miejsce ma powiedzieć co innego niż „nie ma ogłoszeń". */
  const [ogloszeniaBlad, setOgloszeniaBlad] = useState(false);
  const [zdjecia, setZdjecia] = useState<TurniejZdjecie[]>([]);
  const [sponsorzy, setSponsorzy] = useState<TurniejSponsor[]>([]);
  const [mojaDruzyna, setMojaDruzyna] = useState<TurniejDruzyna | null>(null);
  const [blikTelefon, setBlikTelefon] = useState<string | null>(null);
  const [ladowanie, setLadowanie] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [bladWczytania, setBladWczytania] = useState(false);
  const [widokReczny, setWidokReczny] = useState<WidokMeczow | null>(null);
  // `null` = użytkownik jeszcze nie wybrał, więc obowiązuje domyślne „nasze"
  // dla kogoś, kto w turnieju gra.
  const [tylkoNaszeReczne, setTylkoNaszeReczne] = useState<boolean | null>(null);
  const [organizator, setOrganizator] = useState<string | null>(null);
  // OBSERWOWANIE (184, 2026-11-22): kibic albo zawodnik bez drużyny ma
  // turniej na koncie („Moje mecze”, „/turnieje” → Moje) bez szukania linku.
  const [obserwuje, setObserwuje] = useState(false);
  const [obserwujeZapis, setObserwujeZapis] = useState(false);
  useEffect(() => {
    if (!user) { setObserwuje(false); return; }
    let aktualne = true;
    czyObserwujeTurniej(id, user.id).then((w) => { if (aktualne) setObserwuje(w); });
    return () => { aktualne = false; };
  }, [id, user]);
  const przelaczObserwowanie = async () => {
    if (!user) return;
    setObserwujeZapis(true);
    try {
      await obserwujTurniej(id, user.id, !obserwuje);
      setObserwuje(!obserwuje);
      toast(obserwuje ? 'Nie obserwujesz już turnieju' : 'Obserwujesz. Turniej jest w „Moje mecze”');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się zapisać', 'error');
    } finally {
      setObserwujeZapis(false);
    }
  };

  // ODŚWIEŻANIE CO 20 SEKUND, gdy turniej trwa. Plan (§10) zakładał je od
  // początku — świadomie zamiast Supabase Realtime, który wymaga ręcznego
  // włączenia replikacji („działa u mnie, milczy na produkcji"). W kodzie nie
  // było ani jednego `setInterval`, więc wynik „na żywo" wymagał pociągnięcia
  // strony w dół, czyli nie był na żywo.
  //
  // Odświeżamy WYŁĄCZNIE to, co się zmienia w trakcie gry (mecze i zdarzenia),
  // nie cały komplet: drużyny, grupy i areny stoją w miejscu, a turniej na
  // 200 meczów odpytywany co 20 sekund komplet by odczuł.
  const turniejTrwa = !!turniej && turniej.status === 'trwa';
  useEffect(() => {
    if (!turniejTrwa) return;
    // 15 s i od razu po powrocie do karty (2026-11-27): telefon wyjęty
    // z kieszeni pokazywał wynik sprzed kilku minut.
    const odswiez = () => {
      if (document.visibilityState !== 'visible') return;
      Promise.all([getMecze(id), getZdarzeniaTurnieju(id)])
        .then(([m, z]) => { setMecze(m); setZdarzenia(z); })
        .catch(() => undefined);
    };
    const czasomierz = setInterval(odswiez, 15_000);
    document.addEventListener('visibilitychange', odswiez);
    return () => { clearInterval(czasomierz); document.removeEventListener('visibilitychange', odswiez); };
  }, [turniejTrwa, id]);

  const tabParam = searchParams.get('tab');
  // Stare adresy (`?tab=terminarz`, `?tab=wyniki`, `?tab=drabinka`) prowadzą
  // tam, gdzie ich treść dziś mieszka.
  //
  // BRAK `?tab=` NIE ZNACZY JUŻ „Mecze". Domyślną liczy `domyslnaZakladka()`
  // ze stanu turnieju i z tego, co jest do zobaczenia — funkcja istniała od
  // migracji `145` i nie była podpięta, więc KAŻDY link udostępniony w okresie
  // zapisów (czyli każdy link, jaki organizator wysyła na Facebooka) lądował
  // na napisie „Terminarz jeszcze nie jest gotowy".
  const zakladkaZAdresu: Zakladka | null =
    tabParam === 'info' ? 'info'
      : tabParam === 'druzyny' ? 'druzyny'
      : tabParam === 'tabela' || tabParam === 'drabinka' ? 'tabela'
      : tabParam === 'mecze' || tabParam === 'terminarz' || tabParam === 'wyniki' ? 'mecze'
      : null;
  const widokZAdresu: WidokMeczow | null =
    tabParam === 'wyniki' ? 'rozegrane' : tabParam === 'terminarz' ? 'najblizsze' : null;

  useEffect(() => {
    let aktualne = true;
    setLadowanie(true);
    // DWA ETAPY (2026-11-28, „czasami długo ładuje”). Strona czekała na
    // jedenaście zapytań naraz, w tym składy wszystkich drużyn, gole, galerię
    // i sponsorów, zanim pokazała cokolwiek. Teraz:
    //  1. RAZEM Z TURNIEJEM (równolegle, nie po nim): drużyny bez składów,
    //     mecze, grupy i to, co dotyczy MNIE (uprawnienia, moja drużyna).
    //     Tyle wystarcza, żeby narysować każdą zakładkę.
    //  2. W TLE, gdy strona już stoi: składy, zdarzenia (strzelcy), boiska,
    //     przerwy, ogłoszenia, galeria, sponsorzy, BLIK, organizator.
    //
    // `allSettled`, NIE `all`, z tego samego powodu co wcześniej: baza bez
    // migracji `150` nie miała `turniej_ogloszenia` i `Promise.all` zamieniał
    // brak jednej sekcji w „Nie znaleziono turnieju”. Każda sekcja ma własny
    // stan pusty; „nie znaleziono” znaczy wyłącznie brak samego turnieju.
    const wynik = <T,>(r: PromiseSettledResult<T>, zapas: T): T => (r.status === 'fulfilled' ? r.value : zapas);
    Promise.all([
      getTurniej(id),
      Promise.allSettled([
        getDruzyny(id),
        getMecze(id),
        getGrupy(id),
        user ? getMojaOsobe(id, user.id) : Promise.resolve(null),
        user ? getMojaDruzyne(id, user.id) : Promise.resolve(null),
      ]),
    ])
      .then(([t, [d, m, g, o, mj]]) => {
        if (!aktualne) return;
        if (!t) { setNotFound(true); return; }
        setTurniej(t);
        setDruzyny(wynik(d, []));
        setMecze(wynik(m, []));
        setGrupy(wynik(g, []));
        setOsoba(wynik(o, null));
        setMojaDruzyna(wynik(mj, null));
        setLadowanie(false);

        // ── Etap 2: w tle ──────────────────────────────────────────────────
        void Promise.allSettled([
          user ? getDruzynyZeSkladem(id) : Promise.resolve(null),
          getAreny(id),
          getZdarzeniaTurnieju(id),
          getOgloszenia(id),
          getZdjecia(id),
          getSponsorzy(id),
          getPrzerwy(id),
        ]).then(([sklady, a, z, og, zd, sp, pr]) => {
          if (!aktualne) return;
          // Składy podmieniają lekką listę drużyn tylko, gdy przyszły: bez nich
          // (gość, błąd) zostaje lista z etapu 1.
          const zeSkladem = wynik(sklady, null);
          if (zeSkladem) setDruzyny(zeSkladem);
          setAreny(wynik(a, []));
          setZdarzenia(wynik(z, []));
          setOgloszenia(wynik(og, []));
          setOgloszeniaBlad(og.status === 'rejected');
          // Galeria, sponsorzy (159) i przerwy (176): bez migracji sekcje
          // po prostu się nie pokazują.
          setZdjecia(wynik(zd, []));
          setSponsorzy(wynik(sp, []));
          setPrzerwy(wynik(pr, []));
        });
        // Nazwa organizatora osobnym zapytaniem: `turnieje.organizator_id`
        // wskazuje na `auth.users`, nie na `profiles` — PostgREST nie zbuduje
        // joinu (patrz docs/baza-danych.md).
        supabase.from('profiles').select('display_name').eq('id', t.organizatorId).maybeSingle()
          .then(({ data: p }) => { if (aktualne) setOrganizator((p?.display_name as string | undefined) ?? null); });
        // BLIK: tylko zarządzający i kapitanowie mają RLS-owe prawo do wiersza,
        // reszta nie dostanie nic, więc wołanie jest bezpieczne bez roli.
        if (t.wpisoweGrosze > 0 && user) {
          getBlikTurnieju(id).then((tel) => { if (aktualne) setBlikTelefon(tel); }).catch(() => {});
        }
      })
      // Tu dochodzi się WYŁĄCZNIE wtedy, gdy padło samo `getTurniej` (sieć,
      // RLS). „Nie znaleziono" byłoby wtedy kłamstwem — turniej może istnieć.
      .catch(() => { if (aktualne) setBladWczytania(true); })
      .finally(() => { if (aktualne) setLadowanie(false); });
    return () => { aktualne = false; };
  }, [id, user]);

  if (ladowanie) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header showMobileWordmark />
        <div className="flex-1 py-24 text-center text-sm text-slate-400">Ładuję…</div>
      </div>
    );
  }

  if (bladWczytania && !turniej) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header showMobileWordmark />
        <div className="flex-1 py-24 text-center">
          <p className="font-medium text-ink">Nie udało się wczytać turnieju</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Sprawdź połączenie i spróbuj ponownie.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-sm font-medium text-primary-600"
          >
            Spróbuj ponownie
          </button>
        </div>
      </div>
    );
  }

  if (notFound || !turniej) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header showMobileWordmark />
        <div className="flex-1 py-24 text-center">
          <p className="font-medium text-ink">Nie znaleziono turnieju</p>
          <Link prefetch={false} href="/turnieje" className="mt-2 inline-block text-sm text-primary-600">Wróć do listy turniejów</Link>
        </div>
      </div>
    );
  }

  // Przełącznik „Organizator / Uczestnik” usunięty 2026-11-25 (decyzja
  // właściciela): ukrywał tylko „Panel”, galerię i ogłoszenia, a zarządzanie
  // wyjeżdża do osobnych zakładek organizatora, więc nie miał czego chować.
  const uprawnienia = uprawnieniaTurnieju(turniej, osoba, user?.id, jestAdmin);
  const druzynyPoId = new Map(druzyny.map((d) => [d.id, d.nazwa]));
  const meczePoId = new Map(mecze.map((m) => [m.id, m]));
  const arenyPoId = new Map(areny.map((a) => [a.id, a.nazwa]));
  const grupyPoId = new Map(grupy.map((g) => [g.id, g]));
  // Grupa finałowa (175) nie ma przypisanych drużyn: grają w niej ci, których
  // baza wpisała do jej meczów po rozstrzygnięciu grup.
  const grupyZwykle = grupy.filter((g) => !g.finalowa);

  const meczeGrupowe = mecze.filter((m) => m.faza === 'grupa' || m.faza === 'liga');
  const meczeDrabinki = mecze.filter((m) => m.faza !== 'grupa' && m.faza !== 'liga');

  // Rozegrany = ma wynik, który się już nie zmieni. Mecz TRWAJĄCY nie jest
  // wynikiem, tylko najbliższą rzeczą do obejrzenia, więc ląduje na górze
  // terminarza, nie w wynikach — tak samo liczy go `obliczTabele()`, które
  // bierze wyłącznie `zakonczony` i `walkower`.
  const rozegrany = (m: TurniejMecz) => m.status === 'zakonczony' || m.status === 'walkower';
  // Wolny los nie jest ani nadchodzącym meczem, ani wynikiem: nikt w nim nie
  // gra. Widać go w drabince (przygaszony), na liście meczów byłby „0:0".
  const meczeNaLiscie = mecze.filter((m) => !czyWolnyLos(m));
  const meczePrzyszle = meczeNaLiscie
    .filter((m) => !rozegrany(m))
    .sort((a, b) => (a.status === 'trwa' ? -1 : b.status === 'trwa' ? 1 : porownajTermin(a, b)));
  const meczeRozegrane = meczeNaLiscie.filter(rozegrany).sort((a, b) => porownajTermin(b, a));
  // Moja grupa pierwsza (2026-11-28); wiersze w tabeli zostają po miejscach.
  const tabeleGrup = najpierwMoje(tabeleTurnieju(turniej, grupy, mecze, druzyny),
    (t) => !!mojaDruzyna && t.wiersze.some((w) => w.druzynaId === mojaDruzyna.id));

  // Drużyny pogrupowane tak, jak realnie grają. „Bez grupy" zbiera te, których
  // losowanie jeszcze nie dotknęło albo których turniej nie ma grup wcale.
  // Moja drużyna pierwsza w swojej grupie, a jej grupa pierwsza (2026-11-28).
  const mojaPierwsza = (lista: TurniejDruzyna[]) => najpierwMoje(lista, (d) => d.id === mojaDruzyna?.id);
  const sekcjeDruzyn = najpierwMoje(
    grupy.length > 0
      ? [
          ...grupyZwykle.map((g) => ({ tytul: `Grupa ${g.nazwa}`, lista: mojaPierwsza(druzyny.filter((d) => d.grupaId === g.id)) })),
          { tytul: 'Bez grupy', lista: mojaPierwsza(druzyny.filter((d) => !d.grupaId)) },
        ].filter((sekcja) => sekcja.lista.length > 0)
      : [{ tytul: 'Wszystkie drużyny', lista: mojaPierwsza(druzyny) }],
    (sekcja) => sekcja.lista.some((d) => d.id === mojaDruzyna?.id),
  );

  const tabelaMaTresc = tabeleGrup.length > 0 || meczeDrabinki.length > 0;
  const stan = stanTurnieju(turniej, mecze);
  const liczbaWTurnieju = liczDruzynyWTurnieju(druzyny);
  const czekajace = liczCzekajaceZgloszenia(druzyny);
  const zapisy = stanZapisowTurnieju(turniej, liczbaWTurnieju);
  const meczeNaZywo = mecze.filter((m) => m.status === 'trwa');
  // Tabela LIGI (nie grupy) jako podstawa podium — patrz `turniejPodium.ts`.
  // Przy grupie finałowej podium daje JEJ tabela (Luboń, 2026-11-18).
  const tabelaLigi = turniej.format === 'liga' && tabeleGrup.length === 1
    ? tabeleGrup[0].wiersze
    : turniej.format === 'grupy_finalowa'
      ? tabeleGrup.find((t) => t.grupa?.finalowa)?.wiersze
      : undefined;
  const podium = stan.label === 'Zakończony'
    ? podiumTurnieju(mecze, druzynyPoId, tabelaLigi)
    : [];

  // Najbliższy mecz MOJEJ drużyny — do paska „co dotyczy mnie".
  const mojNastepnyMecz = mojaDruzyna
    ? meczePrzyszle.find((m) => m.druzynaAId === mojaDruzyna.id || m.druzynaBId === mojaDruzyna.id)
    : undefined;

  const legendaAwansu = opisAwansu(
    tabeleGrup.filter((t) => t.grupa && !t.grupa.finalowa).map((t) => t.wiersze.length),
    turniej.awansujeZGrupy,
    turniej.format === 'grupy_finalowa' ? 'grupa_finalowa' : 'puchar',
  );

  const zakladka: Zakladka = zakladkaZAdresu
    ?? domyslnaZakladka(turniej.status, { maMecze: mecze.length > 0, maTabele: tabelaMaTresc });
  const aktywna: Zakladka = tabelaMaTresc || zakladka !== 'tabela' ? zakladka : 'mecze';

  // Domyślny widok meczów zależy od tego, co jest do zobaczenia: przed
  // turniejem najbliższe, po ostatnim gwizdku rozegrane. Ręczny wybór
  // i adres biją domyślny.
  const domyslnyWidok: WidokMeczow = meczePrzyszle.length > 0 ? 'najblizsze' : 'rozegrane';
  const widokMeczow: WidokMeczow = widokReczny ?? widokZAdresu ?? domyslnyWidok;

  // NASZE PRZED WSZYSTKIMI. Uczestnik nie szuka terminarza turnieju, tylko
  // terminarza swojej drużyny — trzech pozycji z czterdziestu dwóch. Filtr
  // jest prostopadły do przełącznika „najbliższe/rozegrane": tamten dzieli
  // mecze po czasie, ten po drużynie.
  const czyNasz = (m: TurniejMecz) =>
    !!mojaDruzyna && (m.druzynaAId === mojaDruzyna.id || m.druzynaBId === mojaDruzyna.id);
  const naszychMeczow = mecze.filter(czyNasz).length;
  const tylkoNasze = mojaDruzyna ? (tylkoNaszeReczne ?? true) : false;

  const listaPoCzasie = widokMeczow === 'najblizsze' ? meczePrzyszle : meczeRozegrane;
  const listaMeczow = tylkoNasze ? listaPoCzasie.filter(czyNasz) : listaPoCzasie;
  // Przerwa, która skończyła się przed ostatnim rozegranym meczem, nie należy
  // już do „najbliższych”.
  const ostatniRozegrany = meczeRozegrane.reduce<string | undefined>(
    (max, m) => (m.zaplanowanyAt && (!max || m.zaplanowanyAt > max) ? m.zaplanowanyAt : max), undefined);
  const przerwyPrzedNami = ostatniRozegrany ? przerwy.filter((p) => p.doAt > ostatniRozegrany) : przerwy;

  const zawodnicyDoStatystyk = druzyny.flatMap((d) => d.zawodnicy ?? []);
  // KAŻDY MECZ JEDNYM WIERSZEM (2026-11-21): przyszły i rozegrany tak samo,
  // szczegóły na stronie meczu. Boisko tylko przy kilku boiskach.
  const kafelekMeczu = (m: TurniejMecz) => (
    <WierszMeczu
      key={m.id}
      mecz={m}
      href={`/turnieje/${id}/mecz/${m.id}`}
      druzynyPoId={druzynyPoId}
      meczePoId={meczePoId}
      arenyPoId={arenyPoId}
      grupyPoId={grupyPoId}
      pokazBoisko={areny.length > 1}
      mojaDruzynaId={mojaDruzyna?.id}
    />
  );
  const mvpPoMeczach = mecze
    .filter((m) => m.status === 'zakonczony' || m.status === 'walkower')
    .map((m) => ({ mvpZawodnikId: m.mvpZawodnikId }));
  const klasyfikacje = obliczKlasyfikacje(zdarzenia, mvpPoMeczach, zawodnicyDoStatystyk, druzynyPoId);
  const strzelcy = posortujKlasyfikacje(klasyfikacje, 'gole');
  // Z samych zdarzeń, nie z klasyfikacji: niezalogowany nie widzi składów,
  // więc klasyfikacja jest u niego pusta, a strzelcy mimo to są wpisani.
  const maWpisanychStrzelcow = zdarzenia.some((z) => !!z.zawodnikId && (z.typ === 'gol' || z.typ === 'punkty'));
  const zdobycz = etykietaZdobyczy(turniej?.sport ?? '');
  const mvpList = posortujKlasyfikacje(klasyfikacje, 'mvp');
  const dojazd = linkDojazdu({ lat: turniej.lat, lng: turniej.lng, adres: turniej.miejsceAdres });

  // Król strzelców i MVP do podium — liczone z tych samych klasyfikacji, które
  // stoją niżej na zakładce Mecze, więc nie mogą się z nimi rozjechać.
  const krolStrzelcow = strzelcy.length > 0 && strzelcy[0].gole > 0
    ? { imie: strzelcy[0].imie, gole: strzelcy[0].gole }
    : undefined;
  const turniejowyMvp = mvpList.length > 0 && mvpList[0].mvp > 0
    ? { imie: mvpList[0].imie }
    : undefined;

  const udostepnijWyniki = async () => {
    const tekst = tekstPodium(turniej.nazwa, podium, linkDoTurnieju(adresTurnieju ?? id), krolStrzelcow);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `Wyniki: ${turniej.nazwa}`, text: tekst });
        return;
      } catch {
        return; // anulowanie arkusza nie jest błędem
      }
    }
    try {
      await navigator.clipboard.writeText(tekst);
      toast('Wyniki skopiowane');
    } catch {
      toast('Nie udało się skopiować', 'error');
    }
  };

  const udostepnij = async () => {
    const wynik = await udostepnijTurniej(turniej, linkDoTurnieju(adresTurnieju ?? id));
    if (wynik === 'copied') toast('Link skopiowany');
    else if (wynik === 'failed') toast('Nie udało się udostępnić', 'error');
  };

  const dodajOgloszenieAkcja = async (tresc: string) => {
    if (!user) return;
    try {
      await dodajOgloszenie(id, user.id, tresc);
      setOgloszenia(await getOgloszenia(id));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się opublikować ogłoszenia', 'error');
    }
  };

  const usunOgloszenieAkcja = async (ogloszenieId: string) => {
    try {
      await usunOgloszenie(ogloszenieId);
      setOgloszenia((poprzednie) => poprzednie.filter((o) => o.id !== ogloszenieId));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się usunąć ogłoszenia', 'error');
    }
  };

  const zamienWEkipeAkcja = async (d: TurniejDruzyna) => {
    const wynik = await potwierdz({
      tytul: `Zamienić ${d.nazwa} w ekipę?`,
      konsekwencje: [
        'Cały skład z kontem w Bojo dołączy jako członkowie nowej ekipy',
        'Będziesz mógł umawiać z nimi mecze poza turniejami',
      ],
      potwierdzLabel: 'Zamień w ekipę',
    });
    if (wynik !== 'tak') return;
    try {
      const grupaId = await zamienDruzyneWEkipe(d.id);
      toast('Ekipa utworzona');
      router.push(`/grupy/${grupaId}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się utworzyć ekipy', 'error');
    }
  };

  // DWIE KOLUMNY OD `lg` na zakładce Mecze (2026-11-21): terminarz po lewej,
  // tabele grup przyklejone po prawej. Na komputerze kibic i organizator
  // widzą skutek wyniku w tabeli bez przełączania zakładek. Na telefonie bez
  // zmian: jedna kolumna i osobna zakładka Tabele (z drabinką, która zostaje
  // tam też na komputerze). Pozostałe zakładki trzymają wąską kolumnę, bo
  // tekst i formularze na 1100 px czyta się gorzej.
  // Ramka i <main> mają TĘ SAMĄ szerokość na każdej zakładce (2026-11-25):
  // wcześniej Mecze rozszerzały całą stronę, a reszta była wąska, więc
  // nagłówek i zakładki skakały. Wąskie zakładki trzymają treść w kolumnie
  // na środku tej samej ramki.
  // Tabela obok listy meczów wypadła 2026-11-27 (test przed turniejem:
  // „dublowanie zmniejsza czytelność”, tabela jest w zakładce Tabela).
  const dwieKolumny = false;
  const szerokosc = SZEROKOSC_TURNIEJU;
  const kolumna = dwieKolumny ? '' : 'lg:mx-auto lg:max-w-2xl';

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header showMobileWordmark />
      {/* STAŁA RAMKA (2026-11-25): ten sam nagłówek i zakładki na stronie
          turnieju, w panelu, na meczu i na drużynie. Dawny przycisk „Panel”
          to dziś zakładki „Prowadź” i „Edytuj” w tym samym rzędzie. */}
      <RamkaTurnieju naglowek turniej={turniej} adres={adresTurnieju ?? id} aktywna={aktywna} liczbaDruzyn={liczbaWTurnieju} />

      <main className={`mx-auto w-full ${szerokosc} flex-1 space-y-4 px-4 py-5`}>
        <div className={`space-y-4 ${kolumna}`}>
        {turniej.status === 'szkic' && uprawnienia.mozeEdytowac && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/40 p-3.5 text-sm text-amber-800 dark:text-amber-300">
            Ten turniej jest szkicem: nie ma go na liście turniejów, ale każdy, kto ma link, go zobaczy.
          </div>
        )}
        {/* PROŚBY GRACZY (186): kapitan i organizator widzą je na górze
            każdej zakładki; tu prowadzi powiadomienie. */}
        {user && (
          <ProsbyDoRozpatrzenia
            turniejId={id}
            userId={user.id}
            onZmiana={() => { getDruzynyZeSkladem(id).then(setDruzyny).catch(() => undefined); }}
          />
        )}
        {czyTurniejProbny(turniej) && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3.5 text-sm text-slate-700 dark:text-slate-300">
            To jest próba turnieju: kopia do przećwiczenia dnia turnieju, zrobiona przyciskiem „Przetestuj” w panelu. Wyniki wpisane tutaj nie trafiają do prawdziwego turnieju. Usuniesz ją w panelu: „Zakończ próbę”.
          </div>
        )}

        {/* OKŁADKA na stronie turnieju, nie tylko jako miniatura na liście
            (decyzja właściciela z 2026-11-08). Organizator wgrywał ją
            w Ustawieniach i nie widział jej nigdzie poza `/turnieje`. */}
        {/* Tylko na Info: na pozostałych zakładkach zdjęcie spychało terminarz
            i tabelę poniżej pierwszego ekranu (audyt 7, Z-6). */}
        {turniej.okladkaUrl && aktywna === 'info' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={turniej.okladkaUrl}
            alt=""
            className="h-36 w-full rounded-2xl object-cover sm:h-48"
          />
        )}

        {/* Pasek tożsamości — widoczny na KAŻDEJ zakładce, w jednej linii.
            Pełny opis (termin, miejsce, format, zasady, wpisowe, organizator,
            opis, regulamin) mieszka dziś w zakładce „Info" (niżej) — tu
            zostaje tylko to, co trzeba widzieć niezależnie od tego, na co
            patrzysz: czy turniej trwa, kiedy i ile drużyn. Wcześniej (od
            2026-09-17) cała karta stała tutaj i zasłaniała górę KAŻDEJ
            zakładki, tabelę i drabinkę szczególnie. */}
        {/* Od 2026-11-20 tylko na Info (uwaga właściciela): na „Mecze”,
            „Tabele” i „Drużyny” kafelek powtarzał „Zapisy zamknięte” nad
            każdą listą, a tam nikt już o zapisy nie pyta. */}
        {aktywna === 'info' && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 shadow-sm">
          <span className="shrink-0 text-xl">{sportEmoji(turniej.sport)}</span>
          <div className="min-w-0 flex-1 text-sm text-slate-600 dark:text-slate-300">
            {/* `liczbaWTurnieju`, nie `druzyny.length`. Surowa długość tablicy
                liczyła także zgłoszenia czekające na decyzję, więc ten wiersz
                mówił „1/8 drużyn" w tej samej chwili, gdy pulpit organizatora
                mówił „0 z 8". Reguła zmieniła się w #411, ale to miejsce
                zostało pominięte, bo renderuje liczbę wprost, zamiast wołać
                `liczDruzynyWTurnieju()`. Kapitan i organizator patrzyli na
                dwie różne liczby o tym samym. */}
            <span className={`mr-1.5 rounded-full px-1.5 py-0.5 text-xs font-medium ${stan.ton}`}>{stan.label}</span>
            {/* Licznik w DRUGIEJ linii, nie sklejony z datą. Przy 360 px cały
                wiersz szedł przez `truncate`, więc data słowna („sob. 24
                października") zjadała miejsce i „· 1 z 8 drużyn" znikało za
                wielokropkiem — a to pierwsza liczba, jakiej szuka kapitan.
                Data zostaje w jednej linii, licznik dostaje własną. */}
            <span className="block truncate">{etykietaTerminu(turniej.dataStartu, turniej.godzinaStartu)}</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              {withCount(liczbaWTurnieju, 'drużyna', 'drużyny', 'drużyn')} z {turniej.maxDruzyn}
            </span>
          </div>
          <button onClick={udostepnij} aria-label="Udostępnij" className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center text-primary-600">
            <Share2 className="h-5 w-5" />
          </button>
        </div>
        )}

        {/* PODIUM — koniec turnieju. Dotąd turniej nie miał końca, tylko
            wygasanie: status zmieniał się na `zakonczony` i strona pokazywała
            tabelę. A to jest moment o największym zasięgu w całym module:
            wszyscy uczestnicy patrzą w telefon w tej samej minucie. */}
        {podium.length > 0 && (
          <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 text-center shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Zakończony</p>
            <div className="mt-3 space-y-1.5">
              {podium.map((m) => (
                <p
                  key={m.druzynaId}
                  className={m.miejsce === 1
                    ? 'font-display text-xl font-bold text-ink'
                    : 'text-sm font-medium text-slate-600 dark:text-slate-300'}
                >
                  {medal(m.miejsce)} {m.nazwa}
                  {m.exAequo && <span className="ml-1.5 text-xs font-normal text-slate-500">ex aequo</span>}
                </p>
              ))}
            </div>

            {(krolStrzelcow || turniejowyMvp) && (
              <div className="mt-4 space-y-0.5 border-t border-slate-100 dark:border-slate-700 pt-3 text-sm text-slate-600 dark:text-slate-300">
                {krolStrzelcow && <p>👟 Król strzelców: <span className="font-medium text-ink">{krolStrzelcow.imie}</span> · {krolStrzelcow.gole}</p>}
                {turniejowyMvp && <p>⭐ MVP: <span className="font-medium text-ink">{turniejowyMvp.imie}</span></p>}
              </div>
            )}

            <Button onClick={udostepnijWyniki} className="mt-4 w-full inline-flex items-center justify-center gap-2">
              <Share2 className="h-4 w-4" /> Udostępnij wyniki
            </Button>

            {/* Dwa wyjścia, każde dla innej osoby: kapitan zabiera skład dalej,
                a ktoś, kto właśnie zobaczył, jak to wygląda, może zrobić swój
                turniej. Do 2026-09-20 „Zamień w ekipę" siedziało trzy
                kliknięcia głębiej, w rozwiniętej karcie drużyny. */}
            {mojaDruzyna && mojaDruzyna.kapitanId === user?.id && (
              <Link prefetch={false}
                href={`/turnieje/${id}/druzyna/${mojaDruzyna.id}`}
                className="mt-3 block rounded-xl border border-primary-100 dark:border-primary-900 bg-primary-50/60 dark:bg-primary-950/30 p-3 text-left"
              >
                <span className="text-sm font-semibold text-ink">🔁 Zamień drużynę w ekipę</span>
                <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">
                  Graliście razem, grajcie dalej. Zostanie Wam ekipa z całym składem.
                </span>
              </Link>
            )}
            <Link prefetch={false}
              href={user ? '/turnieje/nowe' : '/logowanie?next=%2Fturnieje%2Fnowe'}
              className="mt-2 inline-block text-sm font-medium text-primary-600"
            >
              Organizujesz podobny? Zrób go w Bojo →
            </Link>
          </div>
        )}

        {/* TABLICA NA ŻYWO — w dniu turnieju to jest ekran, na który patrzy
            sto osób naraz: uczestnicy między meczami, kibice na ławce, rodzice
            przy juniorach. Wcześniej wynik trwającego meczu trzeba było
            znaleźć na liście czterdziestu dwóch. */}
        {meczeNaZywo.length > 0 && (
          <div className="rounded-2xl border border-primary-100 dark:border-primary-900 bg-primary-50/60 dark:bg-primary-950/30 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300">
              <span className="inline-block h-2 w-2 rounded-full bg-primary-600" /> Na żywo
            </p>
            <div className="space-y-2">
              {meczeNaZywo.map((m) => (
                <button
                  key={m.id}
                  onClick={() => router.push(`/turnieje/${id}/mecz/${m.id}`)}
                  className="flex w-full items-center gap-3 rounded-xl bg-white dark:bg-slate-800 px-3 py-2.5 text-left"
                >
                  <div className="min-w-0 flex-1">
                    {m.arenaId && arenyPoId.get(m.arenaId) && (
                      <p className="truncate text-xs text-slate-400">{arenyPoId.get(m.arenaId)}</p>
                    )}
                    <p className="truncate text-sm font-medium text-ink">
                      {druzynyPoId.get(m.druzynaAId ?? '') ?? 'TBD'} – {druzynyPoId.get(m.druzynaBId ?? '') ?? 'TBD'}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-lg font-bold text-ink">
                    {m.wynikA}:{m.wynikB}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PLAKAT ZAPISÓW — to, po co człowiek z Facebooka klika w link.
            „6/8 drużyn" (pasek wyżej) jest informacją; „Zostały 2 miejsca ·
            zapisy do czwartku" jest powodem, żeby zgłosić drużynę DZIŚ. Ta
            sama różnica, którą moduł meczowy rozstrzygnął dawno licznikiem
            miejsc i oknem zapisu. Pokazuje się wyłącznie w zapisach — po ich
            zamknięciu nie niesie już nic. */}
        {turniej.status === 'zapisy' && (
          <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-2.5 shadow-sm">
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-primary-600 transition-all"
                  style={{ width: `${zapisy.procent}%` }}
                />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                <span className="font-medium text-ink">{zapisy.miejscaLabel}</span>
                {zapisy.terminLabel && (
                  <span className="text-slate-500 dark:text-slate-400">⏳ {zapisy.terminLabel}</span>
                )}
              </div>
              {/* Licznik wyżej mówi o PRZYJĘTYCH. Bez tego wiersza kapitan nie
                  odróżniłby turnieju, w którym zostały dwa miejsca, od takiego,
                  w którym o te dwa miejsca bije się pięć czekających drużyn. */}
              {czekajace > 0 && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {czekajace === 1
                    ? 'Dodatkowo 1 zgłoszenie czeka na decyzję organizatora.'
                    : `Dodatkowo ${czekajace} zgłoszenia czekają na decyzję organizatora.`}
                </p>
              )}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {turniej.wpisoweGrosze > 0
                ? `${(turniej.wpisoweGrosze / 100).toFixed(0)} zł od drużyny · `
                : 'Bez wpisowego · '}
              skład do {turniej.maxZawodnikow} osób
            </p>
          </div>
        )}

        {/* Pasek „co dotyczy MNIE" — turniej bez niego jest zestawem tabelek
            dla widza, a wchodzi w niego przede wszystkim uczestnik. */}
        {mojaDruzyna && (
          <div className="rounded-2xl border border-primary-100 dark:border-primary-900 bg-primary-50/60 dark:bg-primary-950/30 p-4 space-y-1.5">
            {/* Nazwa drużyny jest ODNOŚNIKIEM na jej ekran — tam stoi stały
                link do wysłania kolegom, licznik składu i zaproszenia. Do
                2026-09-20 ten pasek był ślepy: pokazywał nazwę i nie prowadził
                donikąd, a link do drużyny kapitan widział jeden raz w życiu,
                na ekranie potwierdzenia zgłoszenia. */}
            <Link prefetch={false}
              href={`/turnieje/${id}/druzyna/${mojaDruzyna.id}`}
              className="flex items-center gap-1 text-sm font-semibold text-ink"
            >
              <span className="min-w-0 truncate">Twoja drużyna: {mojaDruzyna.nazwa}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-primary-600" />
            </Link>
            {mojNastepnyMecz ? (
              <button
                onClick={() => router.push(`/turnieje/${id}/mecz/${mojNastepnyMecz.id}`)}
                className="text-sm text-primary-700 dark:text-primary-300"
              >
                Następny mecz: {mojNastepnyMecz.zaplanowanyAt
                  ? etykietaTerminuMeczu(mojNastepnyMecz.zaplanowanyAt)
                  : FAZA_LABEL[mojNastepnyMecz.faza]} →
              </button>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">Nie macie już meczów w terminarzu.</p>
            )}
            {turniej.wpisoweGrosze > 0 && mojaDruzyna.kapitanId === user?.id && (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Wpisowe {(turniej.wpisoweGrosze / 100).toFixed(0)} zł:{' '}
                {mojaDruzyna.wpisoweOplaconeAt
                  ? <span className="text-primary-700">opłacone ✓</span>
                  : blikTelefon
                    ? <>nieopłacone, BLIK: {blikTelefon}</>
                    : <>nieopłacone (organizator nie podał jeszcze numeru BLIK)</>}
              </p>
            )}
          </div>
        )}

        {/* Ogłoszenia w całości tylko na Info. Na pozostałych zakładkach jeden
            wiersz z liczbą: zawodnik w „Mecze" szuka swojej godziny, a pełne
            ogłoszenie stało przed terminarzem na każdej zakładce (audyt 7). */}
        {!SHOW_TURNIEJ_OGLOSZENIA ? null : aktywna === 'info' ? (
          <Ogloszenia
            ogloszenia={ogloszenia}
            blad={ogloszeniaBlad}
            mozeZarzadzac={uprawnienia.mozeEdytowac}
            onDodaj={dodajOgloszenieAkcja}
            onUsun={usunOgloszenieAkcja}
          />
        ) : ogloszenia.length > 0 ? (
          <button
            onClick={() => router.push(`/turnieje/${id}?tab=info`)}
            className="flex min-h-[44px] w-full items-center gap-2 rounded-xl border border-pink-100 dark:border-pink-900 bg-pink-50/60 dark:bg-pink-950/30 px-3.5 py-2 text-left text-sm"
          >
            <span className="font-medium text-pink-700 dark:text-pink-300">Ogłoszenia ({ogloszenia.length})</span>
            <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">{ogloszenia[0].tresc}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
          </button>
        ) : null}

        {/* Jedno działanie zgodne ze stanem turnieju, widoczne TAKŻE dla
            niezalogowanego — przegląd złapał stronę bez żadnego przycisku,
            bo „Zgłoś drużynę" wisiało wyłącznie na zakładce Info, a „Utwórz
            turniej" tylko dla zalogowanych. */}
        {przyjmujeZgloszenia(turniej, liczbaWTurnieju) && !mojaDruzyna && (
          <Link prefetch={false} href={`/turnieje/${id}/zglos`}>
            <Button className="w-full">Zgłoś drużynę</Button>
          </Link>
        )}

        {/* Obserwuj: dla każdego, kto nie ma turnieju na koncie z innego
            powodu (nie gra, nie organizuje). Niezalogowany idzie przez
            logowanie i wraca tutaj. */}
        {aktywna === 'info' && !mojaDruzyna && !uprawnienia.mozeEdytowac && !czyTurniejProbny(turniej) && (
          user ? (
            <Button
              variant={obserwuje ? 'outline' : 'secondary'}
              onClick={przelaczObserwowanie}
              disabled={obserwujeZapis}
              aria-pressed={obserwuje}
              className="w-full inline-flex items-center justify-center gap-2"
            >
              {obserwuje ? <><BellRing className="h-4 w-4" /> Obserwujesz turniej</> : <><Bell className="h-4 w-4" /> Obserwuj turniej</>}
            </Button>
          ) : (
            <Link prefetch={false}
              href={`/logowanie?next=${encodeURIComponent(`/turnieje/${id}`)}`}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-semibold text-ink dark:border-slate-700"
            >
              <Bell className="h-4 w-4" /> Obserwuj turniej
            </Link>
          )
        )}

        {aktywna === 'info' && (
          <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3 shadow-sm">
            <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <span>{etykietaTerminu(turniej.dataStartu, turniej.godzinaStartu)}</span>
            </div>

            {(turniej.miejsceNazwa || turniej.miejsceAdres) && (
              <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  {turniej.miejsceNazwa && <div className="font-medium text-ink">{turniej.miejsceNazwa}</div>}
                  {turniej.miejsceAdres && <div className="text-xs text-slate-500 dark:text-slate-300">{turniej.miejsceAdres}</div>}
                  {dojazd && (
                    <a href={dojazd} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-primary-600">
                      <Navigation className="h-4 w-4" /> Nawiguj
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Brak miejsca to nie jest powód, żeby o miejscu nie mówić.
                Wiersz po prostu znikał, a kapitan, który ma zapłacić wpisowe,
                szuka właśnie lokalizacji: cisza w tym miejscu czyta się jak
                turniej wymyślony na próbę, nie jak „organizator jeszcze
                rezerwuje". Szary, bo to dokładnie znaczenie zarezerwowane dla
                „ta droga jest na razie zamknięta, nic się nie zepsuło". */}
            {!turniej.miejsceNazwa && !turniej.miejsceAdres && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                <div className="min-w-0 flex-1 text-slate-500 dark:text-slate-400">
                  Miejsce jeszcze nieustalone. Organizator dopisze je przed startem.
                </div>
              </div>
            )}

            <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <div className="font-medium text-ink">{FORMAT_LABEL[turniej.format]}</div>
                <div className="text-xs text-slate-500 dark:text-slate-300">{opisFormatu(turniej, liczbaWTurnieju)}</div>
              </div>
            </div>

            <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <div>{withCount(liczbaWTurnieju, 'drużyna', 'drużyny', 'drużyn')} z {turniej.maxDruzyn} · skład do {turniej.maxZawodnikow} osób</div>
                <div className="text-xs text-slate-500 dark:text-slate-300">
                  Mecz {turniej.czasMeczuMin} min
                  {turniej.przerwaMin > 0 && `, przerwa ${turniej.przerwaMin} min`}
                  {/* Punkty tylko, gdy odbiegają od 3/1, a o karnych wcale: to,
                      co oczywiste, zasłaniało to, co ważne (uwaga właściciela
                      2026-11-20). */}
                  {(turniej.punktyZaWygrana !== 3 || turniej.punktyZaRemis !== 1)
                    && <>{' · '}zwycięstwo {turniej.punktyZaWygrana} pkt, remis {turniej.punktyZaRemis}</>}
                  {turniej.format !== 'liga' && turniej.meczO3Miejsce && ' · gramy mecz o 3. miejsce'}
                </div>
              </div>
            </div>

            {/* „50 zł" bez tej jednej informacji jest pytaniem, nie odpowiedzią. */}
            <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <span>
                {turniej.wpisoweGrosze > 0
                  ? `Wpisowe ${(turniej.wpisoweGrosze / 100).toFixed(0)} zł od drużyny`
                  : 'Bez wpisowego'}
              </span>
            </div>

            {/* 16/24 px i długość wiersza do ~65 znaków: opis organizatora jest
                tu najważniejszą treścią, a 14 px czytało się jak przypis. */}
            {turniej.opis && <p className="max-w-prose whitespace-pre-wrap text-base leading-6 text-slate-700 dark:text-slate-200">{turniej.opis}</p>}
            {/* Przerwy z nazwą (176) także na Info: uczestnik z linku czyta
                tu „konkurs 12:40–13:00, grupa C do 12:25”, zanim otworzy
                terminarz (audyt 2026-11-18). */}
            {przerwy.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-500">Przerwy w programie</h2>
                {przerwy.map((p) => (
                  <WierszPrzerwy
                    key={p.id}
                    od={chwilaWPolsce(p.odAt).godzina.slice(0, 5)}
                    do={chwilaWPolsce(p.doAt).godzina.slice(0, 5)}
                    nazwa={p.nazwa}
                    opis={p.opis}
                  />
                ))}
              </div>
            )}
            {turniej.regulamin && (
              <details className="text-sm">
                <summary className="cursor-pointer font-medium text-ink">Regulamin</summary>
                <p className="mt-2 whitespace-pre-wrap text-slate-600 dark:text-slate-300">{turniej.regulamin}</p>
              </details>
            )}
            {/* Organizator na samym dole karty (2026-11-20): czytający szuka
                najpierw terminu, miejsca i zasad, a „kto organizuje” jest
                podpisem pod treścią, nie jej nagłówkiem. */}
            {organizator && (
              <div className="flex items-start gap-2 border-t border-slate-100 pt-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <span>Organizuje <Link prefetch={false} href={`/gracz/${turniej.organizatorId}`} className="font-medium text-primary-600">{organizator}</Link></span>
              </div>
            )}

          </div>
        )}

        {/* Galeria i sponsorzy pod kartą szczegółów — zakładka Info ma być
            stroną turnieju do przewijania w dół, nie tylko listą faktów.
            Plan → docs/turniej-galeria-sponsorzy-plan.md §7. */}
        {aktywna === 'info' && (
          <>
            <Galeria
              zdjecia={zdjecia}
              // Zarządzanie zdjęciami tylko w Edytuj → Ustawienia (2026-11-27):
              // na Info zostaje sama galeria, taka jak widzą ją kibice.
              mozeZarzadzac={false}
              linkDoPanelu={`/turnieje/${id}/panel?tab=wyglad`}
            />
            <Sponsorzy sponsorzy={sponsorzy} />
          </>
        )}

        {aktywna === 'druzyny' && (
          <div className="space-y-5">
            {/* Licznik drużyn stoi już w pasku nad zakładkami; tu zostaje tylko
                wejście do zgłoszenia, gdy jest otwarte. */}
            {przyjmujeZgloszenia(turniej, liczbaWTurnieju) && (
            <div className="flex items-center justify-end">
                <Link prefetch={false} href={`/turnieje/${id}/zglos`} className="inline-flex min-h-[44px] items-center text-sm font-medium text-primary-600">+ Zgłoś drużynę</Link>
            </div>
            )}
            {druzyny.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">Nikt się jeszcze nie zgłosił.</p>
            ) : (
              /* Drużyny pod nagłówkami grup, a nie jedną listą: przy ośmiu
                 drużynach w dwóch grupach lista bez podziału wymaga trzymania
                 w głowie, kto z kim gra. Drużyny bez grupy (faza pucharowa,
                 zgłoszenia przed losowaniem) mają własną sekcję na końcu. */
              sekcjeDruzyn.map(({ tytul, lista }) => (
                <div key={tytul} className="space-y-2">
                  {sekcjeDruzyn.length > 1 && (
                    <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {tytul}
                    </h2>
                  )}
                  {lista.map((d) => (
                    <KartaDruzyny
                      key={d.id}
                      d={d}
                      zalogowany={!!user}
                      czyMoja={d.id === mojaDruzyna?.id && d.kapitanId === user?.id}
                      wMojejDruzynie={d.id === mojaDruzyna?.id}
                      onZamienWEkipe={zamienWEkipeAkcja}
                      mecze={mecze}
                      nazwaSlotu={(m, strona) => nazwaSlotu(m, strona, druzynyPoId, meczePoId, grupyPoId)}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        {aktywna === 'mecze' && (
          <div className={dwieKolumny ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6' : ''}>
          <div className="min-w-0 space-y-4">
            {mojaDruzyna && naszychMeczow > 0 && (
              <div className="flex gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                {([true, false] as const).map((nasze) => (
                  <button
                    key={String(nasze)}
                    onClick={() => setTylkoNaszeReczne(nasze)}
                    className={[
                      'flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                      tylkoNasze === nasze ? 'bg-white dark:bg-slate-700 text-ink shadow-sm' : 'text-slate-500',
                    ].join(' ')}
                  >
                    {nasze ? `Nasze (${naszychMeczow})` : `Wszystkie (${mecze.length})`}
                  </button>
                ))}
              </div>
            )}
            {/* Przełącznik zamiast dwóch zakładek: „co jeszcze gramy"
                i „jak poszło" to jedno pytanie o mecze z dwiema odpowiedziami,
                a nie dwa osobne miejsca w nawigacji. */}
            {meczePrzyszle.length > 0 && meczeRozegrane.length > 0 && (
              <div className="flex gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                {(['najblizsze', 'rozegrane'] as WidokMeczow[]).map((w) => (
                  <button
                    key={w}
                    onClick={() => setWidokReczny(w)}
                    className={[
                      'flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                      widokMeczow === w ? 'bg-white dark:bg-slate-700 text-ink shadow-sm' : 'text-slate-500',
                    ].join(' ')}
                  >
                    {w === 'najblizsze' ? `Najbliższe (${meczePrzyszle.length})` : `Rozegrane (${meczeRozegrane.length})`}
                  </button>
                ))}
              </div>
            )}

            {listaMeczow.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">
                {mecze.length > 0 && tylkoNasze
                  ? (widokMeczow === 'najblizsze'
                      ? 'Nie macie już meczów w terminarzu.'
                      : 'Nie rozegraliście jeszcze żadnego meczu.')
                  : uprawnienia.mozeEdytowac
                    ? 'Terminarz jeszcze nie jest wygenerowany.'
                    : 'Terminarz jeszcze nie jest gotowy.'}
              </p>
            ) : (
              <div className="space-y-2">
                {(widokMeczow === 'najblizsze'
                  // Przerwa w harmonogramie (konkurs, dekoracja) widać jako
                  // przerwę, nie jako zagadkę „czemu następny mecz o 13:00".
                  // Liczona na CAŁYM terminarzu (z meczem przed pierwszym
                  // najbliższym), a „Nasze mecze” dostają przerwy turnieju
                  // między swoimi meczami (2026-11-22: dotąd tylko z nazwą).
                  ? (() => {
                      const wszystkie = terminarzZPrzerwami(meczePrzyszle, przerwyPrzedNami, {
                        // Przed meczem w toku przerwa już minęła: bez poprzedniego.
                        ...turniej, poprzedni: meczePrzyszle[0]?.status === 'trwa' ? undefined : meczPrzed(meczeNaLiscie, meczePrzyszle[0]),
                      });
                      return tylkoNasze ? zawezDoMeczow(wszystkie, czyNasz) : wszystkie;
                    })()
                  : listaMeczow.map((mecz) => ({ typ: 'mecz' as const, mecz }))
                ).map((w) => (w.typ === 'przerwa' ? (
                  <WierszPrzerwy key={w.przerwaId ?? `p-${w.od}`} od={w.od} do={w.do} nazwa={w.nazwa} opis={w.opis} />
                ) : (
                  kafelekMeczu(w.mecz)
                )))}
              </div>
            )}

            {/* Tylko gdy ktoś WPISAŁ strzelca albo zawodnika meczu (2026-11-21).
                „Jeszcze nikt nie strzelił” kłamało przy wynikach wpisanych bez
                strzelców: gole padły, tylko nikt ich nie przypisał. */}
            {meczeRozegrane.length > 0 && (maWpisanychStrzelcow || mvpList.some((w) => w.mvp > 0)) && (
              <div className="space-y-3 border-t border-slate-100 dark:border-slate-700 pt-4">
                <h2 className="text-sm font-semibold text-slate-500">Statystyki graczy</h2>
                {!user ? (
                  <SciankaLogowania tytul="Statystyki graczy" />
                ) : (
                  <div className="space-y-4">
                    {strzelcy.some((w) => w.gole > 0) && (
                      <div>
                        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{zdobycz.naglowek}</h3>
                        <Klasyfikacja wpisy={strzelcy.filter((w) => w.gole > 0)} klucz="gole" etykietaKolumny={zdobycz.kolumna} pusteMiejsce="" />
                      </div>
                    )}
                    {/* Bez klasyfikacji asyst (asysty wypadły z modułu 2026-11-08).
                        Zawodnik meczu jest opcjonalny, więc jego lista pokazuje
                        się dopiero, gdy ktoś go faktycznie wskazał. */}
                    {mvpList.some((w) => w.mvp > 0) && (
                      <div>
                        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Zawodnik meczu</h3>
                        <Klasyfikacja wpisy={mvpList.filter((w) => w.mvp > 0)} klucz="mvp" etykietaKolumny="Razy" pusteMiejsce="" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          {dwieKolumny && (
            <aside
              aria-label="Tabele"
              className="hidden space-y-3 lg:sticky lg:top-36 lg:block lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto"
            >
              {legendaAwansu && (
                <p className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <span className="h-3 w-[3px] shrink-0 rounded-full bg-primary-600" aria-hidden />
                  {legendaAwansu}
                </p>
              )}
              {tabeleGrup.filter(({ grupa, wiersze }) => !grupa?.finalowa || wiersze.length > 0).map(({ grupa, wiersze }) => (
                <div key={grupa?.id ?? 'liga'} className="space-y-1.5">
                  {grupa && (
                    <h2 className="font-display text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Grupa {grupa.nazwa}{grupa.finalowa ? ' (finałowa)' : ''}
                    </h2>
                  )}
                  <TabelaGrupy wiersze={wiersze} awansujeZGrupy={grupa && !grupa.finalowa ? turniej.awansujeZGrupy : undefined} mojaDruzynaId={mojaDruzyna?.id} hrefDruzyny={(dId) => `/turnieje/${adresTurnieju ?? id}/druzyna/${dId}`} />
                </div>
              ))}
              <button
                onClick={() => router.push(`/turnieje/${id}?tab=tabela`)}
                className="text-sm font-medium text-primary-600"
              >
                {meczeDrabinki.length > 0 ? 'Drabinka i mecze grup' : 'Mecze grup'}
              </button>
            </aside>
          )}
          </div>
        )}

        {aktywna === 'tabela' && (
          <div className="space-y-5">
            {/* Legenda NAD tabelami: zielony pasek awansu był wyjaśniony dopiero
                pod grupą finałową, czyli po kilku ekranach przewijania. */}
            {legendaAwansu && (
              <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <span className="h-3 w-[3px] shrink-0 rounded-full bg-primary-600" aria-hidden />
                {legendaAwansu}
              </p>
            )}

            {tabeleGrup.map(({ grupa, wiersze }) => (
              <div key={grupa?.id ?? 'liga'} className="space-y-2">
                {grupa && (
                  <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Grupa {grupa.nazwa}{grupa.finalowa ? ' (finałowa)' : ''}
                  </h2>
                )}
                {grupa?.finalowa ? (
                  <>
                    {wiersze.length > 0 ? (
                      <TabelaGrupy wiersze={wiersze} komentarz={grupa?.komentarz} mojaDruzynaId={mojaDruzyna?.id} hrefDruzyny={(dId) => `/turnieje/${adresTurnieju ?? id}/druzyna/${dId}`} />
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Drużyny wejdą tu po rozstrzygnięciu swoich grup.
                      </p>
                    )}
                    <div className="space-y-2">
                      {meczeGrupowe
                        .filter((m) => m.grupaId === grupa.id)
                        .sort(porownajTermin)
                        .map((m) => (
                          kafelekMeczu(m)
                        ))}
                    </div>
                  </>
                ) : (
                  <TabelaGrupy wiersze={wiersze} awansujeZGrupy={grupa ? turniej.awansujeZGrupy : undefined} komentarz={grupa?.komentarz} mojaDruzynaId={mojaDruzyna?.id} hrefDruzyny={(dId) => `/turnieje/${adresTurnieju ?? id}/druzyna/${dId}`} />
                )}
                {grupa && !grupa.finalowa && (
                  <MeczeGrupy
                    // Rozegrane i najbliższe mecze grupy, po godzinie (2026-11-21):
                    // pod tabelą czytający pyta też „z kim jeszcze gramy”.
                    mecze={meczeGrupowe.filter((m) => m.grupaId === grupa.id).sort(porownajTermin)}
                    wiersz={kafelekMeczu}
                  />
                )}
              </div>
            ))}

            {/* Drabinka pod tabelami, nie w osobnej zakładce: obie odpowiadają
                na „kto wygrywa", a rozdzielone kazały przeskakiwać tam i z powrotem
                przy każdym pytaniu o to, kto z kim zagra w półfinale. */}
            {meczeDrabinki.length > 0 && (
              <div className={tabeleGrup.length > 0 ? 'space-y-2 border-t border-slate-100 dark:border-slate-700 pt-5' : 'space-y-2'}>
                <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Drabinka
                </h2>
                <Drabinka
                  mecze={meczeDrabinki}
                  druzynyPoId={druzynyPoId}
                  meczePoId={meczePoId}
                  arenyPoId={arenyPoId}
                  grupyPoId={grupyPoId}
                  onKlikMeczu={(meczId) => router.push(`/turnieje/${id}/mecz/${meczId}`)}
                />
              </div>
            )}

            {!tabelaMaTresc && (
              <p className="py-10 text-center text-sm text-slate-400">
                Tabela pojawi się po pierwszym rozegranym meczu.
              </p>
            )}
          </div>
        )}
        </div>
      </main>
      {oknoPotwierdzenia}
    </div>
  );
}
