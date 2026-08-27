'use client';

import { useState } from 'react';
import ToggleRow from '@/components/ui/ToggleRow';
import { GK_SPORTS } from '@/lib/sports';
import { SHOW_MIN_PLAYERS_THRESHOLD } from '@/lib/features';
import { czasRezerwyTekst } from '@/lib/events';

/** Presety w minutach — gęściej w przedziale 30 min–3 godz. (typowy czas
 *  reakcji na telefon, zgłoszone wprost jako zbyt ograniczony wybór), rzadziej
 *  wyżej. Wszystkie pięć dawnych wartości godzinowych (1/3/6/12/24 h) ma tu
 *  dokładny odpowiednik w minutach — migracja `118` nie zamienia w „Inny czas"
 *  żadnego istniejącego meczu. */
const PRESETY_REZERWY = [30, 60, 90, 120, 150, 180, 360, 720, 1440] as const;

/** Ilu bramkarzy naraz. Stała, nie ustawienie — dwie drużyny, dwie bramki. */
const LIMIT_BRAMKARZY = 2;

/** Trzy sposoby na podział miejsc. Opis liczy się z realnej liczby miejsc,
 *  bo „12 w polu + 2 dla bramkarzy" mówi więcej niż zdanie o regule. */
const TRYBY = [
  {
    id: 'bez-rozroznienia',
    gk: false,
    zarezerwowane: false,
    tytul: 'Bez podziału na role',
    opis: (miejsca: number) =>
      `Wszystkie ${miejsca} miejsc jest wspólnych. Nikt nie deklaruje, czy stoi na bramce.`,
  },
  {
    id: 'wspolna-pula',
    gk: true,
    zarezerwowane: false,
    tytul: 'Rozróżniaj, ale nie rezerwuj miejsc',
    opis: (miejsca: number, bramkarze: number) =>
      `Gracze wybierają rolę, ale o ${miejsca} miejsc konkurują wszyscy — kto pierwszy, `
      + `ten w składzie. Bramkarzy nie wejdzie więcej niż ${bramkarze}. `
      + `Może się zdarzyć komplet bez bramkarza.`,
  },
  {
    id: 'rezerwacja',
    gk: true,
    zarezerwowane: true,
    tytul: 'Rezerwuj miejsca dla bramkarzy',
    opis: (miejsca: number, bramkarze: number) =>
      `${miejsca} miejsc = ${Math.max(0, miejsca - bramkarze)} w polu + ${bramkarze} dla bramkarzy. `
      + `Miejsca bramkarzy czekają na nich do końca — kolejny zawodnik z pola trafi na rezerwę, `
      + `nawet jeśli bramkarz się nie zapisze.`,
  },
] as const;

/**
 * Liczba miejsc (stepper +/−) + „Rozróżniaj bramkarzy” + „Czas na decyzję z
 * rezerwy”. Wspólne dla kreatora (`wydarzenia/nowe`) i edycji wydarzenia —
 * edycja miała dotąd osobny slider zamiast steppera.

/**
 * MIEJSCA W SKŁADZIE — stepper i (za flagą) próg „gra się odbędzie".
 *
 * Wydzielone z `EventCapacityFields`, bo kreator pyta o liczbę miejsc na
 * pierwszym kroku, razem z terminem, a resztę ustawień chowa za przełącznikami
 * („Rezerwa", „Płatne", „Bramkarze"). Strona edycji nadal składa wszystko
 * razem — patrz `EventCapacityFields` niżej.
 */
