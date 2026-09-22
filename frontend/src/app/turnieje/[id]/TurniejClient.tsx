'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, MapPin, Users, Navigation, Settings, Share2, ChevronDown, ChevronRight, Trophy, Wallet, UserRound } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { usePotwierdzenie } from '@/lib/usePotwierdzenie';
import {
  getTurniej, uprawnieniaTurnieju, getMojaOsobe, przyjmujeZgloszenia,
  getOgloszenia, dodajOgloszenie, usunOgloszenie, getBlikTurnieju,
  domyslnaZakladka,
} from '@/lib/turnieje';
import { getDruzyny, getDruzynyZeSkladem, getMojaDruzyne, zamienDruzyneWEkipe } from '@/lib/turniejDruzyny';
import { getMecze, getAreny, getGrupy, getZdarzeniaTurnieju } from '@/lib/turniejMecze';
import { FAZA_LABEL, FORMAT_LABEL, opisFormatu, etykietaTerminu, stanTurnieju, stanZapisowTurnieju, liczDruzynyWTurnieju, liczCzekajaceZgloszenia, etykietaZdobyczy } from '@/lib/turniejEtykiety';
import { obliczTabele, posortujTabele, opisAwansu } from '@/lib/turniejTabela';
import { obliczKlasyfikacje, posortujKlasyfikacje } from '@/lib/turniejStatystyki';
import { linkDoTurnieju, udostepnijTurniej } from '@/lib/turniejShare';
import { podiumTurnieju, tekstPodium, medal } from '@/lib/turniejPodium';
import { linkDojazdu } from '@/lib/utils';
import { useWstecz } from '@/lib/historia';
import { sportEmoji } from '@/lib/sports';
import KartaMeczu from '@/components/turnieje/KartaMeczu';
import TabelaGrupy from '@/components/turnieje/TabelaGrupy';
import Drabinka from '@/components/turnieje/Drabinka';
import Klasyfikacja from '@/components/turnieje/Klasyfikacja';
import Ogloszenia from '@/components/turnieje/Ogloszenia';
import KartaDruzyny from '@/components/turnieje/KartaDruzyny';
import SciankaLogowania from '@/components/turnieje/SciankaLogowania';
import type { Turniej, TurniejDruzyna, TurniejOsoba, TurniejMecz, TurniejArena, TurniejGrupa, TurniejZdarzenie, TurniejOgloszenie } from '@/types';

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

const ETYKIETY_ZAKLADEK: Record<Zakladka, string> = {
  info: 'Info',
  mecze: 'Mecze',
  tabela: 'Tabela i drabinka',
  druzyny: 'Drużyny',
};

type WidokMeczow = 'najblizsze' | 'rozegrane';

