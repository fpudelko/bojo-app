'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Bell, BellOff, Mail, Smartphone, Check } from 'lucide-react';
import {
  getMyAlert, saveAlert, deleteMyAlert,
  OKRESY_ALERTU, wygasaZa, okresZDaty, PROMIEN_DOMYSLNY, type AlertInput,
} from '@/lib/alerts';
import { pozycjaBezPytania } from '@/lib/geo';
import { useAuth } from '@/lib/auth';
import { FOCUS_SPORTS, sportEmoji, sportLabel } from '@/lib/sports';
import { SHOW_SMS_FEATURES } from '@/lib/features';
import { stanPush, wlaczPush, type StanPush } from '@/lib/push';
import SportChip from '@/components/ui/SportChip';
import ToggleRow from '@/components/ui/ToggleRow';
import WyborMiejscowosci from '@/components/map/WyborMiejscowosci';
import type { Miejscowosc } from '@/lib/miejscowosci';
import type { GameAlert } from '@/types';
import { WARSTWA } from '@/lib/warstwy';

const DAYS = [
  { n: 1, short: 'Pn' }, { n: 2, short: 'Wt' }, { n: 3, short: 'Śr' },
  { n: 4, short: 'Cz' }, { n: 5, short: 'Pt' }, { n: 6, short: 'Sb' }, { n: 7, short: 'Nd' },
];

/** Domyślne okno godzinowe po włączeniu filtra pory dnia — popołudnie i wieczór,
 *  czyli pora, o której gra się w tygodniu po pracy. */
const GODZINA_OD_DOMYSLNA = 17;
const GODZINA_DO_DOMYSLNA = 22;

const GODZINY = Array.from({ length: 24 }, (_, i) => i);
const dwieCyfry = (h: number) => `${String(h).padStart(2, '0')}:00`;

/** Co powiedzieć o pushu w zależności od tego, co ta przeglądarka w ogóle umie.
 *  Stany biorą się z `stanPush()` — ten sam mechanizm co przełącznik w profilu. */
const OPIS_PUSHA: Record<StanPush, string> = {
  wlaczone:           'Powiadomienia na telefon są włączone.',
  wylaczone:          'Możesz włączyć powiadomienia na telefon.',
  zablokowane:        'Powiadomienia są zablokowane w ustawieniach przeglądarki — odblokuj je tam, wtedy wrócimy do tego pytania.',
  'wymaga-instalacji': 'Na iPhonie powiadomienia działają dopiero po dodaniu Bojo do ekranu głównego: Udostępnij → „Dodaj do ekranu początkowego".',
  nieobslugiwane:     'Ta przeglądarka nie obsługuje powiadomień. Zostaje mail i dzwonek w aplikacji.',
};

interface Props {
  onClose: () => void;
  onSaved?: (alert: GameAlert) => void;
  defaultSport?: string;
  defaultRadiusKm?: number;
  defaultLat?: number;
  defaultLng?: number;
  defaultLabel?: string;
}

/**
 * Okno alertu o nowych meczach.
 *
 * TE SAME KONTROLKI CO ARKUSZ FILTRÓW — 2026-09-14, zgłoszone wprost („ten
 * widok nie jest potrzebny, niech będzie użyty ten do filtrów"). Okno miało
 * własny przycisk GPS, własne pole miasta i własny suwak promienia, czyli trzy
 * kopie rzeczy, które stoją w filtrach — a pytanie jest identyczne: gdzie
 * i jak daleko. Dziś tym zajmuje się `WyborMiejscowosci`, ten sam komponent
 * co na `/mapa`, razem z pinezką i suwakiem odległości.
 *
 * DWA RÓŻNE „KIEDY", ROZDZIELONE NAZWĄ. Alert ma dwa czasy, które nie mają ze
 * sobą nic wspólnego, i zlanie ich w jedną sekcję było najprostszą drogą do
 * tego, żeby nikt nie wiedział, co ustawia:
 *
 *   * „Powiadamiaj o meczach" — kiedy ma być MECZ (dni tygodnia, pora dnia),
 *   * „Jak długo powiadamiać" — jak długo ma żyć ALERT.
 *
 * ALERT JEST DOMYŚLNIE BEZTERMINOWY (decyzja właściciela). To dobry wybór dla
 * kogoś, kto naprawdę czeka na mecz, ale ma jeden warunek: musi dać się
 * wyłączyć z samej wiadomości, bez logowania. Stąd `wylacz_token` i trasa
 * `/alert/wylacz/[token]` — bez nich alert bezterminowy jest spamem.
 */
