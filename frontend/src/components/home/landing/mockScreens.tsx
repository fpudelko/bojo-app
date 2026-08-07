import { Bell, Check, ChevronRight, Clock, MapPin, MessageCircle, Plus, Share2, Users } from 'lucide-react';

/**
 * Makiety trzech ekranów aplikacji do karuzeli na landingu.
 *
 * Dlaczego rysowane w JSX, a nie zrzuty ekranu: zrzut miękczeje powyżej 2x DPI,
 * waży kilkadziesiąt kB i rozjeżdża się z aplikacją przy pierwszej zmianie
 * wyglądu — pliki w public/mockups/ mają dziś stare logo i widoczne szkielety
 * ładowania zamiast treści. Makieta w JSX używa tych samych tokenów kolorów
 * (bg-canvas, text-ink, primary-700, accent-500), więc idzie za motywem sama.
 *
 * Zasada treści: każdy element musi mieć odpowiednik w działającym kodzie.
 * Landing nie obiecuje tu niczego, czego aplikacja nie robi — patrz nagłówek
 * content.ts i test landingContent.test.ts.
 *
 * Wszystkie trzy wypełniają całą wysokość ramki (`h-full`), którą PhoneShell
 * ustala przez `aspect-[9/19]`.
 */

/* ── wspólne drobiazgi ──────────────────────────────────────────────────── */

/** Wąski pasek aplikacji dla zalogowanego: dzwonek + awatar, bez logo
 *  i bez hamburgera — dokładnie tak wygląda dziś Header na telefonie. */
function MockAppBar() {
  return (
    <div className="flex h-9 shrink-0 items-center justify-end gap-2 border-b border-slate-200/70 bg-white/90 px-3">
      <Bell className="h-3.5 w-3.5 text-slate-400" />
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-[10px] font-bold text-primary-700">
        J
      </span>
    </div>
  );
}

/** Dolna nawigacja z zielonym FAB-em pośrodku. */
function MockBottomNav({ active }: { active: 'znajdz' | 'moje' }) {
  const item = (label: string, on: boolean) => (
    <span className={`text-[8px] font-semibold ${on ? 'text-primary-700' : 'text-slate-400'}`}>
      {label}
    </span>
  );
  return (
    <div className="relative flex h-11 shrink-0 items-end justify-around border-t border-slate-200/70 bg-white px-2 pb-1.5">
      {item('Znajdź grę', active === 'znajdz')}
      {item('Mapa', false)}
      <span className="flex h-8 w-8 -translate-y-2 items-center justify-center rounded-full bg-primary-700 shadow-md ring-2 ring-white">
        <Plus className="h-4 w-4 text-white" />
      </span>
      {item('Moje', active === 'moje')}
      {item('Grupy', false)}
    </div>
  );
}