export function MiejscaWSkladzie({
  maxPlayers, onMaxPlayersChange, minPlayers = null, onMinPlayersChange,
  reserveEnabled = false,
}: {
  maxPlayers: number;
  onMaxPlayersChange: (v: number) => void;
  minPlayers?: number | null;
  onMinPlayersChange?: (v: number | null) => void;
  /** Zmienia wyłącznie ZDANIE pod stepperem — nie samą kontrolkę. */
  reserveEnabled?: boolean;
}) {
  return (
    <>
      {/* Stepper po lewej, dopisek „masz już graczy" obok — ale OBOK dopiero
          od `sm:`. Na 360-pikselowym telefonie ten sam układ zostawiał tekstowi
          połowę szerokości: zdanie łamało się na sześć poszarpanych linijek
          wyższych niż sam stepper. Poniżej `sm` idzie pod spód, gdzie ma całą
          szerokość. */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Liczba miejsc
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="shrink-0">
            <div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <button
                type="button"
                onClick={() => onMaxPlayersChange(Math.max(2, maxPlayers - 1))}
                className="w-10 h-10 flex items-center justify-center rounded-lg text-lg font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40"
                disabled={maxPlayers <= 2}
                aria-label="Zmniejsz liczbę miejsc"
              >
                −
              </button>
              <span className="w-8 text-center text-lg font-semibold text-slate-900 tabular-nums">
                {maxPlayers}
              </span>
              <button
                type="button"
                onClick={() => onMaxPlayersChange(Math.min(30, maxPlayers + 1))}
                className="w-10 h-10 flex items-center justify-center rounded-lg text-lg font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40"
                disabled={maxPlayers >= 30}
                aria-label="Zwiększ liczbę miejsc"
              >
                +
              </button>
            </div>
            {/* Zdanie opisuje ZACHOWANIE, więc nie może stać, gdy zachowanie
                jest inne. Przy wyłączonej rezerwie mówi, co się naprawdę
                stanie — cisza w tym miejscu kazałaby zgadywać. */}
            <p className="mt-1.5 text-xs text-slate-500">
              {reserveEnabled
                ? 'Kolejni chętni trafią na listę rezerwową.'
                : 'Przy komplecie zapisy będą zamknięte.'}
            </p>
          </div>
          <p className="min-w-0 text-xs text-slate-500 sm:flex-1 sm:text-right">
            Masz już graczy? Dopiszesz ich zaraz po utworzeniu — na stronie meczu, też bez konta.
          </p>
        </div>

        {/* Próg minimum — dyskretny, jednolinijkowy toggle, nie osobna sekcja.
            Odpowiada wprost na "10 to minimum żeby zagrać. Dobrze liczę?" —
            zamiast liczyć w głowie, organizator dostaje werdykt na stronie meczu. */}
        {SHOW_MIN_PLAYERS_THRESHOLD && onMinPlayersChange && (
          <div className="mt-3">
            {minPlayers == null ? (
              <button
                type="button"
                onClick={() => onMinPlayersChange(Math.min(maxPlayers, Math.max(2, maxPlayers - 2)))}
                className="text-xs font-medium text-primary-700 hover:text-primary-800"
              >
                + Ustaw minimum, żeby gra się odbyła
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <label htmlFor="min-players" className="text-xs text-slate-500">Minimum graczy</label>
                <input
                  id="min-players"
                  type="number"
                  min={1}
                  max={maxPlayers}
                  value={minPlayers}
                  onChange={(e) => onMinPlayersChange(Math.min(maxPlayers, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button type="button" onClick={() => onMinPlayersChange(null)} className="text-xs text-slate-400 hover:text-red-500">
                  Usuń
                </button>
              </div>
            )}
            <p className="mt-1 text-xs text-slate-400">
              Poniżej progu Bojo pokaże „Gra zagrożona" i pozwoli zapytać ekipę, kto jeszcze wchodzi.
            </p>
          </div>
        )}
      </div>

    </>
  );
}

/** CZAS NA DECYZJĘ Z REZERWY. O tym, czy w ogóle się pokazuje, decyduje
 *  wywołujący (przełącznik „Rezerwa"), nie ten komponent. */
export function UstawieniaRezerwy({
  reserveClaimMinutes, setReserveClaimMinutes,
}: {
  reserveClaimMinutes: number;
  setReserveClaimMinutes: (v: number) => void;
}) {
  // Tryb „Inny czas" jest stanem WIDOKU, nie danych — decyduje, czy pokazać
  // pole liczbowe zamiast selecta, niezależnie od tego, czy aktualna wartość
  // akurat pasuje do presetu.
  const [trybInny, setTrybInny] = useState<boolean>(
    () => !(PRESETY_REZERWY as readonly number[]).includes(reserveClaimMinutes),
  );
  return (
    <>
      {/* Czas na decyzję z rezerwy — widoczny wprost, nie pod „Więcej opcji".
          To ustawienie reguły, wedle której Bojo rozdaje zwolnione miejsca,
          więc organizator ma je widzieć, gdy ustala skład. Opis stoi OBOK
          dropdowna (ten sam wzorzec co `ToggleRow`: opis po lewej, kontrolka
          po prawej), nie nad nim.

          Chowa się razem z rezerwą: przy wyłączonej nie ma czego rozdawać,
          więc pytanie „ile czasu na przyjęcie miejsca" jest wtedy pytaniem
          bez treści. */}
      <div>
        <label htmlFor="czas-rezerwy" className="block text-sm font-medium text-slate-700 mb-2">
          Czas na decyzję z rezerwy
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <p className="min-w-0 text-xs text-slate-500 sm:flex-1">
            Gdy ktoś się wypisze, miejsce dostaje pierwsza osoba z rezerwy. Tyle ma na
            kliknięcie „Wchodzę", zanim przejdzie do kolejnej.
          </p>
          <div className="w-full shrink-0 sm:w-40">
            <select
              id="czas-rezerwy"
              value={trybInny ? 'inny' : reserveClaimMinutes}
              onChange={(e) => {
                if (e.target.value === 'inny') { setTrybInny(true); return; }
                setTrybInny(false);
                setReserveClaimMinutes(Number(e.target.value));
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value={30}>30 minut</option>
              <option value={60}>1 godzina</option>
              <option value={90}>1 godz. 30 min.</option>
              <option value={120}>2 godziny</option>
              <option value={150}>2 godz. 30 min.</option>
              <option value={180}>3 godziny</option>
              <option value={360}>6 godzin</option>
              <option value={720}>12 godzin</option>
              <option value={1440}>24 godziny</option>
              <option value="inny">Inny czas…</option>
            </select>
            {trybInny && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={15}
                  max={4320}
                  step={5}
                  value={reserveClaimMinutes}
                  onChange={(e) => setReserveClaimMinutes(Math.min(4320, Math.max(15, Number(e.target.value) || 15)))}
                  className="w-20 rounded-xl border border-slate-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  aria-label="Czas na decyzję z rezerwy, w minutach"
                />
                <span className="text-xs text-slate-500">min. ({czasRezerwyTekst(reserveClaimMinutes)})</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/** TRYBY MIEJSC DLA BRAMKARZY. Sam warunek „czy sport ma bramkarza" zostaje
 *  w środku — wywołujący nie musi znać `GK_SPORTS`. */
export function UstawieniaBramkarzy({
  sport, maxPlayers, goalkeepersEnabled, setGoalkeepersEnabled,
  slotyZarezerwowane = true, setSlotyZarezerwowane, blad,
  wPrzelaczniku = false,
}: {
  sport: string;
  maxPlayers: number;
  goalkeepersEnabled: boolean | null;
  setGoalkeepersEnabled: (v: boolean) => void;
  slotyZarezerwowane?: boolean;
  setSlotyZarezerwowane?: (v: boolean) => void;
  blad?: string;
  /** Czy ta sekcja siedzi w środku przełącznika „Bramkarze osobno" (kreator).
   *  Wtedy „Bez podziału na role" NIE jest opcją: to jest stan wyłączonego
   *  przełącznika, a nie wybór do zrobienia w środku włączonego. Wystawienie
   *  go tutaj dawało dwie kontrolki na jedno pytanie, które umiały się ze sobą
   *  nie zgadzać — włączony przełącznik z wybranym „bez podziału". Strona
   *  edycji nie ma przełącznika (wszystkie ustawienia są tam równorzędne),
   *  więc widzi wszystkie trzy tryby. */
  wPrzelaczniku?: boolean;
}) {
  // W przełączniku zostają wyłącznie tryby, które NAPRAWDĘ dzielą skład.
  const tryby = wPrzelaczniku ? TRYBY.filter((t) => t.gk) : TRYBY;
  return (
    <>
      {/* Bramkarze — trzy stany, nie przełącznik.
          Przełącznik odpowiadał wyłącznie na pytanie „rozróżniać?", a to za mało:
          organizator, który rozróżnia, musi jeszcze zdecydować, CZY miejsca dla
          bramkarzy mają czekać. Przy 14 miejscach i 2 bramkarzach domyślne
          „czekają" oznaczało, że trzynasty zawodnik z pola ląduje na rezerwie,
          choć dwa miejsca stoją puste — i nikt go o tym nie uprzedził. */}
      {GK_SPORTS.includes(sport) && (
        <div className={wPrzelaczniku ? '' : 'border-b border-slate-100 py-2'}>
          {/* Nagłówka nie ma w przełączniku — powtarzałby jego tytuł. */}
          {!wPrzelaczniku && (
            <p className="text-sm font-medium text-slate-900">
              Bramkarze
              {goalkeepersEnabled === null && <span className="ml-1 text-red-600">*</span>}
            </p>
          )}
          <p className="mb-2 text-xs text-slate-500">
            Zdecyduj, jak Bojo ma dzielić {maxPlayers} miejsc.
          </p>

          <div className="space-y-2">
            {tryby.map((tryb) => {
              const wybrany = tryb.gk === goalkeepersEnabled
                && (tryb.gk === false || tryb.zarezerwowane === slotyZarezerwowane);
              return (
                <button
                  key={tryb.id}
                  type="button"
                  onClick={() => {
                    setGoalkeepersEnabled(tryb.gk);
                    if (tryb.gk) setSlotyZarezerwowane?.(tryb.zarezerwowane);
                  }}
                  className={[
                    'w-full rounded-xl border p-3 text-left transition-colors',
                    wybrany
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-slate-200 hover:border-slate-300',
                  ].join(' ')}
                >
                  <span className="flex items-center gap-2">
                    <span className={[
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
                      wybrany ? 'border-primary-600' : 'border-slate-300',
                    ].join(' ')}>
                      {wybrany && <span className="h-2 w-2 rounded-full bg-primary-600" />}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">{tryb.tytul}</span>
                  </span>
                  <span className="mt-1 block pl-6 text-xs text-slate-500">
                    {tryb.opis(maxPlayers, LIMIT_BRAMKARZY)}
                  </span>
                </button>
              );
            })}
          </div>

          {blad && (
            <p data-field-error className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600">
              <span aria-hidden>⚠</span> {blad}
            </p>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Komplet ustawień pojemności — stepper, przełącznik rezerwy z czasem na
 * decyzję i tryby miejsc dla bramkarzy. Używa go STRONA EDYCJI, gdzie mecz już
 * istnieje i wszystkie ustawienia są równorzędne. Kreator składa te same części
 * inaczej: liczba miejsc na pierwszym kroku, reszta za przełącznikami.
 */
export default function EventCapacityFields({
  sport,
  maxPlayers, onMaxPlayersChange,
  minPlayers = null, onMinPlayersChange,
  goalkeepersEnabled, setGoalkeepersEnabled,
  reserveClaimMinutes, setReserveClaimMinutes,
  reserveEnabled = true, setReserveEnabled,
  slotyZarezerwowane = true, setSlotyZarezerwowane,
  blad,
}: {
  sport: string;
  maxPlayers: number;
  onMaxPlayersChange: (v: number) => void;
  minPlayers?: number | null;
  onMinPlayersChange?: (v: number | null) => void;
  goalkeepersEnabled: boolean | null;
  setGoalkeepersEnabled: (v: boolean) => void;
  reserveClaimMinutes: number;
  setReserveClaimMinutes: (v: number) => void;
  reserveEnabled?: boolean;
  setReserveEnabled?: (v: boolean) => void;
  slotyZarezerwowane?: boolean;
  setSlotyZarezerwowane?: (v: boolean) => void;
  blad?: string;
}) {
  return (
    <>
      <MiejscaWSkladzie
        maxPlayers={maxPlayers}
        onMaxPlayersChange={onMaxPlayersChange}
        minPlayers={minPlayers}
        onMinPlayersChange={onMinPlayersChange}
        reserveEnabled={reserveEnabled}
      />

      {setReserveEnabled && (
        <ToggleRow
          label="Lista rezerwowa"
          desc="Przy komplecie kolejni chętni czekają w kolejce i wchodzą, gdy ktoś się wypisze."
          checked={reserveEnabled}
          onChange={setReserveEnabled}
        />
      )}

      {reserveEnabled && (
        <UstawieniaRezerwy
          reserveClaimMinutes={reserveClaimMinutes}
          setReserveClaimMinutes={setReserveClaimMinutes}
        />
      )}

      <UstawieniaBramkarzy
        sport={sport}
        maxPlayers={maxPlayers}
        goalkeepersEnabled={goalkeepersEnabled}
        setGoalkeepersEnabled={setGoalkeepersEnabled}
        slotyZarezerwowane={slotyZarezerwowane}
        setSlotyZarezerwowane={setSlotyZarezerwowane}
        blad={blad}
      />
    </>
  );
}
