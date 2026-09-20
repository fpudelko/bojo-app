'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import ToggleRow from '@/components/ui/ToggleRow';
import TimeSelect from '@/components/ui/TimeSelect';
import SegmentedToggle from '@/components/ui/SegmentedToggle';
import UnifiedLocationPicker, { type LocationResult } from '@/components/map/UnifiedLocationPicker';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { useWstecz } from '@/lib/historia';
import { createTurniej } from '@/lib/turnieje';
import { FORMAT_LABEL, FORMAT_OPIS } from '@/lib/turniejEtykiety';
import { FOCUS_SPORTS, sportLabel, sportEmoji } from '@/lib/sports';
import type { TurniejFormat, TurniejWidocznosc } from '@/types';

const FORMATY: TurniejFormat[] = ['grupy_puchar', 'puchar', 'liga'];

const inputCls =
  'w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-700 dark:text-slate-100';
const labelCls = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5';

export default function NowyTurniejPage() {
  const router = useRouter();
  const wstecz = useWstecz('/turnieje');
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const [nazwa, setNazwa] = useState('');
  const [sport, setSport] = useState<string>(FOCUS_SPORTS[0]);
  const [dataStartu, setDataStartu] = useState('');
  const [dataKonca, setDataKonca] = useState('');
  const [zapisyDo, setZapisyDo] = useState('');
  const [godzinaStartu, setGodzinaStartu] = useState('10:00');
  const [location, setLocation] = useState<LocationResult>({ venue: null, lat: null, lng: null, address: '' });
  const [miejsceNazwa, setMiejsceNazwa] = useState('');

  const [format, setFormat] = useState<TurniejFormat>('grupy_puchar');
  const [maxDruzyn, setMaxDruzyn] = useState(8);
  const [minZawodnikow, setMinZawodnikow] = useState(5);
  const [maxZawodnikow, setMaxZawodnikow] = useState(12);

  const [widocznosc, setWidocznosc] = useState<TurniejWidocznosc>('publiczny');
  const [wymagaAkceptacji, setWymagaAkceptacji] = useState(true);
  const [wpisoweZl, setWpisoweZl] = useState('');
  const [regulamin, setRegulamin] = useState('');
  const [opis, setOpis] = useState('');

  const [blad, setBlad] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const nazwaOk = nazwa.trim().length >= 3;
  const dataOk = !!dataStartu && (!dataKonca || dataKonca >= dataStartu);
  const zapisyOk = !zapisyDo || !dataStartu || zapisyDo <= dataStartu;
  const skladOk = minZawodnikow > 0 && minZawodnikow <= maxZawodnikow;
  const gotowe = nazwaOk && dataOk && zapisyOk && skladOk && maxDruzyn >= 2;

  const handleSubmit = async () => {
    if (!user || !gotowe) return;
    setSubmitting(true);
    setBlad(null);
    try {
      const wpisoweGrosze = wpisoweZl.trim() ? Math.round(parseFloat(wpisoweZl.replace(',', '.')) * 100) : 0;
      const id = await createTurniej(
        {
          nazwa,
          sport,
          format,
          widocznosc,
          fieldId: location.venue?.id,
          miejsceNazwa: location.venue?.name ?? miejsceNazwa,
          miejsceAdres: location.address,
          lat: location.lat ?? undefined,
          lng: location.lng ?? undefined,
          dataStartu,
          dataKonca: dataKonca || undefined,
          // Koniec DNIA, nie północ na jego początku: „zapisy do 16
          // października" znaczy dla każdego „jeszcze szesnastego".
          zapisyDo: zapisyDo ? `${zapisyDo}T23:59:59` : undefined,
          godzinaStartu,
          maxDruzyn,
          minZawodnikow,
          maxZawodnikow,
          wymagaAkceptacji,
          wpisoweGrosze: Number.isFinite(wpisoweGrosze) ? wpisoweGrosze : 0,
          regulamin: regulamin || undefined,
          opis: opis || undefined,
        },
        user.id,
      );
      toast('Turniej utworzony 🏆');
      router.push(`/turnieje/${id}/panel`);
    } catch (e) {
      setBlad(e instanceof Error ? e.message : 'Nie udało się utworzyć turnieju');
      setSubmitting(false);
    }
  };

  if (!loading && !user) {
    if (typeof window !== 'undefined') window.location.href = `/logowanie?next=${encodeURIComponent('/turnieje/nowe')}`;
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
        <button onClick={wstecz} className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink transition-colors">
          <ArrowLeft className="w-4 h-4" /> Wróć
        </button>

        <h1 className="font-display text-2xl font-bold text-ink mb-1">Nowy turniej</h1>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
          Wszystko zmienisz później w panelu turnieju.
        </p>

        <div className="space-y-6 rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          {/* Podstawy */}
          <div>
            <label className={labelCls}>Nazwa turnieju *</label>
            <input
              value={nazwa}
              onChange={(e) => setNazwa(e.target.value)}
              placeholder="np. Orlik Cup 2026"
              maxLength={80}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Sport</label>
            <div className="flex flex-wrap gap-2">
              {FOCUS_SPORTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSport(s)}
                  className={[
                    'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                    sport === s ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800',
                  ].join(' ')}
                >
                  <span>{sportEmoji(s)}</span> {sportLabel(s)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Data startu *</label>
              <input type="date" value={dataStartu} onChange={(e) => setDataStartu(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Data końca</label>
              <input type="date" value={dataKonca} onChange={(e) => setDataKonca(e.target.value)} min={dataStartu || undefined} className={inputCls} />
            </div>
          </div>
          {dataKonca && dataKonca < dataStartu && (
            <p className="-mt-3 text-xs text-red-600">Data końca nie może być wcześniejsza niż data startu.</p>
          )}

          {/* TERMIN GRANICZNY ZAPISÓW. Kolumna `zapisy_do` istniała w bazie od
              migracji `145` i nie miała ani pola w kreatorze, ani skutku
              w kodzie. Bez niej organizator, który zapomni ręcznie zamknąć
              zapisy, przyjmuje zgłoszenie w piątek wieczorem po ułożonym
              terminarzu — a kapitan nie ma żadnego powodu, żeby zgłosić się
              dziś, a nie „kiedyś". */}
          <div>
            <label className={labelCls}>Zapisy do</label>
            <input
              type="date"
              value={zapisyDo}
              onChange={(e) => setZapisyDo(e.target.value)}
              max={dataStartu || undefined}
              className={inputCls}
            />
            <p className="mt-1 text-xs text-slate-400">
              Po tym dniu nikt nie zgłosi drużyny. Puste = zapisy zamykasz ręcznie.
            </p>
            {!zapisyOk && (
              <p className="mt-1 text-xs text-red-600">Zapisy muszą się kończyć najpóźniej w dniu startu.</p>
            )}
          </div>

          <div>
            <label className={labelCls}>Godzina startu</label>
            <TimeSelect value={godzinaStartu} onChange={setGodzinaStartu} />
          </div>

          {/* Miejsce */}
          <div>
            <label className={labelCls}>Miejsce</label>
            <div className="h-64 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
              <UnifiedLocationPicker sport={sport} value={location} onChange={setLocation} />
            </div>
            {!location.venue && (
              <input
                value={miejsceNazwa}
                onChange={(e) => setMiejsceNazwa(e.target.value)}
                placeholder="Nazwa miejsca (opcjonalnie)"
                maxLength={80}
                className={`${inputCls} mt-2`}
              />
            )}
          </div>

          {/* Format */}
          <div>
            <label className={labelCls}>Format</label>
            <div className="space-y-2">
              {FORMATY.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={[
                    'w-full rounded-xl border px-3.5 py-2.5 text-left transition-colors',
                    format === f ? 'border-primary-600 bg-primary-50 dark:bg-primary-950' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800',
                  ].join(' ')}
                >
                  <span className="block text-sm font-semibold text-ink">{FORMAT_LABEL[f]}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{FORMAT_OPIS[f]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Ile drużyn</label>
              <input
                type="number" min={2} max={64} value={maxDruzyn || ''}
                onChange={(e) => setMaxDruzyn(e.target.value === '' ? 0 : Number(e.target.value))}
                onBlur={() => setMaxDruzyn((v) => Math.min(64, Math.max(2, v || 2)))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Min. skład</label>
              <input
                type="number" min={1} max={30} value={minZawodnikow || ''}
                onChange={(e) => setMinZawodnikow(e.target.value === '' ? 0 : Number(e.target.value))}
                onBlur={() => setMinZawodnikow((v) => Math.min(30, Math.max(1, v || 1)))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Maks. skład</label>
              <input
                type="number" min={1} max={40} value={maxZawodnikow || ''}
                onChange={(e) => setMaxZawodnikow(e.target.value === '' ? 0 : Number(e.target.value))}
                onBlur={() => setMaxZawodnikow((v) => Math.min(40, Math.max(1, v || 1)))}
                className={inputCls}
              />
            </div>
          </div>
          {!skladOk && (
            <p className="-mt-3 text-xs text-red-600">Minimalny skład nie może być większy niż maksymalny.</p>
          )}

          {/* Zapisy */}
          <div>
            <label className={labelCls}>Widoczność</label>
            <SegmentedToggle
              value={widocznosc}
              onChange={setWidocznosc}
              ariaLabel="Widoczność turnieju"
              options={[
                { value: 'publiczny', label: 'Publiczny' },
                { value: 'na_link', label: 'Tylko z linku' },
              ]}
            />
          </div>

          <ToggleRow
            label="Zgłoszenia wymagają akceptacji"
            desc="Drużyna zgłasza się i czeka na Twoją decyzję. Wyłącz, żeby wchodziły od razu."
            checked={wymagaAkceptacji}
            onChange={setWymagaAkceptacji}
          />

          <div>
            <label className={labelCls}>Wpisowe za drużynę (opcjonalnie)</label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={wpisoweZl}
                onChange={(e) => setWpisoweZl(e.target.value.replace(/[^0-9.,]/g, ''))}
                placeholder="0"
                className={`${inputCls} pr-10`}
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">zł</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Bez przepływu pieniędzy przez Bojo — kwota i BLIK do ustawienia w panelu, odhaczasz „opłacone" ręcznie.</p>
          </div>

          <div>
            <label className={labelCls}>Regulamin (opcjonalnie)</label>
            <textarea value={regulamin} onChange={(e) => setRegulamin(e.target.value)} rows={3} maxLength={4000} className={inputCls} placeholder="Zasady, które drużyny zaakceptują przy zgłoszeniu…" />
          </div>

          <div>
            <label className={labelCls}>Opis (opcjonalnie)</label>
            <textarea value={opis} onChange={(e) => setOpis(e.target.value)} rows={3} maxLength={1000} className={inputCls} placeholder="Kilka słów o turnieju…" />
          </div>

          {blad && <p className="text-sm text-red-600">{blad}</p>}

          <Button onClick={handleSubmit} disabled={!gotowe || submitting} className="w-full inline-flex items-center justify-center gap-2">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Utwórz turniej'}
          </Button>
        </div>
      </main>
    </div>
  );
}
