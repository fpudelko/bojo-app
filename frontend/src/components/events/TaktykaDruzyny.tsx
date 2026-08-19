'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Send, Trash2, Users } from 'lucide-react';
import { useAuth, displayName } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import {
  inicjaly,
  OPCJE_TAKTYKI, WARTOSC_INNE, domyslneUstawienie, odpowiedzTaktyki, opisTaktyki,
  pozycjeZeSchematu, ustawieniaDlaSkladu, type KluczTaktyki, type Taktyka,
} from '@/lib/taktyka';
import {
  pobierzPozycje, pobierzUstawienie, pobierzWiadomosciDruzyny, ustawNaPozycji,
  usunWiadomoscDruzyny, wyslijDoDruzyny, zapiszUstawienie, zdejmijZPozycji,
  type Druzyna, type WiadomoscDruzyny,
} from '@/lib/taktykaApi';
import type { EventParticipant } from '@/types';

/**
 * Taktyka jednej drużyny: ustawienie na boisku, przypisanie graczy do pozycji,
 * cztery decyzje taktyczne i czat wyłącznie dla tej drużyny.
 *
 * USTAWIA WYŁĄCZNIE KAPITAN, reszta drużyny to samo widzi. Bez tego skład
 * zmieniałby się pod ręką dziesięciu osób naraz i nikt nie wiedziałby, która
 * wersja obowiązuje — a ustalenie ustawienia to jedna decyzja, nie głosowanie.
 * Kapitana wskazuje organizator (albo współorganizator od składów) w zakładce
 * „Mecz" — gwiazdką przy nazwisku, niezależnie od trybu dzielenia drużyn.
 * Dla reszty ten sam ekran renderuje się jako czytelny opis: boisko z obsadą,
 * cztery odpowiedzi i notatka — bez ani jednego przycisku, który i tak nic by
 * nie zrobił.
 *
 * PRZYPISANIE PRZEZ DWA STUKNIĘCIA, NIE PRZECIĄGANIE. Przeciąganie na
 * telefonie walczy z przewijaniem strony i wymaga precyzji, której nie ma się
 * jedną ręką w tramwaju: stukasz pozycję, potem nazwisko z listy. Ten sam
 * wzorzec działa myszą, więc nie ma dwóch osobnych ścieżek do utrzymania.
 *
 * BOISKO PIONOWO, bo tak wygląda ekran telefonu. Współrzędne z
 * `pozycjeZeSchematu()` są w procentach, więc pole skaluje się samo i nie ma
 * tu ani jednej wartości w pikselach.
 */
