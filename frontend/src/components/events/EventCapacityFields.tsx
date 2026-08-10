'use client';

import { GK_SPORTS } from '@/lib/sports';

/**
 * Liczba miejsc (stepper +/−) + „Rozróżniaj bramkarzy” + „Czas na decyzję z
 * rezerwy”. Wspólne dla kreatora (`wydarzenia/nowe`) i edycji wydarzenia —
 * edycja miała dotąd osobny slider zamiast steppera.
 */
export default function EventCapacityFields({
  sport,
  maxPlayers, onMaxPlayersChange,
  goalkeepersEnabled, setGoalkeepersEnabled,
  reserveClaimHours, setReserveClaimHours,
}: {
  sport: string;
  maxPlayers: number;
  onMaxPlayersChange: (v: number) => void;
  goalkeepersEnabled: boolean;
  setGoalkeepersEnabled: (v: boolean) => void;
  reserveClaimHours: number;
  setReserveClaimHours: (v: number) => void;
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

      {/* Goalkeeper distinction — sports with a goalkeeper only */}
      {GK_SPORTS.includes(sport) && (
        <div className="flex items-center justify-between py-2 border-b border-slate-100">
          <div className="pr-3">
            <p className="text-sm font-medium text-slate-900">Rozróżniaj bramkarzy</p>
            <p className="text-xs text-slate-500">
              Gracze wybierają: bramkarz lub zawodnik z pola. Max 2 bramkarzy
              i {Math.max(0, maxPlayers - 2)} zawodników z pola — kolejni trafią na rezerwę.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setGoalkeepersEnabled(!goalkeepersEnabled)}
            className={['relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors', goalkeepersEnabled ? 'bg-primary-600' : 'bg-slate-200'].join(' ')}
            role="switch"
            aria-checked={goalkeepersEnabled}
          >
            <span className={['pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform', goalkeepersEnabled ? 'translate-x-5' : 'translate-x-0'].join(' ')} />
          </button>
        </div>
      )}
    </>
  );
}
