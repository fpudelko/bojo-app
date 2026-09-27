'use client';

/**
 * Ekran drużyny turniejowej — jedyne miejsce, w którym kapitan zarządza swoim
 * składem.
 *
 * DLACZEGO POWSTAŁ. Do 2026-09-20 kapitan widział link do swojej drużyny
 * DOKŁADNIE RAZ: na ekranie potwierdzenia zgłoszenia (`/turnieje/[id]/zglos`).
 * Kto zamknął kartę, nie odzyskiwał go nigdzie — pasek „Twoja drużyna" na
 * stronie turnieju pokazywał nazwę i najbliższy mecz, a jedyne inne miejsce
 * z tym linkiem był panel organizatora, do którego kapitan nie ma wstępu.
 * A ten link jest w module turniejowym całą pętlą wzrostu: turniej na
 * 12 drużyn to ~90 zawodników, z których każdy zakłada konto WYŁĄCZNIE
 * dlatego, że kapitan wysłał mu odnośnik.
 *
 * Operacje kapitańskie (dopisz zawodnika, zmień nazwę, wycofaj drużynę) były
 * napisane i przetestowane w `lib/turniejDruzyny.ts` od migracji `145` i nie
 * miały ani jednego przycisku poza panelem organizatora.
 *
 * Ekran jest publiczny (skład za ścianą logowania, jak wszędzie w module),
 * a przyciski kapitana pokazują się wyłącznie kapitanowi.
 */

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Copy, Loader2, Share2, UserPlus, Users, Wallet,
  ChevronRight, Repeat, Settings2, CalendarDays, MapPin,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { useWstecz } from '@/lib/historia';
import { withCount } from '@/lib/plural';
import { usePotwierdzenie } from '@/lib/usePotwierdzenie';
import { getTurniej, getBlikTurnieju } from '@/lib/turnieje';
import {
  getDruzyna, getDruzyny, dodajZawodnika, usunZawodnika, updateDruzyne,
  usunDruzyne, zamienDruzyneWEkipe, mozeEdytowacSklad, brakiWSkladzie,
} from '@/lib/turniejDruzyny';
import { getMecze, getAreny } from '@/lib/turniejMecze';
import { getZaproszeniaDruzyny } from '@/lib/turniejZaproszenia';
import { STATUS_DRUZYNY, etykietaTerminu, odmienZawodnikow } from '@/lib/turniejEtykiety';
import { sportEmoji } from '@/lib/sports';
import ZaprosZEkipyDialog from '@/components/turnieje/ZaprosZEkipyDialog';
import SciankaLogowania from '@/components/turnieje/SciankaLogowania';
import KartaMeczu from '@/components/turnieje/KartaMeczu';
import type { Turniej, TurniejArena, TurniejDruzyna, TurniejMecz } from '@/types';

const inputCls =
  'w-full rounded-xl border border-slate-300 dark:border-slate-600 px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-700 dark:text-slate-100';