export default function AlertSetupDialog({
  onClose, onSaved, defaultSport, defaultRadiusKm, defaultLat, defaultLng, defaultLabel,
}: Props) {
  const { user } = useAuth();

  const [existing, setExisting] = useState<GameAlert | null>(null);
  const [sport,    setSport]    = useState(defaultSport ?? '');
  const [days,     setDays]     = useState<number[]>([]);
  const [miejsce,  setMiejsce]  = useState<Miejscowosc | null>(
    defaultLat != null && defaultLng != null
      ? { nazwa: defaultLabel || 'Moja lokalizacja', kontekst: '', lat: defaultLat, lng: defaultLng }
      : null,
  );
  const [promienKm, setPromienKm] = useState(defaultRadiusKm ?? PROMIEN_DOMYSLNY);

  const [poraOgraniczona, setPoraOgraniczona] = useState(false);
  const [godzinaOd, setGodzinaOd] = useState(GODZINA_OD_DOMYSLNA);
  const [godzinaDo, setGodzinaDo] = useState(GODZINA_DO_DOMYSLNA);

  const [okresDni, setOkresDni] = useState<number | null>(null);
  const [kanalEmail, setKanalEmail] = useState(true);
  const [push, setPush] = useState<StanPush | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved,    setSaved]    = useState(false);

  useEffect(() => { stanPush().then(setPush).catch(() => setPush('nieobslugiwane')); }, []);

  // Istniejący alert wygrywa z wartościami przyniesionymi z filtrów — to jego
  // edycja, nie zakładanie nowego. Gdy alertu nie ma i nikt nie podał miejsca,
  // bierzemy pozycję, ale WYŁĄCZNIE przy już udzielonej zgodzie
  // (`pozycjaBezPytania`): samo otwarcie okna nie jest powodem, żeby
  // przeglądarka wyskoczyła z systemową prośbą o lokalizację.
  useEffect(() => {
    let zywe = true;
    (async () => {
      const a = user ? await getMyAlert().catch(() => null) : null;
      if (!zywe) return;
      if (a) {
        setExisting(a);
        setSport(a.sport ?? '');
        setDays(a.daysOfWeek);
        setMiejsce({ nazwa: a.cityLabel || 'Wybrane miejsce', kontekst: '', lat: a.lat, lng: a.lng });
        setPromienKm(a.radiusKm);
        setOkresDni(okresZDaty(a.expiresAt));
        setKanalEmail(a.kanalEmail);
        if (a.godzinaOd != null && a.godzinaDo != null) {
          setPoraOgraniczona(true);
          setGodzinaOd(a.godzinaOd);
          setGodzinaDo(a.godzinaDo);
        }
        return;
      }
      if (defaultLat != null) return;
      const poz = await pozycjaBezPytania();
      if (!zywe || !poz) return;
      setMiejsce({ nazwa: 'Moja lokalizacja', kontekst: '', lat: poz.lat, lng: poz.lng });
    })();
    return () => { zywe = false; };
    // `defaultLat` czytane raz, przy otwarciu — okno nie przestawia się w locie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const toggleDay = (n: number) =>
    setDays((prev) => prev.includes(n) ? prev.filter((d) => d !== n) : [...prev, n].sort());

  const handleSave = async () => {
    if (!user || !miejsce) return;
    setSaving(true);
    try {
      const input: AlertInput = {
        sport:      sport || undefined,
        daysOfWeek: days,
        lat:        miejsce.lat,
        lng:        miejsce.lng,
        radiusKm:   promienKm,
        cityLabel:  miejsce.nazwa || undefined,
        expiresAt:  wygasaZa(okresDni),
        // Godziny idą PARAMI albo wcale — migracja `148` pilnuje tego także
        // w bazie, więc rozjazd tutaj skończyłby się odmową zapisu, a nie
        // cichym zapisaniem połowy filtra.
        godzinaOd:  poraOgraniczona ? godzinaOd : null,
        godzinaDo:  poraOgraniczona ? godzinaDo : null,
        kanalEmail,
      };
      const zapisany = await saveAlert(user.id, input);
      setExisting(zapisany);
      setSaved(true);
      onSaved?.(zapisany);
      setTimeout(onClose, 1200);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    setDeleting(true);
    await deleteMyAlert(existing.id);
    setDeleting(false);
    onClose();
  };

  const naglowekSekcji = 'text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2';

  return (
    <div className={`fixed inset-0 ${WARSTWA.modal} flex items-end sm:items-center justify-center p-0 sm:p-4`}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden dark:bg-slate-800">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary-700" />
            <h2 className="text-base font-bold text-ink">
              {existing ? 'Twój alert na gierki' : 'Powiadom mnie o nowych meczach'}
            </h2>
          </div>
          <button onClick={onClose} aria-label="Zamknij" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 dark:hover:bg-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5 overflow-y-auto max-h-[70vh]">
          {/* ── SPORT ── */}
          <div>
            <p className={naglowekSekcji}>Sport</p>
            <div className="flex flex-wrap gap-2">
              {FOCUS_SPORTS.map((s) => (
                <SportChip
                  key={s}
                  emoji={sportEmoji(s)}
                  label={sportLabel(s)}
                  selected={sport === s}
                  onClick={() => setSport((cur) => (cur === s ? '' : s))}
                />
              ))}
            </div>
            <p className="mt-2 text-sm font-medium text-ink">
              {sport === '' ? 'Dowolny sport' : sportLabel(sport)}
            </p>
          </div>

          {/* ── GDZIE ── te same kontrolki co w arkuszu filtrów: pole
              z pinezką, a po wybraniu miejsca suwak promienia. */}
          <div>
            <p className={naglowekSekcji}>Gdzie</p>
            <WyborMiejscowosci
              wybrana={miejsce}
              promienKm={promienKm}
              naZmiane={(m, km) => { setMiejsce(m); setPromienKm(km); }}
            />
          </div>

          {/* ── KIEDY MA BYĆ MECZ ── pierwszy z dwóch „czasów". */}
          <div>
            <p className={naglowekSekcji}>
              Powiadamiaj o meczach{' '}
              <span className="normal-case font-normal text-slate-400">(puste = dowolny dzień)</span>
            </p>
            <div className="flex gap-2">
              {DAYS.map(({ n, short }) => (
                <button
                  key={n}
                  onClick={() => toggleDay(n)}
                  aria-pressed={days.includes(n)}
                  className={[
                    'flex-1 py-2 rounded-xl text-xs font-semibold transition-colors border',
                    days.includes(n)
                      ? 'bg-primary-700 text-white border-primary-700'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-primary-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300',
                  ].join(' ')}
                >
                  {short}
                </button>
              ))}
            </div>

            <div className="mt-1 rounded-xl border border-slate-200 px-4 dark:border-slate-700">
              <ToggleRow
                label="Tylko o określonej porze"
                desc="Bez tego dostaniesz też mecze o 10 rano"
                checked={poraOgraniczona}
                onChange={setPoraOgraniczona}
              />
              {poraOgraniczona && (
                <div className="flex items-center gap-2 pb-3">
                  <select
                    value={godzinaOd}
                    onChange={(e) => setGodzinaOd(Number(e.target.value))}
                    aria-label="Od godziny"
                    className="h-11 flex-1 rounded-xl border border-slate-300 px-3 text-sm dark:border-slate-600 dark:bg-slate-800"
                  >
                    {GODZINY.map((h) => <option key={h} value={h}>{dwieCyfry(h)}</option>)}
                  </select>
                  <span className="shrink-0 text-sm text-slate-400">do</span>
                  <select
                    value={godzinaDo}
                    onChange={(e) => setGodzinaDo(Number(e.target.value))}
                    aria-label="Do godziny"
                    className="h-11 flex-1 rounded-xl border border-slate-300 px-3 text-sm dark:border-slate-600 dark:bg-slate-800"
                  >
                    {GODZINY.map((h) => <option key={h} value={h}>{dwieCyfry(h)}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* ── JAK DŁUGO ŻYJE ALERT ── drugi „czas", świadomie osobno. */}
          <div>
            <p className={naglowekSekcji}>Jak długo powiadamiać</p>
            <div className="flex flex-wrap gap-2">
              {OKRESY_ALERTU.map((o) => (
                <button
                  key={o.etykieta}
                  type="button"
                  onClick={() => setOkresDni(o.dni)}
                  aria-pressed={okresDni === o.dni}
                  className={[
                    'rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                    okresDni === o.dni
                      ? 'border-primary-700 bg-primary-50 text-primary-800 dark:bg-primary-950'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300',
                  ].join(' ')}
                >
                  {o.etykieta}
                </button>
              ))}
            </div>
            {okresDni === null && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Alert będzie działał, dopóki go nie wyłączysz — każda wiadomość
                ma na dole link, który go gasi jednym kliknięciem.
              </p>
            )}
          </div>

          {/* ── CZYM DAĆ ZNAĆ ── */}
          <div>
            <p className={naglowekSekcji}>Czym dać znać</p>

            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              <Check className="h-4 w-4 shrink-0 text-primary-700" aria-hidden />
              {/* Dzwonek to historia, nie kanał przerywający dzień — ta sama
                  doktryna co w `lib/ustawieniaPowiadomien.ts`, więc nie ma tu
                  przełącznika, który obiecywałby jego wyłączenie. */}
              Dzwonek w aplikacji — zawsze
            </div>

            <div className="mt-1 rounded-xl border border-slate-200 px-4 dark:border-slate-700">
              <ToggleRow
                label="Mail"
                desc="Na adres, którym się logujesz"
                checked={kanalEmail}
                onChange={setKanalEmail}
              />
            </div>

            {/* PUSH NIE MA TU WŁASNEGO PRZEŁĄCZNIKA. Jedzie automatycznie
                z wiersza w `notifications` (wyzwalacz z migracji `102`),
                a wyłącza się w ustawieniach powiadomień — per typ, dla całej
                aplikacji. Drugi przełącznik w tym oknie znaczyłby dwa miejsca
                na jedną rzecz i pierwszy rozjazd byłby kwestią czasu. Zostaje
                stan i, gdy się da, jedno kliknięcie włączenia. */}
            <div className="mt-2 flex items-start gap-2 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Powiadomienie na telefon</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {push ? OPIS_PUSHA[push] : 'Sprawdzam…'}
                </p>
                {push === 'wylaczone' && user && (
                  <button
                    type="button"
                    disabled={pushBusy}
                    onClick={async () => {
                      setPushBusy(true);
                      try { await wlaczPush(user.id); setPush(await stanPush()); }
                      catch { setPush(await stanPush()); }
                      finally { setPushBusy(false); }
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-800 disabled:opacity-60 dark:border-primary-800 dark:bg-primary-950"
                  >
                    {pushBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
                    Włącz powiadomienia
                  </button>
                )}
              </div>
            </div>

            {SHOW_SMS_FEATURES && (
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-500 dark:border-slate-700">
                <Mail className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                SMS — wkrótce
              </div>
            )}
          </div>
        </div>

        <div className="px-5 pb-5 pt-3 border-t border-slate-100 space-y-2 dark:border-slate-700">
          {saved ? (
            <div className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-50 text-green-700 font-semibold text-sm">
              <Bell className="w-4 h-4" /> Alert zapisany!
            </div>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving || !miejsce}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-700 py-3.5 text-sm font-semibold text-white disabled:opacity-50 active:scale-[0.98] transition-all"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
              {existing ? 'Zaktualizuj alert' : 'Zapisz alert'}
            </button>
          )}

          {existing && !saved && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex w-full items-center justify-center gap-2 py-2.5 text-sm font-medium text-slate-400 hover:text-red-500 transition-colors"
            >
              <BellOff className="w-4 h-4" />
              {deleting ? 'Usuwam…' : 'Usuń alert'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
