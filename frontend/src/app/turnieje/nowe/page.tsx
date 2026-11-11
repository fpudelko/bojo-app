'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Copy, Loader2, Share2, Timer } from 'lucide-react';
import { withCount } from '@/lib/plural';
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
import { dodajArene } from '@/lib/turniejMecze';
import ZasadyGry, { DOMYSLNE_ZASADY, type WartosciZasad } from '@/components/turnieje/ZasadyGry';
import { szacunekZParametrow, zdanieOCzasie } from '@/lib/turniejKreator';
import { linkDoTurnieju, udostepnijTurniej } from '@/lib/turniejShare';
import { FORMAT_LABEL, FORMAT_OPIS } from '@/lib/turniejEtykiety';
import { FOCUS_SPORTS, sportLabel, sportEmoji } from '@/lib/sports';
import type { TurniejFormat, TurniejWidocznosc } from '@/types';

const FORMATY: TurniejFormat[] = ['grupy_puchar', 'puchar', 'liga'];

const inputCls =
  'w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-700 dark:text-slate-100';
const labelCls = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5';

export default function NowyTurniejPage() {
  const wstecz = useWstecz('/turnieje');
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const [nazwa, setNazwa] = useState('');
  const [sport, setSport] = useState<string>(FOCUS_SPORTS[0]);
  const [dataStartu, setDataStartu] = useState('');
  const [zapisyDo, setZapisyDo] = useState('');
  const [godzinaStartu, setGodzinaStartu] = useState('10:00');
  const [location, setLocation] = useState<LocationResult>({ venue: null, lat: null, lng: null, address: '' });
  const [miejsceNazwa, setMiejsceNazwa] = useState('');

  const [format, setFormat] = useState<TurniejFormat>('grupy_puchar');
  const [maxDruzyn, setMaxDruzyn] = useState(8);
  // Bez minimum drużyn, minimalnego składu i daty końca (decyzja właściciela
  // z 2026-11-08): żadne z nich niczego nie blokowało, a każde było jeszcze
  // jednym polem do zrozumienia. Kolumny zostają w bazie z wartościami
  // domyślnymi, minimalny skład wysyłamy jako 1, żeby CHECK `min <= max`
  // nie odrzucił małego składu.
  const [maxZawodnikow, setMaxZawodnikow] = useState(12);
  const [zasady, setZasady] = useState<WartosciZasad>(DOMYSLNE_ZASADY);
  const [liczbaBoisk, setLiczbaBoisk] = useState(1);

  const [widocznosc, setWidocznosc] = useState<TurniejWidocznosc>('publiczny');
  const [wymagaAkceptacji, setWymagaAkceptacji] = useState(true);
  const [wpisoweZl, setWpisoweZl] = useState('');
  const [regulamin, setRegulamin] = useState('');
  const [opis, setOpis] = useState('');

  const [blad, setBlad] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** Id świeżo utworzonego turnieju — przełącza ekran na plakat. */
  const [utworzony, setUtworzony] = useState<string | null>(null);

  const nazwaOk = nazwa.trim().length >= 3;
  const dataOk = !!dataStartu;
  const zapisyOk = !zapisyDo || !dataStartu || zapisyDo <= dataStartu;
  const skladOk = maxZawodnikow > 0;
  const zasadyOk = Object.values(zasady).every((v) => typeof v === 'boolean' || Number.isFinite(v));
  const gotowe = nazwaOk && dataOk && zapisyOk && skladOk && zasadyOk && maxDruzyn >= 2;

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
          // Koniec DNIA, nie północ na jego początku: „zapisy do 16
          // października" znaczy dla każdego „jeszcze szesnastego".
          zapisyDo: zapisyDo ? `${zapisyDo}T23:59:59` : undefined,
          godzinaStartu,
          maxDruzyn,
          minZawodnikow: 1,
          maxZawodnikow,
          ...zasady,
          wymagaAkceptacji,
          wpisoweGrosze: Number.isFinite(wpisoweGrosze) ? wpisoweGrosze : 0,
          regulamin: regulamin || undefined,
          opis: opis || undefined,
        },
        user.id,
      );
      // Pierwsze boisko zakłada wyzwalacz `utworz_domyslna_arene()` (146),
      // kolejne dokładamy tutaj. Błąd tego kroku nie cofa turnieju: boiska
      // da się dodać w panelu, więc mówimy o tym wprost, zamiast udawać sukces.
      for (let i = 2; i <= liczbaBoisk; i++) {
        try { await dodajArene(id, `Boisko ${i}`, i); }
        catch { toast('Nie wszystkie boiska się dodały, uzupełnisz je w panelu (Terminarz)', 'error'); break; }
      }
      toast('Turniej utworzony 🏆');
      // NIE do panelu. Organizator przyszedł tu po rzecz do wysłania
      // kapitanom, a panel to ekran zarządzania — wychodził z narzędzia bez
      // tego, po co przyszedł.
      setUtworzony(id);
      setSubmitting(false);
    } catch (e) {
      setBlad(e instanceof Error ? e.message : 'Nie udało się utworzyć turnieju');
      setSubmitting(false);
    }
  };

  const szacunek = szacunekZParametrow({
    format,
    liczbaDruzyn: maxDruzyn,
    // Kreator nie pyta o boiska — wyzwalacz `utworz_domyslna_arene()` (146)
    // zakłada jedno „Boisko 1". Organizator dokłada kolejne w panelu i tam
    // szacunek przelicza się na prawdziwej liczbie aren.
    liczbaAren: Math.max(1, liczbaBoisk),
    czasMeczuMin: Number.isFinite(zasady.czasMeczuMin) ? zasady.czasMeczuMin : DOMYSLNE_ZASADY.czasMeczuMin,
    przerwaMin: Number.isFinite(zasady.przerwaMin) ? zasady.przerwaMin : DOMYSLNE_ZASADY.przerwaMin,
    dataStartu: dataStartu || undefined,
    godzinaStartu,
  });

  const kopiuj = async (tekst: string, etykieta: string) => {
    try {
      await navigator.clipboard.writeText(tekst);
      toast(`${etykieta} skopiowany`);
    } catch {
      toast('Nie udało się skopiować', 'error');
    }
  };

  // ── Plakat: ekran, na którym kończy się kreator ──────────────────────────
  if (utworzony) {
    const link = linkDoTurnieju(utworzony);
    const daneDoUdostepnienia = {
      nazwa, dataStartu, godzinaStartu,
      miejsceNazwa: location.venue?.name ?? miejsceNazwa,
      wpisoweGrosze: wpisoweZl.trim() ? Math.round(parseFloat(wpisoweZl.replace(',', '.')) * 100) : 0,
    };
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header />
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-950">
              <Check className="h-6 w-6 text-primary-700 dark:text-primary-300" />
            </div>
            <h1 className="font-display text-2xl font-bold text-ink">Turniej jest ogłoszony</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Wyślij link kapitanom. Zgłoszą drużyny i skompletują składy sami.
            </p>
          </div>

          {/* ŚWIADOMIE BEZ PODGLĄDU GOTOWEGO TEKSTU. Miał tu blok z treścią
              zaproszenia i gołym adresem w środku; surowy URL w tekście wygląda
              źle i nic nie dodaje, bo arkusz systemowy pod „Wyślij kapitanom"
              niesie dokładnie tę samą treść (`tekstUdostepnieniaTurnieju`),
              tylko sformatowaną przez system. Zostaje wysyłka i link do
              skopiowania. */}
          <div className="mt-6 space-y-2">
            <Button
              onClick={async () => {
                const wynik = await udostepnijTurniej(daneDoUdostepnienia, link);
                if (wynik === 'copied') toast('Zaproszenie skopiowane');
                else if (wynik === 'failed') toast('Nie udało się udostępnić', 'error');
              }}
              className="w-full inline-flex items-center justify-center gap-2"
            >
              <Share2 className="h-4 w-4" /> Wyślij kapitanom
            </Button>
            <button
              onClick={() => kopiuj(link, 'Link')}
              className="flex min-h-[44px] w-full items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-left"
            >
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-500 dark:text-slate-400">{link}</span>
              <Copy className="h-4 w-4 shrink-0 text-primary-600" />
            </button>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-sm text-slate-600 dark:text-slate-300 shadow-sm">
            <p className="font-medium text-ink">Co dalej</p>
            <p className="mt-1">
              Gdy zgłoszą się drużyny, ustawisz boiska i wygenerujesz terminarz jednym przyciskiem.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/turnieje/${utworzony}/panel`}>
                <Button size="sm" variant="outline">Panel turnieju</Button>
              </Link>
              <Link href={`/turnieje/${utworzony}`}>
                <Button size="sm" variant="outline">Zobacz stronę turnieju</Button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

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

          <div>
            <label className={labelCls}>Data startu *</label>
            <input type="date" value={dataStartu} onChange={(e) => setDataStartu(e.target.value)} className={inputCls} />
          </div>

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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Ile drużyn najwyżej</label>
              <input
                type="number" min={2} max={64} value={maxDruzyn || ''}
                onChange={(e) => setMaxDruzyn(e.target.value === '' ? 0 : Number(e.target.value))}
                onBlur={() => setMaxDruzyn((v) => Math.min(64, Math.max(2, v || 2)))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Zawodników w drużynie</label>
              <input
                type="number" min={1} max={40} value={maxZawodnikow || ''}
                onChange={(e) => setMaxZawodnikow(e.target.value === '' ? 0 : Number(e.target.value))}
                onBlur={() => setMaxZawodnikow((v) => Math.min(40, Math.max(1, v || 1)))}
                className={inputCls}
              />
              <p className="mt-1 text-xs text-slate-400">Najwyżej, razem z rezerwowymi.</p>
            </div>
          </div>

          <div>
            <p className={labelCls}>Zasady gry</p>
            <div className="space-y-3 rounded-xl border border-slate-100 dark:border-slate-700 p-3.5">
              <div>
                <label className={labelCls} htmlFor="liczba-boisk">Boiska</label>
                <input
                  id="liczba-boisk"
                  type="number" min={1} max={12} value={liczbaBoisk || ''}
                  onChange={(e) => setLiczbaBoisk(e.target.value === '' ? 0 : Number(e.target.value))}
                  onBlur={() => setLiczbaBoisk((v) => Math.min(12, Math.max(1, v || 1)))}
                  className={inputCls}
                />
              </div>
              <ZasadyGry format={format} wartosci={zasady} onChange={(z) => setZasady((w) => ({ ...w, ...z }))} />
              <p className="text-xs text-slate-400">Wszystko zmienisz później w panelu, w Ustawieniach.</p>
            </div>
          </div>

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
            <p className="mt-1 text-xs text-slate-400">Bez przepływu pieniędzy przez Bojo, kwota i BLIK do ustawienia w panelu, odhaczasz „opłacone" ręcznie.</p>
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

          {/* NAJWAŻNIEJSZE ZDANIE W KREATORZE. Jedyna rzecz, której organizator
              nie policzy w głowie, a od której zależy, czy o 17:00 nie będzie
              grał finału po ciemku. Liczy się PRAWDZIWYMI generatorami
              terminarza na atrapach drużyn (`lib/turniejKreator.ts`), więc nie
              może rozjechać się z tym, co pokaże panel. */}
          <p className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Timer className="mt-px h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span>
              {zdanieOCzasie(szacunek)} ({withCount(Math.max(1, liczbaBoisk), 'boisko', 'boiska', 'boisk')})
            </span>
          </p>

          <Button onClick={handleSubmit} disabled={!gotowe || submitting} className="w-full min-h-[48px] inline-flex items-center justify-center gap-2">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Utwórz turniej'}
          </Button>
        </div>
      </main>
    </div>
  );
}
