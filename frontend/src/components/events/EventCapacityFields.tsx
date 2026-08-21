'use client';

import { GK_SPORTS } from '@/lib/sports';
import { SHOW_MIN_PLAYERS_THRESHOLD } from '@/lib/features';

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
 */
export default function EventCapacityFields({
  sport,
  maxPlayers, onMaxPlayersChange,
  minPlayers = null, onMinPlayersChange,
  goalkeepersEnabled, setGoalkeepersEnabled,
  reserveClaimHours, setReserveClaimHours,
  slotyZarezerwowane = true, setSlotyZarezerwowane,
  blad,
}: {
  sport: string;
  maxPlayers: number;
  onMaxPlayersChange: (v: number) => void;
  /** Próg "gra się odbędzie" (097). `null` = organizator go nie ustawił. */
  minPlayers?: number | null;
  onMinPlayersChange?: (v: number | null) => void;
  /** `null` = organizator jeszcze nie zdecydował (tylko kreator). */
  goalkeepersEnabled: boolean | null;
  setGoalkeepersEnabled: (v: boolean) => void;
  reserveClaimHours: number;
  setReserveClaimHours: (v: number) => void;
  /** Czy miejsca dla bramkarzy są zarezerwowane (migracja `077`). */
  slotyZarezerwowane?: boolean;
  setSlotyZarezerwowane?: (v: boolean) => void;
  blad?: string;
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
            <p className="mt-1.5 text-xs text-slate-500">Kolejni chętni trafią na listę rezerwową.</p>
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

      {/* Czas na decyzję z rezerwy — widoczny wprost, nie pod „Więcej opcji".
          To ustawienie reguły, wedle której Bojo rozdaje zwolnione miejsca,
          więc organizator ma je widzieć, gdy ustala skład. Opis stoi OBOK
          dropdowna (ten sam wzorzec co `ToggleRow`: opis po lewej, kontrolka
          po prawej), nie nad nim. */}
      <div>
        <label htmlFor="czas-rezerwy" className="block text-sm font-medium text-slate-700 mb-2">
          Czas na decyzję z rezerwy
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <p className="min-w-0 text-xs text-slate-500 sm:flex-1">
            Gdy ktoś się wypisze, miejsce dostaje pierwsza osoba z rezerwy. Tyle ma na
            kliknięcie „Wchodzę", zanim przejdzie do kolejnej.
          </p>
          <select
            id="czas-rezerwy"
            value={reserveClaimHours}
            onChange={(e) => setReserveClaimHours(Number(e.target.value))}
            className="w-full shrink-0 rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 sm:w-32"
          >
            <option value={1}>1 godzina</option>
            <option value={3}>3 godziny</option>
            <option value={6}>6 godzin</option>
            <option value={12}>12 godzin</option>
            <option value={24}>24 godziny</option>
          </select>
        </div>
      </div>

      {/* Bramkarze — trzy stany, nie przełącznik.
          Przełącznik odpowiadał wyłącznie na pytanie „rozróżniać?", a to za mało:
          organizator, który rozróżnia, musi jeszcze zdecydować, CZY miejsca dla
          bramkarzy mają czekać. Przy 14 miejscach i 2 bramkarzach domyślne
          „czekają" oznaczało, że trzynasty zawodnik z pola ląduje na rezerwie,
          choć dwa miejsca stoją puste — i nikt go o tym nie uprzedził. */}
      {GK_SPORTS.includes(sport) && (
        <div className="border-b border-slate-100 py-2">
          <p className="text-sm font-medium text-slate-900">
            Bramkarze
            {goalkeepersEnabled === null && <span className="ml-1 text-red-600">*</span>}
          </p>
          <p className="mb-2 text-xs text-slate-500">
            Zdecyduj, jak Bojo ma dzielić {maxPlayers} miejsc.
          </p>

          <div className="space-y-2">
            {TRYBY.map((tryb) => {
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