/** Rozegrane mecze jednej grupy, zwinięte pod jej tabelą. */
function MeczeGrupy({
  mecze, druzynyPoId, meczePoId, arenyPoId, onKlikMeczu,
}: {
  mecze: TurniejMecz[];
  druzynyPoId: Map<string, string>;
  meczePoId: Map<string, TurniejMecz>;
  arenyPoId: Map<string, string>;
  onKlikMeczu: (meczId: string) => void;
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
        {rozwiniete ? 'Zwiń wyniki' : `Pokaż wyniki (${mecze.length})`}
      </button>
      {rozwiniete && (
        <div className="mt-2 space-y-2">
          {mecze.map((m) => (
            <KartaMeczu
              key={m.id}
              mecz={m}
              druzynyPoId={druzynyPoId}
              meczePoId={meczePoId}
              arenyPoId={arenyPoId}
              onClick={() => onKlikMeczu(m.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TurniejClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const { potwierdz, oknoPotwierdzenia } = usePotwierdzenie();
  // Do listy turniejów tylko z linku (pusta historia). Na ten ekran prowadzi
  // też karta meczu, profil gracza i link z WhatsAppa, a `router.push` na
  // sztywnego rodzica odbijał wtedy systemowe „wstecz" z powrotem tutaj.
  const wstecz = useWstecz('/turnieje');

  const [turniej, setTurniej] = useState<Turniej | null>(null);
  const [druzyny, setDruzyny] = useState<TurniejDruzyna[]>([]);
  const [osoba, setOsoba] = useState<TurniejOsoba | null>(null);
  const [mecze, setMecze] = useState<TurniejMecz[]>([]);
  const [areny, setAreny] = useState<TurniejArena[]>([]);
  const [grupy, setGrupy] = useState<TurniejGrupa[]>([]);
  const [zdarzenia, setZdarzenia] = useState<TurniejZdarzenie[]>([]);
  const [ogloszenia, setOgloszenia] = useState<TurniejOgloszenie[]>([]);
  /** Ogłoszeń nie dało się wczytać — puste miejsce ma powiedzieć co innego niż „nie ma ogłoszeń". */
  const [ogloszeniaBlad, setOgloszeniaBlad] = useState(false);
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
    const czasomierz = setInterval(() => {
      Promise.all([getMecze(id), getZdarzeniaTurnieju(id)])
        .then(([m, z]) => { setMecze(m); setZdarzenia(z); })
        .catch(() => undefined);
    }, 20_000);
    return () => clearInterval(czasomierz);
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
    getTurniej(id)
      .then(async (t) => {
        if (!aktualne) return;
        if (!t) { setNotFound(true); setLadowanie(false); return; }
        setTurniej(t);
        // `allSettled`, NIE `all` — i to jest naprawa awarii, nie ostrożność.
        //
        // `Promise.all` odrzuca się w całości, gdy padnie JEDNO z ośmiu
        // zapytań, a `.catch()` niżej zamieniał to na „Nie znaleziono
        // turnieju". Skutek zobaczony na żywo: baza bez migracji `150` nie ma
        // tabeli `turniej_ogloszenia`, PostgREST oddawał 404 i CAŁA STRONA
        // TURNIEJU nie otwierała się nikomu — ani kapitanom z rozesłanego
        // linku, ani samemu organizatorowi. Brak jednej sekcji nigdy nie może
        // znaczyć „nie ma turnieju": turniej wczytał się linijkę wyżej.
        //
        // Każda sekcja dostaje więc własny wynik i własny stan pusty. Jedyne,
        // co naprawdę przesądza o „nie znaleziono", to brak samego turnieju.
        const [d, o, m, a, g, z, og, mj] = await Promise.allSettled([
          user ? getDruzynyZeSkladem(id) : getDruzyny(id),
          user ? getMojaOsobe(id, user.id) : Promise.resolve(null),
          getMecze(id),
          getAreny(id),
          getGrupy(id),
          getZdarzeniaTurnieju(id),
          getOgloszenia(id),
          user ? getMojaDruzyne(id, user.id) : Promise.resolve(null),
        ]);
        if (!aktualne) return;
        setDruzyny(d.status === 'fulfilled' ? d.value : []);
        setOsoba(o.status === 'fulfilled' ? o.value : null);
        setMecze(m.status === 'fulfilled' ? m.value : []);
        setAreny(a.status === 'fulfilled' ? a.value : []);
        setGrupy(g.status === 'fulfilled' ? g.value : []);
        setZdarzenia(z.status === 'fulfilled' ? z.value : []);
        setOgloszenia(og.status === 'fulfilled' ? og.value : []);
        setOgloszeniaBlad(og.status === 'rejected');
        setMojaDruzyna(mj.status === 'fulfilled' ? mj.value : null);
        // BLIK: tylko organizator/zarządzający i kapitanowie mają RLS-owe
        // prawo do wiersza — reszta po prostu nie dostanie nic, więc wołanie
        // „na wszelki wypadek" jest bezpieczne i nie wymaga sprawdzania roli
        // z wyprzedzeniem.
        // Nazwa organizatora osobnym zapytaniem: `turnieje.organizator_id`
        // wskazuje na `auth.users`, nie na `profiles` — PostgREST nie zbuduje
        // joinu (patrz docs/baza-danych.md).
        supabase.from('profiles').select('display_name').eq('id', t.organizatorId).maybeSingle()
          .then(({ data: p }) => { if (aktualne) setOrganizator((p?.display_name as string | undefined) ?? null); });
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
        <Header />
        <div className="flex-1 py-24 text-center text-sm text-slate-400">Ładuję…</div>
      </div>
    );
  }

  if (bladWczytania && !turniej) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header />
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
        <Header />
        <div className="flex-1 py-24 text-center">
          <p className="font-medium text-ink">Nie znaleziono turnieju</p>
          <Link href="/turnieje" className="mt-2 inline-block text-sm text-primary-600">Wróć do listy turniejów</Link>
        </div>
      </div>
    );
  }

  const uprawnienia = uprawnieniaTurnieju(turniej, osoba, user?.id);
  const druzynyPoId = new Map(druzyny.map((d) => [d.id, d.nazwa]));
  const meczePoId = new Map(mecze.map((m) => [m.id, m]));
  const arenyPoId = new Map(areny.map((a) => [a.id, a.nazwa]));

  const meczeGrupowe = mecze.filter((m) => m.faza === 'grupa' || m.faza === 'liga');
  const meczeDrabinki = mecze.filter((m) => m.faza !== 'grupa' && m.faza !== 'liga');

  // Rozegrany = ma wynik, który się już nie zmieni. Mecz TRWAJĄCY nie jest
  // wynikiem, tylko najbliższą rzeczą do obejrzenia, więc ląduje na górze
  // terminarza, nie w wynikach — tak samo liczy go `obliczTabele()`, które
  // bierze wyłącznie `zakonczony` i `walkower`.
  const rozegrany = (m: TurniejMecz) => m.status === 'zakonczony' || m.status === 'walkower';
  const meczePrzyszle = mecze
    .filter((m) => !rozegrany(m))
    .sort((a, b) => (a.status === 'trwa' ? -1 : b.status === 'trwa' ? 1 : a.numer - b.numer));
  const meczeRozegrane = mecze.filter(rozegrany).sort((a, b) => b.numer - a.numer);
  const pozycjeReczne = new Map(
    druzyny.filter((d) => d.pozycjaRecznie !== undefined).map((d) => [d.id, d.pozycjaRecznie!]),
  );
  const opcjeTabeli = { punktyZaWygrana: turniej.punktyZaWygrana, punktyZaRemis: turniej.punktyZaRemis };
  const tabeleGrup: { grupa?: TurniejGrupa; wiersze: ReturnType<typeof posortujTabele> }[] =
    grupy.length > 0
      ? grupy.map((g) => ({
          grupa: g,
          wiersze: posortujTabele(
            obliczTabele(
              meczeGrupowe.filter((m) => m.grupaId === g.id),
              druzyny.filter((d) => d.grupaId === g.id),
              opcjeTabeli,
            ),
            pozycjeReczne,
          ),
        }))
      : meczeGrupowe.length > 0 || turniej.format === 'liga'
        ? [{ grupa: undefined, wiersze: posortujTabele(obliczTabele(meczeGrupowe, druzyny, opcjeTabeli), pozycjeReczne) }]
        : [];

  // Drużyny pogrupowane tak, jak realnie grają. „Bez grupy" zbiera te, których
  // losowanie jeszcze nie dotknęło albo których turniej nie ma grup wcale.
  const sekcjeDruzyn =
    grupy.length > 0
      ? [
          ...grupy.map((g) => ({ tytul: `Grupa ${g.nazwa}`, lista: druzyny.filter((d) => d.grupaId === g.id) })),
          { tytul: 'Bez grupy', lista: druzyny.filter((d) => !d.grupaId) },
        ].filter((sekcja) => sekcja.lista.length > 0)
      : [{ tytul: 'Wszystkie drużyny', lista: druzyny }];

  const tabelaMaTresc = tabeleGrup.length > 0 || meczeDrabinki.length > 0;
  const stan = stanTurnieju(turniej, mecze);
  const liczbaWTurnieju = liczDruzynyWTurnieju(druzyny);
  const czekajace = liczCzekajaceZgloszenia(druzyny);
  const zapisy = stanZapisowTurnieju(turniej, liczbaWTurnieju);
  const meczeNaZywo = mecze.filter((m) => m.status === 'trwa');
  // Tabela LIGI (nie grupy) jako podstawa podium — patrz `turniejPodium.ts`.
  const tabelaLigi = turniej.format === 'liga' && tabeleGrup.length === 1
    ? tabeleGrup[0].wiersze
    : undefined;
  const podium = stan.label === 'Zakończony'
    ? podiumTurnieju(mecze, druzynyPoId, tabelaLigi)
    : [];

  // Najbliższy mecz MOJEJ drużyny — do paska „co dotyczy mnie".
  const mojNastepnyMecz = mojaDruzyna
    ? meczePrzyszle.find((m) => m.druzynaAId === mojaDruzyna.id || m.druzynaBId === mojaDruzyna.id)
    : undefined;

  const legendaAwansu = opisAwansu(
    tabeleGrup.filter((t) => t.grupa).map((t) => t.wiersze.length),
    turniej.awansujeZGrupy,
  );

  const widoczneZakladki: Zakladka[] = ['info', 'mecze', 'tabela', 'druzyny'];
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

  const zawodnicyDoStatystyk = druzyny.flatMap((d) => d.zawodnicy ?? []);
  const mvpPoMeczach = mecze
    .filter((m) => m.status === 'zakonczony' || m.status === 'walkower')
    .map((m) => ({ mvpZawodnikId: m.mvpZawodnikId }));
  const klasyfikacje = obliczKlasyfikacje(zdarzenia, mvpPoMeczach, zawodnicyDoStatystyk, druzynyPoId);
  const strzelcy = posortujKlasyfikacje(klasyfikacje, 'gole');
  const zdobycz = etykietaZdobyczy(turniej?.sport ?? '');
  const asystenci = posortujKlasyfikacje(klasyfikacje, 'asysty');
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
    const tekst = tekstPodium(turniej.nazwa, podium, linkDoTurnieju(id), krolStrzelcow);
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
    const wynik = await udostepnijTurniej(turniej, linkDoTurnieju(id));
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

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header />
      <div className="sticky top-0 z-10 border-b border-slate-100 dark:border-slate-700 bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <button onClick={wstecz} aria-label="Wróć" className="shrink-0 text-slate-500 hover:text-ink">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="min-w-0 flex-1 truncate font-display text-lg font-bold text-ink">{turniej.nazwa}</h1>
          {uprawnienia.mozeEdytowac && (
            <Link href={`/turnieje/${id}/panel`} className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
              <Settings className="h-3.5 w-3.5" /> Panel
            </Link>
          )}
        </div>
        <div className="mx-auto flex max-w-2xl gap-1 overflow-x-auto px-4 pb-2 scrollbar-hide">
          {widoczneZakladki.map((z) => (
            <button
              key={z}
              onClick={() => router.push(`/turnieje/${id}?tab=${z}`)}
              className={[
                'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                aktywna === z ? 'bg-primary-100 text-primary-700' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800',
              ].join(' ')}
            >
              {z === 'druzyny' ? `Drużyny (${druzyny.length})` : ETYKIETY_ZAKLADEK[z]}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-5">
        {turniej.status === 'szkic' && uprawnienia.mozeEdytowac && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/40 p-3.5 text-sm text-amber-800 dark:text-amber-300">
            Ten turniej jest szkicem, nikt poza Tobą go nie widzi.
          </div>
        )}

        {/* Pasek tożsamości — widoczny na KAŻDEJ zakładce, w jednej linii.
            Pełny opis (termin, miejsce, format, zasady, wpisowe, organizator,
            opis, regulamin) mieszka dziś w zakładce „Info" (niżej) — tu
            zostaje tylko to, co trzeba widzieć niezależnie od tego, na co
            patrzysz: czy turniej trwa, kiedy i ile drużyn. Wcześniej (od
            2026-09-17) cała karta stała tutaj i zasłaniała górę KAŻDEJ
            zakładki, tabelę i drabinkę szczególnie. */}
        <div className="flex items-center gap-2.5 rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 shadow-sm">
          <span className="shrink-0 text-xl">{sportEmoji(turniej.sport)}</span>
          <div className="min-w-0 flex-1 truncate text-sm text-slate-600 dark:text-slate-300">
            <span className={`mr-1.5 rounded-full px-1.5 py-0.5 text-xs font-medium ${stan.ton}`}>{stan.label}</span>
            {etykietaTerminu(turniej.dataStartu, turniej.godzinaStartu)} · {druzyny.length}/{turniej.maxDruzyn} drużyn
          </div>
          <button onClick={udostepnij} aria-label="Udostępnij" className="shrink-0 text-primary-600">
            <Share2 className="h-4 w-4" />
          </button>
        </div>

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
              <Link
                href={`/turnieje/${id}/druzyna/${mojaDruzyna.id}`}
                className="mt-3 block rounded-xl border border-primary-100 dark:border-primary-900 bg-primary-50/60 dark:bg-primary-950/30 p-3 text-left"
              >
                <span className="text-sm font-semibold text-ink">🔁 Zamień drużynę w ekipę</span>
                <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">
                  Graliście razem, grajcie dalej. Zostanie Wam ekipa z całym składem.
                </span>
              </Link>
            )}
            <Link
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
              {/* Informacja, nie werdykt: Bojo nie rozstrzyga, czy turniej się
                  odbędzie. Organizator podał liczbę, my ją pokazujemy. */}
              {turniej.minDruzyn !== undefined && liczbaWTurnieju < turniej.minDruzyn && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Organizator planuje turniej od {turniej.minDruzyn} drużyn.
                </p>
              )}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {turniej.wpisoweGrosze > 0
                ? `${(turniej.wpisoweGrosze / 100).toFixed(0)} zł od drużyny · `
                : 'Bez wpisowego · '}
              skład {turniej.minZawodnikow}–{turniej.maxZawodnikow} osób
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
            <Link
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
                  ? etykietaTerminu(mojNastepnyMecz.zaplanowanyAt.slice(0, 10), mojNastepnyMecz.zaplanowanyAt.slice(11, 16))
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

        <Ogloszenia
          ogloszenia={ogloszenia}
          blad={ogloszeniaBlad}
          mozeZarzadzac={uprawnienia.mozeEdytowac}
          onDodaj={dodajOgloszenieAkcja}
          onUsun={usunOgloszenieAkcja}
        />

        {/* Jedno działanie zgodne ze stanem turnieju, widoczne TAKŻE dla
            niezalogowanego — przegląd złapał stronę bez żadnego przycisku,
            bo „Zgłoś drużynę" wisiało wyłącznie na zakładce Info, a „Utwórz
            turniej" tylko dla zalogowanych. */}
        {przyjmujeZgloszenia(turniej, liczbaWTurnieju) && !mojaDruzyna && (
          <Link href={`/turnieje/${id}/zglos`}>
            <Button className="w-full">Zgłoś drużynę</Button>
          </Link>
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
                  {turniej.miejsceAdres && <div className="text-xs text-slate-400">{turniej.miejsceAdres}</div>}
                  {dojazd && (
                    <a href={dojazd} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600">
                      <Navigation className="h-4 w-4" /> Nawiguj
                    </a>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <div className="font-medium text-ink">{FORMAT_LABEL[turniej.format]}</div>
                <div className="text-xs text-slate-400">{opisFormatu(turniej, druzyny.length)}</div>
              </div>
            </div>

            <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <div>{druzyny.length}/{turniej.maxDruzyn} drużyn · skład {turniej.minZawodnikow}–{turniej.maxZawodnikow} osób</div>
                <div className="text-xs text-slate-400">
                  Mecz {turniej.czasMeczuMin} min
                  {turniej.przerwaMin > 0 && `, przerwa ${turniej.przerwaMin} min`}
                  {' · '}zwycięstwo {turniej.punktyZaWygrana} pkt, remis {turniej.punktyZaRemis}
                  {turniej.karnePrzyRemisie && ' · remis w fazie pucharowej rozstrzygają karne'}
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

            {organizator && (
              <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <span>Organizuje <Link href={`/gracz/${turniej.organizatorId}`} className="font-medium text-primary-600">{organizator}</Link></span>
              </div>
            )}

            {turniej.opis && <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{turniej.opis}</p>}
            {turniej.regulamin && (
              <details className="text-sm">
                <summary className="cursor-pointer font-medium text-ink">Regulamin</summary>
                <p className="mt-2 whitespace-pre-wrap text-slate-600 dark:text-slate-300">{turniej.regulamin}</p>
              </details>
            )}
          </div>
        )}

        {aktywna === 'druzyny' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">{druzyny.length}/{turniej.maxDruzyn} drużyn</span>
              {przyjmujeZgloszenia(turniej, liczbaWTurnieju) && (
                <Link href={`/turnieje/${id}/zglos`} className="text-sm font-medium text-primary-600">+ Zgłoś drużynę</Link>
              )}
            </div>
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
                      onZamienWEkipe={zamienWEkipeAkcja}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        {aktywna === 'mecze' && (
          <div className="space-y-4">
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
                {listaMeczow.map((m) => (
                  <KartaMeczu
                    key={m.id}
                    mecz={m}
                    druzynyPoId={druzynyPoId}
                    meczePoId={meczePoId}
                    arenyPoId={arenyPoId}
                    przygaszona={m.status === 'walkower' && !m.zaplanowanyAt}
                    onClick={() => router.push(`/turnieje/${id}/mecz/${m.id}`)}
                  />
                ))}
              </div>
            )}

            {meczeRozegrane.length > 0 && (
              <div className="space-y-3 border-t border-slate-100 dark:border-slate-700 pt-4">
                <h2 className="text-sm font-semibold text-slate-500">Statystyki graczy</h2>
                {!user ? (
                  <SciankaLogowania tytul="Statystyki graczy" />
                ) : (
                  <div className="space-y-4">
                    <div>
                      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{zdobycz.naglowek}</h3>
                      <Klasyfikacja wpisy={strzelcy} klucz="gole" etykietaKolumny={zdobycz.kolumna} pusteMiejsce={zdobycz.puste} />
                    </div>
                    <div>
                      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Najwięcej asyst</h3>
                      <Klasyfikacja wpisy={asystenci} klucz="asysty" etykietaKolumny="Asysty" pusteMiejsce="Jeszcze nikt nie zaliczył asysty." />
                    </div>
                    <div>
                      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Najwięcej tytułów MVP</h3>
                      <Klasyfikacja wpisy={mvpList} klucz="mvp" etykietaKolumny="MVP" pusteMiejsce="MVP jeszcze nie wybrano." />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {aktywna === 'tabela' && (
          <div className="space-y-5">
            {tabeleGrup.map(({ grupa, wiersze }) => (
              <div key={grupa?.id ?? 'liga'} className="space-y-2">
                {grupa && (
                  <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Grupa {grupa.nazwa}
                  </h2>
                )}
                <TabelaGrupy wiersze={wiersze} awansujeZGrupy={grupa ? turniej.awansujeZGrupy : undefined} />
                {grupa && (
                  <MeczeGrupy
                    mecze={meczeGrupowe.filter((m) => m.grupaId === grupa.id && rozegrany(m))}
                    druzynyPoId={druzynyPoId}
                    meczePoId={meczePoId}
                    arenyPoId={arenyPoId}
                    onKlikMeczu={(meczId) => router.push(`/turnieje/${id}/mecz/${meczId}`)}
                  />
                )}
              </div>
            ))}

            {legendaAwansu && (
              <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="h-3 w-[3px] shrink-0 rounded-full bg-primary-600" aria-hidden />
                {legendaAwansu}
              </p>
            )}

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
      </main>
      {oknoPotwierdzenia}
    </div>
  );
}