/** Wiersz z przełącznikiem — ToggleRow z kreatora meczu. */
function MockToggle({ label, desc, on }: { label: string; desc: string; on: boolean }) {
  return (
    <div className="mt-2.5 flex items-start justify-between gap-2 border-t border-slate-100 pt-2.5">
      <div>
        <p className="text-[10px] font-medium text-slate-900">{label}</p>
        <p className="text-[9px] text-slate-500">{desc}</p>
      </div>
      <span
        className={`relative inline-flex h-4 w-7 shrink-0 rounded-full ${on ? 'bg-primary-600' : 'bg-slate-200'}`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow ${on ? 'translate-x-3' : ''}`}
          style={{ marginTop: '1px', marginLeft: '1px' }}
        />
      </span>
    </div>
  );
}

/** Pasek zapełnienia składu — ten sam język wizualny co EventBrowseCard. */
function MockCapacity({ taken, max, free }: { taken: number; max: number; free: string }) {
  const pct = Math.round((taken / max) * 100);
  return (
    <>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-primary-700" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-slate-600">{taken}/{max} graczy</span>
        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
          {free}
        </span>
      </div>
    </>
  );
}

/* ── EKRAN 1: /moje-gry, zakładka Nadchodzące ───────────────────────────── */

export function MockMyGames() {
  return (
    <div className="flex h-full flex-col">
      <MockAppBar />

      <div className="flex-1 overflow-hidden px-3 pt-2.5">
        {/* zakładki */}
        <div className="flex items-center gap-2.5 border-b border-slate-200/70 pb-1.5">
          <span className="whitespace-nowrap border-b-2 border-primary-700 pb-1 text-[10px] font-semibold text-primary-700">
            Nadchodzące
          </span>
          <span className="whitespace-nowrap text-[10px] text-slate-400">Historia</span>
          <span className="flex items-center gap-1 whitespace-nowrap text-[10px] text-slate-400">
            Zaproszenia
            <span className="flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-primary-700 px-1 text-[8px] font-bold text-white">
              1
            </span>
          </span>
        </div>

        {/* Najbliższy mecz — karta hero */}
        <p className="mt-3 text-[9px] font-semibold uppercase tracking-wider text-primary-700">
          Najbliższy mecz
        </p>
        <div className="mt-1.5 rounded-xl bg-white p-2.5 shadow-sm" style={{ borderLeft: '3px solid #15663E' }}>
          <p className="text-[12px] font-bold text-ink">Czwartkowa ligówka</p>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-amber-600">
            <Clock className="h-2.5 w-2.5" /> jutro · 18:00 · za 19 h
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500">
            <MapPin className="h-2.5 w-2.5" /> Boisko Grunwaldzka
          </p>
          <MockCapacity taken={8} max={14} free="6 wolnych miejsc" />
          <div className="mt-2 flex gap-1.5">
            <span className="flex flex-1 items-center justify-center rounded-lg bg-primary-700 py-1.5 text-[10px] font-semibold text-white">
              Szczegóły
            </span>
            <span className="flex items-center justify-center gap-1 rounded-lg border border-slate-300 px-2 py-1.5 text-[10px] font-semibold text-slate-600">
              <Share2 className="h-2.5 w-2.5" /> Udostępnij
            </span>
          </div>
        </div>

        {/* Twoje najbliższe mecze */}
        <div className="mt-3 flex items-center justify-between gap-2">
          {/* Bez plakietki z licznikiem: przy szerokości makiety (248 px)
              obcinała się w połowie i wyglądała jak błąd renderowania. */}
          <p className="min-w-0 truncate text-[10px] font-bold text-ink">Twoje najbliższe mecze</p>
          <span className="shrink-0 whitespace-nowrap text-[9px] font-semibold text-primary-700">
            Wszystkie →
          </span>
        </div>
        <div className="mt-1.5 rounded-xl bg-white p-2.5 shadow-sm" style={{ borderLeft: '3px solid #1d4ed8' }}>
          <div className="flex items-start gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-sm">🏐</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-1">
                <p className="truncate text-[11px] font-bold text-ink">Siatkówka 6v6</p>
                <span className="shrink-0 rounded-full bg-green-50 px-1.5 text-[9px] font-bold text-green-700">
                  Za darmo
                </span>
              </div>
              <p className="mt-0.5 flex items-center gap-1 text-[9px] text-slate-500">
                <Clock className="h-2.5 w-2.5" /> sob 9 sie · 10:00
              </p>
            </div>
          </div>
          <MockCapacity taken={10} max={12} free="2 wolne miejsca" />
        </div>

        {/* Obserwowane trzymamy osobno, żeby nigdy nie czytało się jak "jestem w składzie" */}
        <p className="mt-3 text-[10px] font-bold text-ink">
          Obserwujesz
          <span className="ml-1 rounded-full border border-primary-100 bg-primary-50 px-1.5 text-[9px] font-bold text-primary-700">
            1
          </span>
        </p>
        <div className="mt-1.5 rounded-xl bg-white p-2.5 shadow-sm" style={{ borderLeft: '3px solid #c2410c' }}>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-xs">🏀</span>
            <p className="min-w-0 flex-1 truncate text-[11px] font-bold text-ink">Kosz na Chrobrego</p>
            <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-1.5 text-[9px] font-bold text-amber-700">
              Obserwujesz
            </span>
          </div>
        </div>
      </div>

      <MockBottomNav active="moje" />
    </div>
  );
}

/* ── EKRAN 2: /wydarzenia/nowe, krok 2 ──────────────────────────────────── */

export function MockWizard() {
  const stepDot = (content: React.ReactNode, done: boolean, current?: boolean) => (
    <span
      className={[
        'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold',
        done || current ? 'bg-primary-700 text-white' : 'bg-slate-100 text-slate-400',
        current ? 'ring-2 ring-primary-100' : '',
      ].join(' ')}
    >
      {content}
    </span>
  );

  return (
    <div className="flex h-full flex-col">
      {/* wskaźnik kroków */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-slate-200/70 bg-canvas px-3 py-2">
        {stepDot(<Check className="h-3 w-3" strokeWidth={3} />, true)}
        {stepDot(<Check className="h-3 w-3" strokeWidth={3} />, true)}
        {stepDot('3', false, true)}
        <span className="ml-1 text-[10px] font-medium text-slate-500">Kiedy i ile</span>
      </div>

      <div className="flex-1 overflow-hidden px-3 pt-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <p className="mb-1 text-[10px] font-medium text-slate-700">Data</p>
            <div className="rounded-lg border border-slate-300 px-2 py-1.5 text-[11px] text-ink">7 sie</div>
          </div>
          <div className="flex-1">
            <p className="mb-1 text-[10px] font-medium text-slate-700">Godzina</p>
            <div className="rounded-lg border border-slate-300 px-2 py-1.5 text-[11px] text-ink">18:00</div>
          </div>
        </div>

        <p className="mb-1 mt-3 text-[10px] font-medium text-slate-700">Czas gry</p>
        <div className="flex gap-1.5">
          {['60', '75', '90', '105'].map((m) => (
            <span
              key={m}
              className={[
                'whitespace-nowrap rounded-lg border px-1.5 py-1 text-[10px] font-medium',
                m === '90' ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600',
              ].join(' ')}
            >
              {m} min
            </span>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <p className="text-[10px] font-medium text-slate-700">Liczba graczy</p>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-300 text-[12px] text-slate-500">−</span>
            <span className="w-5 text-center text-[12px] font-bold text-ink">14</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-300 text-[12px] text-slate-500">+</span>
          </div>
        </div>

        {/* Koszt obiektu — dziś to tryb domyślny kreatora */}
        <p className="mb-1 mt-3 text-[10px] font-medium text-slate-700">Koszt wynajmu obiektu (zł)</p>
        <div className="rounded-lg border border-slate-300 px-2 py-1.5 text-[11px] text-ink">210</div>
        <p className="mt-1 text-[9px] leading-snug text-slate-500">
          Przy 14 miejscach wychodzi <span className="font-semibold">15,00 zł od osoby</span>.
        </p>

        <MockToggle label="Bramkarze" desc="Osobny limit miejsc" on />
        <MockToggle label="Biorę udział" desc="Zapisz mnie do składu" on />
      </div>

      {/* przyklejony pasek akcji */}
      <div className="flex shrink-0 items-center gap-2 border-t border-slate-200 bg-canvas px-3 py-2.5">
        <span className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600">
          ← Wróć
        </span>
        <span className="flex flex-1 items-center justify-center rounded-lg bg-primary-700 py-1.5 text-[11px] font-semibold text-white">
          Dalej →
        </span>
      </div>
    </div>
  );
}

/* ── EKRAN 3: /wydarzenia/[id] ──────────────────────────────────────────── */

export function MockMatchPage() {
  const initials = ['M', 'K', 'A', 'P', 'T'];
  return (
    <div className="flex h-full flex-col">
      <MockAppBar />

      <div className="flex-1 overflow-hidden px-3 pt-3">
        <p className="text-[14px] font-bold leading-tight text-ink">Czwartkowa ligówka</p>
        <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-amber-600">
          <Clock className="h-2.5 w-2.5" /> jutro · 18:00 · za 19 h
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500">
          <MapPin className="h-2.5 w-2.5" /> Boisko Grunwaldzka
        </p>

        <div className="mt-3 rounded-xl bg-white p-2.5 shadow-sm">
          <div className="flex items-center gap-1 text-[10px] font-semibold text-ink">
            <Users className="h-3 w-3 text-slate-400" /> Skład
          </div>
          <MockCapacity taken={8} max={14} free="6 wolnych miejsc" />

          <div className="mt-2.5 space-y-1.5">
            {[
              { n: 'Jan K.', tag: 'Organizator' },
              { n: 'Marek W.', tag: '🧤 Bramkarz' },
              { n: 'Ania P.', tag: '' },
            ].map(({ n, tag }) => (
              <div key={n} className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-[8px] font-bold text-primary-700">
                  {n.charAt(0)}
                </span>
                <span className="text-[10px] font-medium text-ink">{n}</span>
                {tag && <span className="text-[8px] font-semibold text-slate-400">{tag}</span>}
              </div>
            ))}
          </div>

          <div className="mt-2 flex items-center border-t border-slate-100 pt-2">
            <div className="flex -space-x-1.5">
              {initials.map((i) => (
                <span
                  key={i}
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[8px] font-bold text-slate-500 ring-2 ring-white"
                >
                  {i}
                </span>
              ))}
            </div>
            <span className="ml-1.5 text-[9px] font-medium text-slate-500">i 5 innych</span>
            <ChevronRight className="ml-auto h-3 w-3 text-slate-300" />
          </div>
        </div>

        <div className="mt-2.5 rounded-xl bg-white p-2.5 shadow-sm">
          <p className="text-[10px] font-semibold text-ink">Koszt 15,00 zł</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[9px] font-medium text-slate-600">BLIK</span>
            <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[9px] font-medium text-slate-600">Gotówka</span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-medium text-amber-700">
              Multisport −10 zł
            </span>
          </div>
        </div>

        <div className="mt-2.5 flex items-center gap-1.5 rounded-xl bg-white p-2.5 shadow-sm">
          <MessageCircle className="h-3 w-3 shrink-0 text-slate-400" />
          <span className="text-[10px] font-medium text-ink">Komentarze</span>
          <span className="text-[9px] text-slate-400">3</span>
          <ChevronRight className="ml-auto h-3 w-3 text-slate-300" />
        </div>
      </div>

      {/* przyklejony pasek dołączania */}
      <div className="shrink-0 border-t border-slate-200/70 bg-canvas px-3 py-2.5">
        <span className="flex w-full items-center justify-center rounded-xl bg-primary-700 py-2 text-[11px] font-bold text-white">
          Dołącz →
        </span>
      </div>
    </div>
  );
}