export default function TaktykaDruzyny({
  eventId, team, nazwa, sport, gracze, mozeEdytowac, kapitan, mozeWskazacKapitana,
}: {
  eventId: string;
  team: Druzyna;
  nazwa: string;
  sport?: string;
  /** Gracze przypisani do tej drużyny — z zakładki Skład. */
  gracze: EventParticipant[];
  /** Czy patrzący jest kapitanem tej drużyny. `false` = widok do czytania. */
  mozeEdytowac: boolean;
  /** Imię kapitana — do zdania „ustawia {kto}", żeby wiadomo było, kogo pytać. */
  kapitan?: string;
  /** Czy patrzący może kapitana POWOŁAĆ (organizator, współorganizator od
   *  składów). Decyduje wyłącznie o treści komunikatu przy braku kapitana:
   *  jemu mówimy, gdzie kliknąć, reszcie — kogo poprosić. */
  mozeWskazacKapitana?: boolean;
}) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [schemat, setSchemat] = useState<string | null>(null);
  const [taktyka, setTaktyka] = useState<Taktyka>({});
  const [notatka, setNotatka] = useState('');
  const [opublikowana, setOpublikowana] = useState(false);
  // Czy w ogóle DOSTALIŚMY ustawienie. Dla nie-kapitana przed publikacją baza
  // nie zwraca wiersza (polityka z `107`), więc brak danych znaczy tu „jeszcze
  // nieopublikowane", a nie „puste boisko" — i tak trzeba to napisać wprost,
  // bo domyślny schemat narysowałby ustawienie, którego nikt nie wybrał.
  const [maUstawienie, setMaUstawienie] = useState(false);
  const [pozycje, setPozycje] = useState<Record<number, string>>({});
  // Wybór działa W OBIE STRONY: pozycja → gracz albo gracz → pozycja.
  // Jedna kolejność zawsze komuś nie pasuje — patrzysz na wolną pozycję i
  // szukasz kogoś ALBO patrzysz na człowieka bez pozycji i szukasz mu miejsca.
  // Naraz aktywny jest tylko jeden wybór; kliknięcie drugiej strony domyka parę.
  const [wybranySlot, setWybranySlot] = useState<number | null>(null);
  const [wybranyGracz, setWybranyGracz] = useState<string | null>(null);
  const [ladowanie, setLadowanie] = useState(true);

  const [wiadomosci, setWiadomosci] = useState<WiadomoscDruzyny[]>([]);
  const [tresc, setTresc] = useState('');
  const [wysylanie, setWysylanie] = useState(false);
  const konGiecListy = useRef<HTMLDivElement>(null);

  const dostepne = ustawieniaDlaSkladu(sport, gracze.length);
  const aktualnySchemat = schemat ?? domyslneUstawienie(sport, gracze.length);
  const sloty = pozycjeZeSchematu(aktualnySchemat);

  const wczytaj = useCallback(async () => {
    setLadowanie(true);
    try {
      const [u, p, w] = await Promise.all([
        pobierzUstawienie(eventId, team),
        pobierzPozycje(eventId, team),
        pobierzWiadomosciDruzyny(eventId, team),
      ]);
      setMaUstawienie(!!u);
      if (u) {
        setSchemat(u.schemat);
        setTaktyka(u.taktyka);
        setNotatka(u.notatka ?? '');
        setOpublikowana(u.opublikowana);
      }
      setPozycje(p);
      setWiadomosci(w);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się wczytać taktyki', 'error');
    } finally {
      setLadowanie(false);
    }
  }, [eventId, team, toast]);

  useEffect(() => { wczytaj(); }, [wczytaj]);
  useEffect(() => {
    konGiecListy.current?.scrollIntoView({ block: 'end' });
  }, [wiadomosci.length]);

  if (!user) return null;

  const zmienSchemat = async (nowy: string) => {
    setSchemat(nowy);
    // Pozycje NIE są czyszczone przy zmianie ustawienia: numery slotów są
    // wspólne, więc przejście 1-4-4-2 → 1-4-3-3 zachowuje obronę i bramkarza,
    // a rusza tylko to, co naprawdę się zmieniło. Czyszczenie wszystkiego
    // zmuszałoby do ustawiania składu od nowa po każdym kliknięciu.
    try {
      await zapiszUstawienie(eventId, team, { schemat: nowy }, user.id);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się zapisać ustawienia', 'error');
    }
  };

  const przelaczPublikacje = async () => {
    const nowa = !opublikowana;
    setOpublikowana(nowa);
    try {
      await zapiszUstawienie(eventId, team, { opublikowana: nowa, schemat: aktualnySchemat }, user.id);
      toast(nowa ? 'Taktyka opublikowana — drużyna ją widzi' : 'Taktyka ukryta');
    } catch (e) {
      setOpublikowana(!nowa);
      toast(e instanceof Error ? e.message : 'Nie udało się zmienić widoczności', 'error');
    }
  };

  const zapiszTaktyke = async (nowa: Taktyka) => {
    try {
      await zapiszUstawienie(eventId, team, { taktyka: nowa }, user.id);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się zapisać taktyki', 'error');
    }
  };

  const zmienTaktyke = async (klucz: KluczTaktyki, wartosc: string) => {
    // Ponowne kliknięcie w wybraną opcję ją zdejmuje — bez tego decyzji nie
    // dałoby się cofnąć, a „nie ustalamy tego" jest poprawną odpowiedzią.
    const nowa = { ...taktyka, [klucz]: taktyka[klucz] === wartosc ? undefined : wartosc } as Taktyka;
    setTaktyka(nowa);
    await zapiszTaktyke(nowa);
  };

  const przypisz = async (participantId: string, doSlotu?: number) => {
    const slot = doSlotu ?? wybranySlot;
    if (slot === null || slot === undefined) return;
    setWybranySlot(null);
    setWybranyGracz(null);
    try {
      await ustawNaPozycji(eventId, team, slot, participantId);
      setPozycje((prev) => {
        const kopia: Record<number, string> = {};
        // Zdejmujemy gracza z poprzedniej pozycji także w stanie widoku —
        // baza już to zrobiła, ale bez tego nazwisko wisi w dwóch miejscach
        // do czasu przeładowania.
        for (const [s, id] of Object.entries(prev)) {
          if (id !== participantId) kopia[Number(s)] = id;
        }
        kopia[slot] = participantId;
        return kopia;
      });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się ustawić gracza', 'error');
    }
  };

  const zdejmij = async (slot: number) => {
    try {
      await zdejmijZPozycji(eventId, team, slot);
      setPozycje((prev) => {
        const kopia = { ...prev };
        delete kopia[slot];
        return kopia;
      });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się zdjąć gracza', 'error');
    }
  };

  const wyslij = async () => {
    if (!tresc.trim() || wysylanie) return;
    setWysylanie(true);
    try {
      const w = await wyslijDoDruzyny(eventId, team, user.id, displayName(user), tresc);
      setWiadomosci((prev) => [...prev, w]);
      setTresc('');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się wysłać', 'error');
    } finally {
      setWysylanie(false);
    }
  };

  const usun = async (id: string) => {
    try {
      await usunWiadomoscDruzyny(id);
      setWiadomosci((prev) => prev.filter((w) => w.id !== id));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się usunąć', 'error');
    }
  };

  const graczById = new Map(gracze.map((g) => [g.id, g]));
  const obsadzeni = new Set(Object.values(pozycje));
  const bezPozycji = gracze.filter((g) => !obsadzeni.has(g.id));

  if (ladowanie) {
    return <div className="flex justify-center py-10 text-slate-300"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  // Widok dla drużyny przed publikacją: sam komunikat i czat. Bez tego
  // renderowałoby się boisko z domyślnym ustawieniem i pustymi pozycjami,
  // czyli plan, którego kapitan nigdy nie ułożył.
  const czekamyNaKapitana = !mozeEdytowac && !maUstawienie;

  return (
    <div className="space-y-4">
      {/* Bez kapitana ta zakładka nie ma kogo czekać — a poprzednia treść
          („Kapitan pokaże ustawienie") sugerowała, że ktoś taki istnieje
          i się ociąga. Mówimy więc wprost, czego brakuje, i kto to naprawia:
          organizatorowi pokazujemy gdzie kliknąć, reszcie — kogo poprosić. */}
      {czekamyNaKapitana && !kapitan && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
          <p className="text-sm font-semibold text-ink">Drużyna nie ma jeszcze kapitana</p>
          <p className="mt-1 text-xs text-slate-600">
            {mozeWskazacKapitana
              ? 'Wskaż go w zakładce Mecz — gwiazdka przy nazwisku na liście składów. Kapitan ustawia taktykę i publikuje ją drużynie.'
              : 'Taktykę ustawia kapitan. Poproś organizatora, żeby kogoś wskazał — rozmowa drużyny działa już teraz.'}
          </p>
        </div>
      )}

      {czekamyNaKapitana && kapitan && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center dark:border-slate-700 dark:bg-slate-800">
          <p className="text-sm font-semibold text-ink">Taktyka jeszcze nieustalona</p>
          <p className="mt-1 text-xs text-slate-500">
            {kapitan} (kapitan) pokaże ustawienie, gdy będzie gotowe.
            Rozmowa drużyny działa już teraz.
          </p>
        </div>
      )}

      {/* ── Publikacja ─────────────────────────────────────────────────
          Wzorem publikacji składu: kapitan układa na raty i sam decyduje,
          kiedy to jest gotowe. Bez tego drużyna oglądałaby każdą pośrednią
          wersję i nie odróżniała „tak gramy" od „tak akurat wyszło". */}
      {mozeEdytowac && (
        <div className={`flex items-center gap-3 rounded-2xl border p-3 ${
          opublikowana ? 'border-primary-200 bg-primary-50' : 'border-amber-200 bg-amber-50'
        }`}>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">
              {opublikowana ? 'Drużyna widzi tę taktykę' : 'Widzisz to tylko Ty'}
            </p>
            <p className="text-xs text-slate-500">
              {opublikowana
                ? 'Zmiany, które teraz zrobisz, są widoczne od razu.'
                : 'Ułóż spokojnie, a potem opublikuj — do tego czasu nikt tego nie ogląda.'}
            </p>
          </div>
          <button
            type="button"
            onClick={przelaczPublikacje}
            className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition ${
              opublikowana
                ? 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                : 'bg-primary-700 text-white hover:bg-primary-800'
            }`}
          >
            {opublikowana ? 'Ukryj' : 'Opublikuj taktykę'}
          </button>
        </div>
      )}

      {!czekamyNaKapitana && (<>
      {/* ── Ustawienie ─────────────────────────────────────────────── */}
      <div>
        <div className="mb-1.5 flex items-baseline gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Ustawienie</p>
          {!mozeEdytowac && (
            <span className="text-[11px] text-slate-400">
              ustawia {kapitan ? `kapitan · ${kapitan}` : 'kapitan drużyny'}
            </span>
          )}
        </div>
        {mozeEdytowac ? (
        <div className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {dostepne.map((u) => (
            <button
              key={u.schemat}
              type="button"
              onClick={() => zmienSchemat(u.schemat)}
              title={u.opis}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition ${
                aktualnySchemat === u.schemat
                  ? 'border-primary-700 bg-primary-50 text-primary-700'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              {u.schemat.replace(/^1-/, '')}
            </button>
          ))}
        </div>
        ) : (
          <p className="text-sm font-bold text-ink">{aktualnySchemat.replace(/^1-/, '')}</p>
        )}
        <p className="mt-1 text-xs text-slate-500">
          {dostepne.find((u) => u.schemat === aktualnySchemat)?.opis}
        </p>
      </div>

      {/* ── Boisko ─────────────────────────────────────────────────── */}
      {/* Węższe niż cała szerokość ekranu (`max-w-[300px]`) i wyśrodkowane.
          Pełna szerokość telefonu dawała boisko wysokie na pół ekranu, po
          którym trzeba było przewijać, żeby zobaczyć obie linie naraz —
          a to jest obrazek do rzutu oka, nie mapa w skali (zgłoszone wprost). */}
      <div className="relative mx-auto w-full max-w-[300px] overflow-hidden rounded-2xl bg-primary-700" style={{ aspectRatio: '3 / 4' }}>
        {/* Linie boiska rysowane tłem, nie obrazkiem: obrazek trzeba by
            dowozić w dwóch wariantach kolorystycznych i skalować. */}
        <div className="pointer-events-none absolute inset-3 rounded-lg border-2 border-white/25" />
        <div className="pointer-events-none absolute inset-x-3 top-1/2 border-t-2 border-white/25" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/25" />
        <div className="pointer-events-none absolute inset-x-1/4 top-3 h-12 rounded-b-lg border-2 border-t-0 border-white/25" />
        <div className="pointer-events-none absolute inset-x-1/4 bottom-3 h-12 rounded-t-lg border-2 border-b-0 border-white/25" />

        {sloty.map((poz) => {
          const gracz = pozycje[poz.slot] ? graczById.get(pozycje[poz.slot]) : undefined;
          const wybrany = wybranySlot === poz.slot;
          return (
            <button
              key={poz.slot}
              type="button"
              disabled={!mozeEdytowac}
              onClick={() => {
                // Mam już wybranego gracza? Stuknięcie pozycji go tu stawia —
                // także wtedy, gdy pozycja jest zajęta (podmiana jest tym,
                // czego się w tym momencie oczekuje, a nie błędem).
                if (wybranyGracz) return przypisz(wybranyGracz, poz.slot);
                if (gracz) return zdejmij(poz.slot);
                return setWybranySlot(wybrany ? null : poz.slot);
              }}
              style={{ left: `${poz.x}%`, top: `${100 - poz.y}%` }}
              className="absolute flex h-8 w-[4.25rem] -translate-x-1/2 -translate-y-1/2 items-center justify-center disabled:cursor-default"
              aria-label={gracz ? `${poz.nazwa}: ${gracz.name}` : `${poz.nazwa} — wolna pozycja`}
            >
              <span className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-[10px] font-bold shadow transition ${
                gracz
                  ? 'border-white bg-white text-primary-800'
                  : wybrany || (wybranyGracz && !gracz)
                    ? 'border-accent-400 bg-accent-400 text-primary-950'
                    : 'border-white/60 bg-primary-800/70 text-white/80'
              }`}>
                {gracz ? inicjaly(gracz.name) : poz.rola}
              </span>
              {/* CAŁE nazwisko, łamane na dwie linijki — nie samo imię.
                  Skrót do imienia gubił dokładnie tę informację, po którą się
                  tu patrzy: w składzie bywa dwóch Kubów i dwóch Mateuszów,
                  a wtedy plan gry przestaje cokolwiek znaczyć. Łamanie zamiast
                  ucięcia, bo ucięte „Mateusz Bazar…" jest tak samo bezużyteczne
                  jak samo imię.

                  PODPIS POZYCJONOWANY ABSOLUTNIE, nie jako druga komórka
                  kolumny: przy dolnej linii przenosimy go NAD kółko, a gdyby
                  siedział w tym samym układzie, przeniesienie zjechałoby całym
                  guzikiem w dół (środek `-translate-y-1/2` liczy się z całej
                  wysokości) i krawędź ucięłaby nazwisko mimo przeniesienia.
                  Tak kółko stoi dokładnie na swoim punkcie w obu wariantach.

                  Dolna linia to bramkarz na `y = 6`, czyli 94% wysokości
                  murawy — pod nim nie ma już miejsca na dwie linijki.
                  Dosunięcie go wyżej odpadało: stałby poza polem karnym,
                  czyli tam, gdzie bramkarz nie stoi. */}
              <span
                className={`absolute left-1/2 w-[4.25rem] -translate-x-1/2 break-words text-center text-[9px] font-semibold leading-[1.15] text-white drop-shadow ${
                  poz.y < 15 ? 'bottom-full mb-0.5' : 'top-full mt-0.5'
                }`}
              >
                {gracz ? gracz.name : poz.nazwa}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Ławka ──────────────────────────────────────────────────── */}
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
          {mozeEdytowac && wybranySlot !== null
            ? `Kogo na pozycję „${sloty.find((s) => s.slot === wybranySlot)?.nazwa}"?`
            : mozeEdytowac && wybranyGracz
              ? 'Stuknij pozycję na boisku'
              : `Bez pozycji · ${bezPozycji.length}`}
        </p>
        {bezPozycji.length === 0 ? (
          <p className="text-xs text-slate-400">Wszyscy ustawieni.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {bezPozycji.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  if (wybranySlot !== null) return przypisz(g.id);
                  return setWybranyGracz(wybranyGracz === g.id ? null : g.id);
                }}
                disabled={!mozeEdytowac}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:cursor-default ${
                  wybranyGracz === g.id
                    ? 'border-accent-500 bg-accent-400 text-primary-950'
                    : wybranySlot === null
                      ? 'border-slate-200 bg-white text-slate-500'
                      : 'border-primary-600 bg-primary-50 text-primary-700'
                }`}
              >
                {g.name}
                {g.isGoalkeeper && ' 🧤'}
              </button>
            ))}
          </div>
        )}
        {mozeEdytowac && wybranySlot === null && !wybranyGracz && bezPozycji.length > 0 && (
          <p className="mt-1 text-[11px] text-slate-400">
            Stuknij pozycję i gracza — w dowolnej kolejności.
          </p>
        )}
      </div>

      {/* ── Taktyka ────────────────────────────────────────────────── */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Jak gramy</p>

        {mozeEdytowac ? (
          OPCJE_TAKTYKI.map(({ klucz, pytanie, opcje }) => (
            <div key={klucz}>
              <p className="text-[11px] font-medium text-slate-500">{pytanie}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {[...opcje, { wartosc: WARTOSC_INNE, label: 'Inne', opis: 'Wpisz własnymi słowami' }].map((o) => (
                  <button
                    key={o.wartosc}
                    type="button"
                    onClick={() => zmienTaktyke(klucz, o.wartosc)}
                    title={o.opis}
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                      taktyka[klucz] === o.wartosc
                        ? 'border-primary-700 bg-primary-50 text-primary-700'
                        : 'border-slate-200 bg-white text-slate-500'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {/* Pole otwiera się DOPIERO po wybraniu „Inne" — zawsze widoczne
                  dokładałoby cztery puste ramki do ekranu, na którym zwykle
                  klika się same gotowe odpowiedzi. */}
              {taktyka[klucz] === WARTOSC_INNE && (
                <input
                  value={taktyka.wlasne?.[klucz] ?? ''}
                  onChange={(e) => setTaktyka((t) => ({
                    ...t, wlasne: { ...t.wlasne, [klucz]: e.target.value },
                  }))}
                  onBlur={() => zapiszTaktyke(taktyka)}
                  maxLength={120}
                  placeholder={`${pytanie} — jak u Was?`}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700"
                />
              )}
            </div>
          ))
        ) : (
          /* Widok dla drużyny: same odpowiedzi, bez pytań bez odpowiedzi.
             Nieustalona decyzja nie renderuje się wcale — pusty wiersz „Tempo
             gry: —" mówi tylko tyle, że ktoś czegoś nie kliknął. */
          <div className="space-y-2">
            {OPCJE_TAKTYKI.map(({ klucz, pytanie }) => {
              const odp = odpowiedzTaktyki(taktyka, klucz);
              if (!odp) return null;
              return (
                <div key={klucz} className="flex items-baseline gap-2">
                  <span className="shrink-0 text-[11px] text-slate-400">{pytanie}</span>
                  <span className="text-sm font-semibold text-ink">{odp}</span>
                </div>
              );
            })}
            {!opisTaktyki(taktyka) && (
              <p className="text-sm text-slate-400">
                {kapitan ? `${kapitan} jeszcze nic nie ustalił.` : 'Kapitan jeszcze nic nie ustalił.'}
              </p>
            )}
          </div>
        )}

        <div>
          <p className="text-[11px] font-medium text-slate-500">Stałe fragmenty i uwagi</p>
          {mozeEdytowac ? (
            <textarea
              value={notatka}
              onChange={(e) => setNotatka(e.target.value)}
              onBlur={() => zapiszUstawienie(eventId, team, { notatka }, user.id).catch(() => {})}
              rows={2}
              maxLength={500}
              placeholder="Rożne bije Kuba, karne Michał…"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700"
            />
          ) : notatka.trim() ? (
            <p className="mt-1 whitespace-pre-line text-sm text-ink">{notatka}</p>
          ) : (
            <p className="mt-1 text-sm text-slate-400">Nic dopisanego.</p>
          )}
        </div>
      </div>

      </>)}

      {/* ── Czat drużyny ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 dark:border-slate-700">
          <Users className="h-4 w-4 text-slate-400" />
          <p className="text-sm font-semibold text-ink">Rozmowa: {nazwa}</p>
          {/* Bez tego zdania ktoś napisze tu coś, co miało trafić do wszystkich. */}
          <span className="ml-auto text-[10px] text-slate-400">tylko ta drużyna</span>
        </div>

        <div className="max-h-72 space-y-2 overflow-y-auto px-3 py-3">
          {wiadomosci.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">
              Ustalcie tu, kto z kim gra i kto bije rożne. Druga drużyna tego nie widzi.
            </p>
          ) : wiadomosci.map((w) => {
            const wlasna = w.userId === user.id;
            return (
              <div key={w.id} className={`flex items-end gap-1.5 ${wlasna ? 'justify-end' : 'justify-start'}`}>
                {wlasna && (
                  <button type="button" onClick={() => usun(w.id)} aria-label="Usuń wiadomość" className="text-slate-300 hover:text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                  wlasna ? 'rounded-br-sm bg-primary-700 text-white' : 'rounded-bl-sm bg-slate-100 text-ink dark:bg-slate-700'
                }`}>
                  {!wlasna && <p className="text-[10px] font-bold text-slate-500 dark:text-slate-300">{w.userName}</p>}
                  <p className="whitespace-pre-wrap break-words text-sm">{w.body}</p>
                </div>
              </div>
            );
          })}
          <div ref={konGiecListy} />
        </div>

        <div className="flex items-end gap-2 border-t border-slate-100 px-3 py-2.5 dark:border-slate-700">
          <textarea
            value={tresc}
            onChange={(e) => setTresc(e.target.value)}
            rows={1}
            maxLength={1000}
            placeholder="Napisz do drużyny…"
            className="flex-1 resize-none rounded-2xl bg-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-slate-700"
          />
          <button
            type="button"
            onClick={wyslij}
            disabled={!tresc.trim() || wysylanie}
            aria-label="Wyślij"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-700 text-white disabled:opacity-40"
          >
            {wysylanie ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
