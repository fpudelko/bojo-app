'use client';

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { SURFACE_LABELS } from '@/lib/labels';
import {
  pobierzPotwierdzenia, pobierzMojePotwierdzenia, zapiszPotwierdzenie,
  type FaktObiektu, type PotwierdzeniaZliczone,
} from '@/lib/potwierdzeniaObiektu';

// Faza 3 SEO/GEO (BACKLOG.md §7a) — mikro-ankiety pod obiektem. Świadomie
// NIE nadpisuje `fields.lit`/`fields.surface` (dane z OSM) — pokazuje głos
// graczy OBOK katalogu, nie zamiast niego (patrz komentarz w migracji 123).

// Ten sam zestaw sześciu nawierzchni co SURFACE_MAP w scraper/import_osm_pbf.py
// i CHECK w migracji 123 — kolejność od najczęstszej w katalogu.
const NAWIERZCHNIE: readonly string[] = ['grass', 'artificial', 'hardcourt', 'concrete', 'clay', 'sand'];

/** Ile niezależnych głosów uzasadnia pokazanie "potwierdzone przez graczy" —
 *  jeden klik nie jest jeszcze potwierdzeniem, tylko czyjąś opinią. */
const QUORUM = 2;

function najlepsza(zliczone: PotwierdzeniaZliczone[], fakt: FaktObiektu): PotwierdzeniaZliczone | null {
  const dlaFaktu = zliczone.filter((z) => z.fakt === fakt);
  if (dlaFaktu.length === 0) return null;
  return dlaFaktu.reduce((a, b) => (b.liczba > a.liczba ? b : a));
}

function etykietaWartosci(fakt: FaktObiektu, wartosc: string): string {
  if (fakt === 'oswietlenie') return wartosc === 'tak' ? 'jest oświetlone' : 'bez oświetlenia';
  return SURFACE_LABELS[wartosc] ?? wartosc;
}

export default function AnkietyObiektu({ fieldId }: { fieldId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [zliczone, setZliczone] = useState<PotwierdzeniaZliczone[]>([]);
  const [moje, setMoje] = useState<Partial<Record<FaktObiektu, string>>>({});
  const [loading, setLoading] = useState(true);
  const [wysylanyFakt, setWysylanyFakt] = useState<FaktObiektu | null>(null);

  const odswiez = useCallback(async () => {
    try {
      const [z, m] = await Promise.all([
        pobierzPotwierdzenia(fieldId),
        user ? pobierzMojePotwierdzenia(fieldId, user.id) : Promise.resolve({}),
      ]);
      setZliczone(z);
      setMoje(m);
    } catch (e) {
      console.error('[AnkietyObiektu]', e);
    } finally {
      setLoading(false);
    }
  }, [fieldId, user]);

  useEffect(() => { odswiez(); }, [odswiez]);

  const glosuj = async (fakt: FaktObiektu, wartosc: string) => {
    if (!user) return;
    setWysylanyFakt(fakt);
    try {
      await zapiszPotwierdzenie(fieldId, user.id, fakt, wartosc);
      setMoje((prev) => ({ ...prev, [fakt]: wartosc }));
      // Odśwież zliczenia z serwera zamiast liczyć lokalnie — zmiana zdania
      // (drugi głos na ten sam fakt) przesuwa jeden licznik w dół i drugi
      // w górę naraz, łatwiej to przeliczyć jednym zapytaniem niż w JS.
      const z = await pobierzPotwierdzenia(fieldId);
      setZliczone(z);
      toast('Dzięki za potwierdzenie');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się zapisać', 'error');
    } finally {
      setWysylanyFakt(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4 text-slate-300">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  const oswietlenieTop = najlepsza(zliczone, 'oswietlenie');
  const nawierzchniaTop = najlepsza(zliczone, 'nawierzchnia');

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-5">
      <h2 className="font-semibold text-slate-900">Pomóż innym graczom</h2>

      <div>
        <p className="text-sm text-slate-700 mb-2">Czy to boisko jest oświetlone po zmroku?</p>
        <div className="flex gap-2">
          {(['tak', 'nie'] as const).map((wartosc) => (
            <button
              key={wartosc}
              type="button"
              disabled={!user || wysylanyFakt === 'oswietlenie'}
              onClick={() => glosuj('oswietlenie', wartosc)}
              className={`rounded-xl border px-3 py-1.5 text-sm transition disabled:opacity-50 ${
                moje.oswietlenie === wartosc
                  ? 'border-primary-600 bg-primary-50 font-semibold text-primary-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {wartosc === 'tak' ? 'Tak' : 'Nie'}
            </button>
          ))}
        </div>
        {oswietlenieTop && oswietlenieTop.liczba >= QUORUM && (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-500">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary-600" />
            {etykietaWartosci('oswietlenie', oswietlenieTop.wartosc)} (potwierdzone przez {oswietlenieTop.liczba} graczy)
          </p>
        )}
      </div>

      <div>
        <p className="text-sm text-slate-700 mb-2">Jaka tu jest nawierzchnia?</p>
        <div className="flex flex-wrap gap-2">
          {NAWIERZCHNIE.map((wartosc) => (
            <button
              key={wartosc}
              type="button"
              disabled={!user || wysylanyFakt === 'nawierzchnia'}
              onClick={() => glosuj('nawierzchnia', wartosc)}
              className={`rounded-xl border px-3 py-1.5 text-sm transition disabled:opacity-50 ${
                moje.nawierzchnia === wartosc
                  ? 'border-primary-600 bg-primary-50 font-semibold text-primary-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {SURFACE_LABELS[wartosc]}
            </button>
          ))}
        </div>
        {nawierzchniaTop && nawierzchniaTop.liczba >= QUORUM && (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-500">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary-600" />
            Nawierzchnia: {etykietaWartosci('nawierzchnia', nawierzchniaTop.wartosc)} (potwierdzone przez {nawierzchniaTop.liczba} graczy)
          </p>
        )}
      </div>

      {!user && (
        <p className="text-xs text-slate-400">Zaloguj się, aby potwierdzić.</p>
      )}
    </div>
  );
}