export default function DruzynaClient() {
  const { id, druzynaId } = useParams<{ id: string; druzynaId: string }>();
  const router = useRouter();
  const wstecz = useWstecz(`/turnieje/${id}?tab=druzyny`);
  const { user, loading: ladujeSesje } = useAuth();
  const { toast } = useToast();
  const { potwierdz, oknoPotwierdzenia } = usePotwierdzenie();

  const [turniej, setTurniej] = useState<Turniej | null>(null);
  const [druzyna, setDruzyna] = useState<TurniejDruzyna | null>(null);
  const [mecze, setMecze] = useState<TurniejMecz[]>([]);
  const [areny, setAreny] = useState<TurniejArena[]>([]);
  const [nazwyDruzyn, setNazwyDruzyn] = useState<Map<string, string>>(new Map());
  const [zaproszonych, setZaproszonych] = useState<string[]>([]);
  const [blikTelefon, setBlikTelefon] = useState<string | null>(null);
  const [ladowanie, setLadowanie] = useState(true);
  const [nieZnaleziono, setNieZnaleziono] = useState(false);

  const [noweImie, setNoweImie] = useState('');
  const [dopisuje, setDopisuje] = useState(false);
  const [pokazZaproszenia, setPokazZaproszenia] = useState(false);
  const [pokazUstawienia, setPokazUstawienia] = useState(false);
  const [nowaNazwa, setNowaNazwa] = useState('');

  const wczytaj = useCallback(async () => {
    const t = await getTurniej(id);
    const d = await getDruzyna(druzynaId);
    if (!t || !d || d.turniejId !== id) { setNieZnaleziono(true); return; }
    setTurniej(t);
    setDruzyna(d);
    setNowaNazwa(d.nazwa);
    const [m, a, wszystkie] = await Promise.all([getMecze(id), getAreny(id), getDruzyny(id)]);
    setMecze(m);
    setAreny(a);
    setNazwyDruzyn(new Map(wszystkie.map((x) => [x.id, x.nazwa])));
  }, [id, druzynaId]);

  useEffect(() => {
    let aktualne = true;
    setLadowanie(true);
    wczytaj()
      .catch(() => { if (aktualne) setNieZnaleziono(true); })
      .finally(() => { if (aktualne) setLadowanie(false); });
    return () => { aktualne = false; };
  }, [wczytaj]);

  // Zaproszenia i BLIK woła się „na wszelki wypadek": RLS i tak odda je
  // wyłącznie kapitanowi, więc nie trzeba wcześniej sprawdzać roli.
  useEffect(() => {
    if (!user) return;
    let aktualne = true;
    getZaproszeniaDruzyny(druzynaId)
      .then((z) => { if (aktualne) setZaproszonych(z.filter((x) => !x.dismissedAt).map((x) => x.userId)); })
      .catch(() => undefined);
    getBlikTurnieju(id)
      .then((b) => { if (aktualne) setBlikTelefon(b); })
      .catch(() => undefined);
    return () => { aktualne = false; };
  }, [user, id, druzynaId]);

  const jestKapitanem = !!user && druzyna?.kapitanId === user.id;
  const link = typeof window !== 'undefined' && druzyna
    ? `${window.location.origin}/t/${druzyna.kodDolaczenia}`
    : '';

  const kopiuj = async (tekst: string, etykieta = 'Link') => {
    try {
      await navigator.clipboard.writeText(tekst);
      toast(`${etykieta} skopiowany`);
    } catch {
      toast('Nie udało się skopiować', 'error');
    }
  };

  const wyslij = async () => {
    if (!druzyna || !turniej) return;
    const tekst = `Dołącz do drużyny ${druzyna.nazwa} w turnieju ${turniej.nazwa}, ${etykietaTerminu(turniej.dataStartu, turniej.godzinaStartu)}`;
    // Ten sam wzorzec co `udostepnijTurniej()`: arkusz systemowy tam, gdzie
    // jest, schowek wszędzie indziej. Na telefonie liczy się pierwsza droga —
    // link idzie prosto na WhatsAppa.
    if (navigator.share) {
      try {
        await navigator.share({ title: druzyna.nazwa, text: tekst, url: link });
        return;
      } catch {
        return; // anulowanie arkusza nie jest błędem
      }
    }
    await kopiuj(`${tekst}\n${link}`, 'Zaproszenie');
  };

  const dopiszZawodnika = async () => {
    if (!druzyna || !turniej || noweImie.trim().length < 1) return;
    setDopisuje(true);
    try {
      await dodajZawodnika(druzyna.id, turniej.id, noweImie.trim());
      setNoweImie('');
      await wczytaj();
      toast('Dopisany do składu');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się dopisać', 'error');
    } finally {
      setDopisuje(false);
    }
  };

  const usunZeSkladu = async (zawodnikId: string, imie: string) => {
    const wynik = await potwierdz({
      tytul: `Usunąć ${imie} ze składu?`,
      konsekwencje: ['Zawodnik zniknie z listy, ale może dołączyć ponownie linkiem'],
      potwierdzLabel: 'Usuń',
      wariant: 'destrukcyjny',
    });
    if (wynik !== 'tak') return;
    try {
      await usunZawodnika(zawodnikId);
      await wczytaj();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się usunąć', 'error');
    }
  };

  const zapiszNazwe = async () => {
    if (!druzyna || nowaNazwa.trim() === druzyna.nazwa) { setPokazUstawienia(false); return; }
    try {
      await updateDruzyne(druzyna.id, { nazwa: nowaNazwa.trim() });
      await wczytaj();
      setPokazUstawienia(false);
      toast('Nazwa zmieniona');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się zmienić nazwy', 'error');
    }
  };

  const wycofaj = async () => {
    if (!druzyna) return;
    const wynik = await potwierdz({
      tytul: `Wycofać drużynę ${druzyna.nazwa}?`,
      konsekwencje: [
        'Drużyna zniknie z listy uczestników turnieju',
        'Skład i zaproszenia przepadną',
        'Tego nie da się cofnąć',
      ],
      potwierdzLabel: 'Wycofaj drużynę',
      wariant: 'destrukcyjny',
    });
    if (wynik !== 'tak') return;
    try {
      await usunDruzyne(druzyna.id);
      toast('Drużyna wycofana');
      router.push(`/turnieje/${id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się wycofać drużyny', 'error');
    }
  };

  const wEkipe = async () => {
    if (!druzyna) return;
    const wynik = await potwierdz({
      tytul: 'Zamienić drużynę w ekipę?',
      konsekwencje: [
        'Powstanie nowa ekipa w Bojo z tą samą nazwą',
        'Zawodnicy z kontem trafią do niej od razu',
      ],
      potwierdzLabel: 'Zamień w ekipę',
    });
    if (wynik !== 'tak') return;
    try {
      const grupaId = await zamienDruzyneWEkipe(druzyna.id);
      toast('Ekipa założona 🎉');
      router.push(`/grupy/${grupaId}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się założyć ekipy', 'error');
    }
  };

  if (ladowanie || ladujeSesje) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header />
        <div className="flex-1 py-24 text-center text-sm text-slate-400">Ładuję…</div>
      </div>
    );
  }

  if (nieZnaleziono || !turniej || !druzyna) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header />
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-16 text-center">
          <p className="font-medium text-ink">Nie ma takiej drużyny</p>
          <Link href={`/turnieje/${id}`} className="mt-3 inline-block text-sm font-medium text-primary-600">
            Wróć do turnieju
          </Link>
        </main>
      </div>
    );
  }

  const zawodnicy = druzyna.zawodnicy ?? [];
  const brakuje = brakiWSkladzie(turniej, zawodnicy.length);
  const wolnoZmieniac = mozeEdytowacSklad(turniej, druzyna);
  const komplet = turniej.maxZawodnikow > 0 && zawodnicy.length >= turniej.maxZawodnikow;
  const procent = turniej.minZawodnikow > 0
    ? Math.min(100, Math.round((zawodnicy.length / turniej.minZawodnikow) * 100))
    : 100;
  const status = STATUS_DRUZYNY[druzyna.status];
  const naszeMecze = mecze.filter(
    (m) => m.druzynaAId === druzyna.id || m.druzynaBId === druzyna.id,
  );
  const poTurnieju = turniej.status === 'zakonczony';
  const arenyPoId = new Map(areny.map((a) => [a.id, a.nazwa]));
  const meczePoId = new Map(mecze.map((m) => [m.id, m]));

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header />
      <main className="mx-auto w-full max-w-lg flex-1 space-y-4 px-4 py-6">
        <button onClick={wstecz} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink transition-colors">
          <ArrowLeft className="h-4 w-4" /> Wróć
        </button>

        <div>
          <div className="flex items-start gap-2">
            <h1 className="min-w-0 flex-1 font-display text-2xl font-bold text-ink">{druzyna.nazwa}</h1>
            <span className={`mt-1.5 shrink-0 rounded px-2 py-0.5 text-xs font-medium ${status.ton}`}>
              {status.label}
            </span>
          </div>
          <Link
            href={`/turnieje/${id}`}
            className="mt-1 inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-slate-500 dark:text-slate-400 hover:text-ink"
          >
            <span>{sportEmoji(turniej.sport)} {turniej.nazwa}</span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />{etykietaTerminu(turniej.dataStartu, turniej.godzinaStartu)}
            </span>
          </Link>
        </div>

        {/* ── Kompletowanie składu — serce tego ekranu ──────────────────────
            Licznik zamienia bierne czekanie w czynność: widać, ilu brakuje,
            i stoi obok jeden przycisk, żeby to zmienić. */}
        {jestKapitanem && wolnoZmieniac && (
          <div className="rounded-2xl border border-primary-100 dark:border-primary-900 bg-primary-50/60 dark:bg-primary-950/30 p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-ink">
                {/* „7 osób (od 5 do 12)", nie „7 z 5". Poprzedni zapis pokazywał
                    liczbę wobec MINIMUM, więc skład kompletny wyglądał na
                    przepełniony albo na zepsuty licznik: „Skład: 7 z 5"
                    czyta się jak przekroczenie limitu, a nie jak spełniony
                    warunek (audyt 4). */}
                Skład: {withCount(zawodnicy.length, 'osoba', 'osoby', 'osób')} (od {turniej.minZawodnikow} do {turniej.maxZawodnikow})
              </p>
              <div className="mt-1.5 h-2 overflow-hidden rounded bg-white/70 dark:bg-slate-800">
                <div className="h-full rounded bg-primary-600 transition-all" style={{ width: `${procent}%` }} />
              </div>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
                {brakuje > 0
                  ? `Brakuje ${odmienZawodnikow(brakuje)} do pełnego składu.`
                  : 'Skład kompletny, możecie grać.'}
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={wyslij} className="flex-1 inline-flex items-center justify-center gap-1.5">
                <Share2 className="h-4 w-4" /> Wyślij link
              </Button>
              <Button variant="outline" onClick={() => setPokazZaproszenia(true)} className="flex-1 inline-flex items-center justify-center gap-1.5">
                <Users className="h-4 w-4" /> Zaproś z ekipy
              </Button>
            </div>

            <button
              onClick={() => kopiuj(link, 'Link drużyny')}
              className="flex w-full items-center gap-2 rounded-xl border border-primary-200 dark:border-primary-900 bg-white dark:bg-slate-800 px-3 py-2 text-left"
            >
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-500 dark:text-slate-400">{link}</span>
              <Copy className="h-4 w-4 shrink-0 text-primary-600" />
            </button>
          </div>
        )}

        {/* ── Skład ─────────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-500">
            Zawodnicy {!user ? '' : `(${zawodnicy.length})`}
          </h2>

          {!user ? (
            <SciankaLogowania tytul={`Skład drużyny ${druzyna.nazwa}`} />
          ) : zawodnicy.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">
              {jestKapitanem
                ? 'Skład jest jeszcze pusty. Wyślij link kolegom albo dopisz ich niżej.'
                : 'Skład jeszcze pusty.'}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {zawodnicy.map((z) => (
                <li key={z.id} className="flex items-center gap-2 py-1">
                  {z.numer !== undefined && (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-100 dark:bg-slate-700 text-[11px] font-mono">
                      {z.numer}
                    </span>
                  )}
                  {/* Zawodnik z kontem prowadzi do profilu, dopisany z ręki
                      zostaje tekstem — ta sama reguła co w `KartaDruzyny`. */}
                  {z.userId ? (
                    <Link href={`/gracz/${z.userId}`} className="flex min-h-[44px] min-w-0 flex-1 items-center gap-1 text-sm text-slate-700 dark:text-slate-200">
                      <span className="min-w-0 truncate">{z.imie}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                    </Link>
                  ) : (
                    <span className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                      <span className="min-w-0 truncate">{z.imie}</span>
                      <span className="shrink-0 text-xs text-slate-400">bez konta</span>
                    </span>
                  )}
                  {z.kapitan && <span className="shrink-0 text-xs text-slate-400">kapitan</span>}
                  {jestKapitanem && wolnoZmieniac && !z.kapitan && (
                    <button
                      onClick={() => usunZeSkladu(z.id, z.imie)}
                      className="shrink-0 px-2 text-xs font-medium text-slate-400 hover:text-red-600"
                    >
                      Usuń
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {jestKapitanem && wolnoZmieniac && !komplet && (
            <div className="mt-3 flex gap-2 border-t border-slate-100 dark:border-slate-700 pt-3">
              <input
                value={noweImie}
                onChange={(e) => setNoweImie(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') dopiszZawodnika(); }}
                placeholder="Imię i nazwisko"
                className={inputCls}
              />
              <Button onClick={dopiszZawodnika} disabled={dopisuje || noweImie.trim().length < 1} className="shrink-0 inline-flex items-center gap-1.5">
                {dopisuje ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Dopisz
              </Button>
            </div>
          )}
          {jestKapitanem && wolnoZmieniac && !komplet && (
            <p className="mt-1.5 text-xs text-slate-400">
              Dopisujesz kogoś bez konta: nie zobaczy terminarza ani swoich goli w aplikacji.
            </p>
          )}
          {jestKapitanem && komplet && (
            <p className="mt-3 border-t border-slate-100 dark:border-slate-700 pt-3 text-xs text-slate-400">
              Skład pełny ({turniej.maxZawodnikow} zawodników), nikogo więcej nie dopiszesz.
            </p>
          )}
        </div>

        {/* ── Wpisowe ───────────────────────────────────────────────────── */}
        {turniej.wpisoweGrosze > 0 && jestKapitanem && (
          <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
            <h2 className="mb-1 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500">
              <Wallet className="h-4 w-4" /> Wpisowe
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {(turniej.wpisoweGrosze / 100).toFixed(0)} zł:{' '}
              {druzyna.wpisoweOplaconeAt
                ? <span className="font-medium text-primary-700">opłacone ✓</span>
                : <span>nieopłacone</span>}
            </p>
            {!druzyna.wpisoweOplaconeAt && (
              blikTelefon ? (
                <button
                  onClick={() => kopiuj(blikTelefon, 'Numer BLIK')}
                  className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600"
                >
                  BLIK: {blikTelefon} <Copy className="h-3.5 w-3.5" />
                </button>
              ) : (
                <p className="mt-1.5 text-xs text-slate-400">
                  Organizator nie podał jeszcze numeru BLIK.
                </p>
              )
            )}
          </div>
        )}

        {/* ── Nasze mecze ───────────────────────────────────────────────── */}
        {naszeMecze.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-500">Nasze mecze</h2>
            {naszeMecze.map((m) => (
              <KartaMeczu
                key={m.id}
                mecz={m}
                druzynyPoId={nazwyDruzyn}
                meczePoId={meczePoId}
                arenyPoId={arenyPoId}
                onClick={() => router.push(`/turnieje/${id}/mecz/${m.id}`)}
              />
            ))}
          </div>
        )}

        {/* ── Po turnieju: drużyna zostaje ekipą ────────────────────────── */}
        {jestKapitanem && poTurnieju && (
          <button
            onClick={wEkipe}
            className="w-full rounded-2xl border border-primary-100 dark:border-primary-900 bg-primary-50/60 dark:bg-primary-950/30 p-4 text-left"
          >
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Repeat className="h-4 w-4" /> Zamień drużynę w ekipę
            </span>
            <span className="mt-0.5 block text-sm text-slate-600 dark:text-slate-300">
              Graliście razem, grajcie dalej. Zostanie Wam ekipa w Bojo z całym składem.
            </span>
          </button>
        )}

        {/* ── Ustawienia drużyny ────────────────────────────────────────── */}
        {jestKapitanem && wolnoZmieniac && (
          <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
            <button
              onClick={() => setPokazUstawienia((v) => !v)}
              aria-expanded={pokazUstawienia}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-ink"
            >
              <Settings2 className="h-4 w-4" /> Ustawienia drużyny
            </button>
            {pokazUstawienia && (
              <div className="mt-3 space-y-3 border-t border-slate-100 dark:border-slate-700 pt-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Nazwa drużyny
                  </label>
                  <div className="flex gap-2">
                    <input value={nowaNazwa} onChange={(e) => setNowaNazwa(e.target.value)} className={inputCls} />
                    <Button onClick={zapiszNazwe} disabled={nowaNazwa.trim().length < 2} className="shrink-0">Zapisz</Button>
                  </div>
                </div>
                <button onClick={wycofaj} className="text-sm font-medium text-red-600 hover:text-red-700">
                  Wycofaj drużynę z turnieju
                </button>
              </div>
            )}
          </div>
        )}

        {/* Ktoś, kto nie jest kapitanem, ale jest w składzie — dla niego ten
            ekran jest podglądem, nie panelem. Jedna droga wyjścia zamiast
            ślepego zaułka. */}
        {!jestKapitanem && (
          <Link
            href={`/turnieje/${id}`}
            className="flex items-center gap-2 rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-sm text-slate-600 dark:text-slate-300 shadow-sm"
          >
            <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="min-w-0 flex-1">Terminarz, tabela i pozostałe drużyny</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
          </Link>
        )}
      </main>

      {pokazZaproszenia && user && (
        <ZaprosZEkipyDialog
          druzynaId={druzyna.id}
          druzynaNazwa={druzyna.nazwa}
          userId={user.id}
          wSkladzieUserIds={zawodnicy.map((z) => z.userId).filter((x): x is string => !!x)}
          juzZaproszeni={zaproszonych}
          onClose={() => setPokazZaproszenia(false)}
          onZaproszeni={async (ile) => {
            setPokazZaproszenia(false);
            toast(ile > 0 ? `Wysłano ${ile === 1 ? 'zaproszenie' : 'zaproszenia'}` : 'Nikt nowy nie został zaproszony');
            const z = await getZaproszeniaDruzyny(druzynaId).catch(() => []);
            setZaproszonych(z.filter((x) => !x.dismissedAt).map((x) => x.userId));
          }}
        />
      )}
      {oknoPotwierdzenia}
    </div>
  );
}
