'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Lock, Search, Trash2, EyeOff, Check, Satellite, RefreshCw, MapPin, ChevronDown, ChevronRight,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { sportEmoji } from '@/lib/sports';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ModerationStatus = 'pending' | 'approved' | 'hidden';

interface VenueRow {
  id: string;
  name: string;
  address: string;
  sport: string[];
  lat: number;
  lng: number;
  photo_url: string | null;
  photo_reference: string | null;
  photo_source: string | null;
  map_visibility: string;
  moderation_status: ModerationStatus | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function satelliteUrl(lat: number, lng: number): string {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return '';
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${lng},${lat},17,0/400x240@2x?access_token=${token}`;
}

function bestPhotoSrc(v: VenueRow): string {
  if (v.photo_reference) return `/api/venue-photo?ref=${encodeURIComponent(v.photo_reference)}&w=400`;
  if (v.photo_url) return v.photo_url;
  return satelliteUrl(v.lat, v.lng);
}

function photoLabel(v: VenueRow): string {
  if (v.photo_reference) return 'Google';
  if (v.photo_url) {
    if (v.photo_source === 'wikimedia') return 'Wikimedia';
    if (v.photo_source === 'satellite') return 'Satelita (scraper)';
    return 'URL';
  }
  return 'Satelita';
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending:  { label: 'Do sprawdzenia', cls: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Zatwierdzone',   cls: 'bg-green-100 text-green-700' },
  hidden:   { label: 'Ukryte',         cls: 'bg-red-100 text-red-700' },
};

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
interface Toast { id: number; msg: string; ok: boolean }
let _tid = 0;

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const add = useCallback((msg: string, ok = true) => {
    const id = ++_tid;
    setToasts((t) => [...t, { id, msg, ok }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  return { toasts, add };
}

// ---------------------------------------------------------------------------
// VenueCard
// ---------------------------------------------------------------------------

function VenueCard({
  venue, onUpdate, onDelete, onSkip, isSkipped,
}: {
  venue: VenueRow;
  onUpdate: (id: string, patch: Partial<VenueRow>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSkip?: () => void;
  isSkipped?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [imgErr, setImgErr] = useState(false);
  const status = venue.moderation_status ?? 'pending';
  const smeta = STATUS_META[status] ?? STATUS_META.pending;

  const hasExternalPhoto = !!(venue.photo_reference || venue.photo_url);
  const photoSrc = imgErr ? satelliteUrl(venue.lat, venue.lng) : bestPhotoSrc(venue);

  async function act(patch: Partial<VenueRow>) {
    setBusy(true);
    await onUpdate(venue.id, patch);
    setBusy(false);
  }

  const btnBase = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40';
  const btnGhost  = `${btnBase} border border-slate-200 bg-white text-slate-600 hover:border-slate-400`;
  const btnGreen  = `${btnBase} bg-green-600 text-white hover:bg-green-700`;
  const btnAmber  = `${btnBase} bg-amber-500 text-white hover:bg-amber-600`;
  const btnRed    = `${btnBase} bg-red-500 text-white hover:bg-red-600`;
  const btnSkip   = `${btnBase} border border-slate-200 bg-white text-slate-500 hover:bg-slate-50`;

  return (
    <div className={[
      'flex flex-col rounded-2xl border bg-white shadow-sm overflow-hidden transition-opacity',
      busy ? 'opacity-50 pointer-events-none' : '',
      isSkipped ? 'border-amber-200 ring-1 ring-amber-100' : '',
    ].join(' ')}>
      {/* Photo */}
      <div className="relative h-36 bg-slate-100 overflow-hidden">
        {photoSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoSrc}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setImgErr(true)}
          />
        )}
        <span className="absolute top-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
          {imgErr ? 'Satelita' : photoLabel(venue)}
        </span>
        <span className={`absolute top-2 right-2 rounded-md px-2 py-0.5 text-[10px] font-semibold ${smeta.cls}`}>
          {smeta.label}
        </span>
        {isSkipped && (
          <span className="absolute bottom-2 left-2 rounded-md bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold text-white">
            ← Pominięty
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-2 p-3 flex-1">
        <p className="font-bold text-[13px] text-slate-800 leading-tight line-clamp-2">
          <Link href={`/boisko/${venue.id}`} target="_blank" className="hover:underline">{venue.name}</Link>
        </p>
        <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
          <MapPin className="w-3 h-3 shrink-0" />{venue.address}
        </p>
        <div className="flex flex-wrap gap-1">
          {venue.sport.map((s) => (
            <span key={s} className="text-[11px] bg-slate-100 rounded-md px-1.5 py-0.5">
              {sportEmoji(s)} {s}
            </span>
          ))}
        </div>

        {/* Photo controls */}
        <div className="flex gap-1.5 flex-wrap mt-auto pt-2 border-t border-slate-100">
          {hasExternalPhoto ? (
            <button
              disabled={busy}
              className={btnGhost}
              title="Usuń zdjęcie — wróć do satelity"
              onClick={() => act({ photo_url: null, photo_reference: null, photo_source: null })}
            >
              <Satellite className="w-3.5 h-3.5" /> Satelita
            </button>
          ) : (
            <span className={`${btnBase} border border-slate-200 bg-slate-50 text-slate-400 cursor-default`}>
              <Satellite className="w-3.5 h-3.5" /> Satelita
            </span>
          )}
        </div>

        {/* Status + action controls */}
        <div className="flex gap-1.5 flex-wrap">
          {status !== 'approved' && (
            <button disabled={busy} className={btnGreen} onClick={() => act({ moderation_status: 'approved', map_visibility: 'public' } as Partial<VenueRow>)}>
              <Check className="w-3.5 h-3.5" /> Zatwierdź
            </button>
          )}
          {status !== 'hidden' && (
            <button disabled={busy} className={btnAmber} onClick={() => act({ moderation_status: 'hidden', map_visibility: 'hidden' } as Partial<VenueRow>)}>
              <EyeOff className="w-3.5 h-3.5" /> Ukryj
            </button>
          )}
          {status !== 'pending' && (
            <button disabled={busy} className={btnGhost} onClick={() => act({ moderation_status: 'pending', map_visibility: 'organizer_only' } as Partial<VenueRow>)}>
              <RefreshCw className="w-3.5 h-3.5" /> Cofnij
            </button>
          )}
          {onSkip && !isSkipped && (
            <button disabled={busy} className={btnSkip} onClick={onSkip} title="Pomiń — wróć później">
              <ChevronRight className="w-3.5 h-3.5" /> Pomiń
            </button>
          )}
          <button
            disabled={busy}
            className={btnRed}
            onClick={async () => {
              if (!confirm(`Na pewno usunąć "${venue.name}"? Tej operacji nie można cofnąć.`)) return;
              setBusy(true);
              await onDelete(venue.id);
            }}
          >
            <Trash2 className="w-3.5 h-3.5" /> Usuń
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const TABS: { key: ModerationStatus | 'all'; label: string }[] = [
  { key: 'all',      label: 'Wszystkie' },
  { key: 'pending',  label: 'Do sprawdzenia' },
  { key: 'approved', label: 'Zatwierdzone' },
  { key: 'hidden',   label: 'Ukryte' },
];

export default function ModeracjaPage() {
  const { user, loading: authLoading } = useAuth();
  const [adminState, setAdminState] = useState<'checking' | 'yes' | 'no'>('checking');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setAdminState('no'); return; }
    supabase
      .from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
      .then(
        ({ data }) => setAdminState(data?.is_admin ? 'yes' : 'no'),
        () => setAdminState('no'),
      );
  }, [authLoading, user]);

  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ModerationStatus | 'all'>('pending');
  const [search, setSearch] = useState('');
  const { toasts, add: addToast } = useToasts();

  // Skip set — session-only, resets on reload
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [skippedOpen, setSkippedOpen] = useState(false);

  // Session progress tracking — record how many were pending when we started
  const [sessionTotal, setSessionTotal] = useState<number | null>(null);
  const [sessionDone, setSessionDone] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('fields')
      .select('id,name,address,sport,lat,lng,photo_url,photo_reference,photo_source,map_visibility,moderation_status')
      .order('name');
    if (!error && data) setVenues(data as VenueRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (adminState === 'yes') load();
  }, [adminState, load]);

  // Set session total once data is loaded (only once)
  useEffect(() => {
    if (!loading && sessionTotal === null && venues.length > 0) {
      const pending = venues.filter((v) => (v.moderation_status ?? 'pending') === 'pending').length;
      setSessionTotal(pending);
    }
  }, [loading, venues, sessionTotal]);

  const filtered = useMemo(() => {
    let list = venues;
    if (tab !== 'all') list = list.filter((v) => (v.moderation_status ?? 'pending') === tab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((v) => v.name.toLowerCase().includes(q) || v.address?.toLowerCase().includes(q));
    }
    return list;
  }, [venues, tab, search]);

  // Separate active (non-skipped) from skipped within filtered
  const activeVenues   = useMemo(() => filtered.filter((v) => !skipped.has(v.id)), [filtered, skipped]);
  const skippedVenues  = useMemo(() => filtered.filter((v) =>  skipped.has(v.id)), [filtered, skipped]);

  const counts = useMemo(() => ({
    pending:  venues.filter((v) => (v.moderation_status ?? 'pending') === 'pending').length,
    approved: venues.filter((v) => v.moderation_status === 'approved').length,
    hidden:   venues.filter((v) => v.moderation_status === 'hidden').length,
  }), [venues]);

  const handleSkip = useCallback((id: string) => {
    setSkipped((prev) => new Set([...Array.from(prev), id]));
  }, []);

  const handleUpdate = useCallback(async (id: string, patch: Partial<VenueRow>) => {
    const venue = venues.find((v) => v.id === id);
    const wasPending = (venue?.moderation_status ?? 'pending') === 'pending';
    const becomesDecided = patch.moderation_status === 'approved' || patch.moderation_status === 'hidden';

    const { error } = await supabase.from('fields').update(patch).eq('id', id);
    if (error) { addToast(`Błąd: ${error.message}`, false); return; }
    setVenues((prev) => prev.map((v) => v.id === id ? { ...v, ...patch } : v));
    addToast('Zapisano');

    if (wasPending && becomesDecided) {
      setSessionDone((n) => n + 1);
    }
  }, [venues, addToast]);

  const handleDelete = useCallback(async (id: string) => {
    const { error } = await supabase.from('fields').delete().eq('id', id);
    if (error) { addToast(`Błąd: ${error.message}`, false); return; }
    setVenues((prev) => prev.filter((v) => v.id !== id));
    setSkipped((prev) => { const n = new Set(prev); n.delete(id); return n; });
    addToast('Usunięto obiekt');
  }, [addToast]);

  // --- Auth guards ---
  if (authLoading || adminState === 'checking') {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <div className="p-8 text-center text-slate-400">Ładowanie…</div>
      </div>
    );
  }
  if (adminState === 'no') {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
          <Lock className="w-8 h-8" />
          <p className="text-lg font-semibold">Brak dostępu</p>
        </div>
      </div>
    );
  }

  const progressPct = sessionTotal ? Math.round((sessionDone / sessionTotal) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={[
            'rounded-xl px-4 py-2.5 text-sm font-semibold shadow-lg text-white',
            t.ok ? 'bg-green-600' : 'bg-red-600',
          ].join(' ')}>
            {t.msg}
          </div>
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="flex items-start justify-between mb-4 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Moderacja boisk</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {counts.pending} do sprawdzenia · {counts.approved} zatwierdzone · {counts.hidden} ukryte
            </p>
          </div>
          <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-700 shrink-0 mt-1">← Admin</Link>
        </div>

        {/* Session progress bar */}
        {sessionTotal !== null && sessionTotal > 0 && (
          <div className="mb-5 rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-center gap-4 shadow-sm">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-600">Postęp sesji</span>
                <span className="text-xs font-bold tabular-nums text-slate-700">
                  {sessionDone} / {sessionTotal} przetworzonych
                  {skipped.size > 0 && (
                    <span className="ml-2 text-amber-600">· {skipped.size} pominiętych</span>
                  )}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-600 rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
            {TABS.map(({ key, label }) => {
              const cnt = key === 'all' ? venues.length : counts[key as ModerationStatus] ?? 0;
              return (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={[
                    'px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap',
                    tab === key
                      ? 'bg-primary-700 text-white'
                      : 'text-slate-600 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {label} <span className="ml-1 opacity-70 text-xs">({cnt})</span>
                </button>
              );
            })}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj po nazwie lub adresie…"
              className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            />
          </div>
          {/* Result count */}
          <span className="self-center text-sm text-slate-500 tabular-nums">
            {activeVenues.length} obiektów
            {filtered.length !== venues.length && ` / ${venues.length} łącznie`}
          </span>
        </div>

        {/* Active grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-white border h-72 animate-pulse" />
            ))}
          </div>
        ) : activeVenues.length === 0 && skippedVenues.length === 0 ? (
          <div className="text-center py-20 text-slate-400">Brak wyników</div>
        ) : activeVenues.length === 0 && skippedVenues.length > 0 ? (
          <div className="text-center py-10 text-slate-500">
            <p className="font-medium mb-1">Wszystkie obiekty pominięte</p>
            <p className="text-sm text-slate-400">Wróć do pominiętych poniżej, żeby je przetworzyć.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {activeVenues.map((v) => (
              <VenueCard
                key={v.id}
                venue={v}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onSkip={() => handleSkip(v.id)}
              />
            ))}
          </div>
        )}

        {/* Skipped section */}
        {skippedVenues.length > 0 && (
          <div className="mt-8">
            <button
              onClick={() => setSkippedOpen((o) => !o)}
              className="flex items-center gap-2 text-sm font-semibold text-amber-700 mb-3 hover:text-amber-900 transition-colors"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${skippedOpen ? '' : '-rotate-90'}`} />
              Pominięte — {skippedVenues.length}
              <span className="text-xs font-normal text-amber-600 ml-1">(wróć do nich później)</span>
            </button>

            {skippedOpen && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {skippedVenues.map((v) => (
                  <VenueCard
                    key={v.id}
                    venue={v}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                    isSkipped
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
