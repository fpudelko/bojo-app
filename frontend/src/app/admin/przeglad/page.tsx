'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Lock, X, Check, MapPin, Phone, Globe, Mail, Clock, ChevronLeft, Trash2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { sportEmoji } from '@/lib/sports';
import { distanceKm } from '@/lib/geo';
import { surfaceLabel, venueThumbnail } from '@/lib/labels';
import { plural } from '@/lib/plural';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VenueRow {
  id: string;
  name: string;
  address: string;
  sport: string[];
  lat: number;
  lng: number;
  surface: string | null;
  is_indoor: boolean;
  description: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  opening_hours: string | null;
  operator: string | null;
  venue_type: string | null;
  dimensions_m: string | null;
  fee: boolean | null;
  lit: boolean | null;
  has_changing_rooms: boolean | null;
  has_shower: boolean | null;
  has_toilets: boolean | null;
  capacity: number | null;
  source: string | null;
  moderation_status: string | null;
}

const VENUE_TYPE_LABELS: Record<string, string> = {
  orlik: 'Orlik',
  rental: 'Wynajem',
  public: 'Ogólnodostępne',
  school: 'Szkolne',
  club: 'Klubowe',
};

// ---------------------------------------------------------------------------
// Geo helpers
// ---------------------------------------------------------------------------

/** Dwa obiekty bliżej niż tyle uznajemy za kandydatów na duplikat. */
const DUPLICATE_RADIUS_KM = 0.15;

function nameSimilar(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const na = norm(a);
  const nb = norm(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

function findDuplicates(current: VenueRow, all: VenueRow[]): VenueRow[] {
  return all.filter((v) => {
    if (v.id === current.id) return false;
    const nearby = distanceKm(current.lat, current.lng, v.lat, v.lng) < DUPLICATE_RADIUS_KM;
    const sameName = nameSimilar(current.name, v.name);
    return nearby || sameName;
  });
}

// ---------------------------------------------------------------------------
// DuplicateRow
// ---------------------------------------------------------------------------

function DuplicateRow({ v, onDelete }: { v: VenueRow; onDelete: (id: string) => void }) {
  const [busy, setBusy] = useState(false);

  async function del() {
    if (!confirm(`Usunąć "${v.name}"?`)) return;
    setBusy(true);
    await supabase.from('fields').delete().eq('id', v.id);
    onDelete(v.id);
    setBusy(false);
  }
  const statusCls =
    v.moderation_status === 'approved' ? 'text-green-600' :
    v.moderation_status === 'hidden'   ? 'text-red-500'   : 'text-amber-500';

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={venueThumbnail(v.lat, v.lng, 96, 96, 17) ?? ''}
          alt=""
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{v.name}</p>
        <p className="text-xs text-slate-500 truncate">{v.address}</p>
        <p className={`text-[11px] font-medium ${statusCls}`}>
          {v.moderation_status ?? 'pending'} · {v.source}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Link
          href={`/admin/boisko/${v.id}`}
          target="_blank"
          className="rounded-lg px-2.5 py-1.5 text-xs border border-slate-200 text-slate-500 hover:bg-slate-50"
        >
          Edytuj
        </Link>
        <button
          disabled={busy}
          onClick={del}
          className="rounded-lg px-2.5 py-1.5 text-xs bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 disabled:opacity-40"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

function VenueCard({
  venue, total, index, duplicates, onDeleteDuplicate,
}: {
  venue: VenueRow;
  total: number;
  index: number;
  duplicates: VenueRow[];
  onDeleteDuplicate: (id: string) => void;
}) {
  const photoSrc = venueThumbnail(venue.lat, venue.lng, 1200, 600, 17);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${venue.lat},${venue.lng}`;

  const chips = [
    venue.is_indoor ? '🏠 Hala' : '☀️ Zewnętrzne',
    venue.surface ? surfaceLabel(venue.surface) : null,
    venue.fee === true ? '💰 Płatne' : venue.fee === false ? '🆓 Bezpłatne' : null,
    venue.lit ? '💡 Oświetlone' : null,
    venue.has_changing_rooms ? '🚿 Szatnia' : null,
    venue.capacity ? `👥 ${venue.capacity} os.` : null,
    venue.dimensions_m ? `📐 ${venue.dimensions_m}` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col h-full">
      {/* Hero photo */}
      <div className="relative h-52 sm:h-64 shrink-0 bg-slate-800 overflow-hidden">
        {photoSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoSrc} alt="" className="w-full h-full object-cover" />
        )}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/60 rounded-full px-4 py-1 text-white text-xs font-semibold">
          {index + 1} / {total}
        </div>
        {venue.source && (
          <span className="absolute top-3 right-3 bg-black/60 rounded-md px-2 py-0.5 text-[10px] text-white font-semibold uppercase">
            {venue.source}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-slate-200">
        <div
          className="h-full bg-primary-600 transition-all duration-300"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {/* Title */}
        <div>
          <div className="flex items-start justify-between gap-2 mb-1">
            <h2 className="text-xl font-bold text-slate-900 leading-tight">{venue.name}</h2>
            {venue.venue_type && (
              <span className="shrink-0 mt-0.5 rounded-full bg-primary-100 text-primary-700 px-2.5 py-0.5 text-xs font-semibold">
                {VENUE_TYPE_LABELS[venue.venue_type] ?? venue.venue_type}
              </span>
            )}
          </div>
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary-700">
            <MapPin className="w-3.5 h-3.5 shrink-0" />{venue.address}
          </a>
        </div>

        {/* Sports */}
        <div className="flex flex-wrap gap-1.5">
          {venue.sport.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 bg-slate-100 rounded-full px-2.5 py-1 text-sm font-medium text-slate-700">
              {sportEmoji(s)} {s}
            </span>
          ))}
        </div>

        {/* Chips */}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span key={c} className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-600">{c}</span>
            ))}
          </div>
        )}

        {/* Description */}
        {venue.description && (
          <p className="text-sm text-slate-600 leading-relaxed border-l-2 border-primary-200 pl-3">
            {venue.description}
          </p>
        )}

        {/* Contact */}
        <div className="flex flex-col gap-1">
          {venue.operator    && <p className="text-sm text-slate-500">🏢 {venue.operator}</p>}
          {venue.opening_hours && (
            <p className="text-sm text-slate-500 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 shrink-0" />{venue.opening_hours}
            </p>
          )}
          {venue.phone   && <a href={`tel:${venue.phone}`} className="text-sm text-slate-500 flex items-center gap-1.5 hover:text-primary-700"><Phone className="w-3.5 h-3.5 shrink-0" />{venue.phone}</a>}
          {venue.website && <a href={venue.website} target="_blank" rel="noopener noreferrer" className="text-sm text-slate-500 flex items-center gap-1.5 hover:text-primary-700 truncate"><Globe className="w-3.5 h-3.5 shrink-0" />{venue.website.replace(/^https?:\/\/(www\.)?/, '')}</a>}
          {venue.email   && <a href={`mailto:${venue.email}`} className="text-sm text-slate-500 flex items-center gap-1.5 hover:text-primary-700"><Mail className="w-3.5 h-3.5 shrink-0" />{venue.email}</a>}
        </div>

        {/* Duplicates */}
        {duplicates.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5" />
              {plural(duplicates.length, 'Możliwy duplikat', `${duplicates.length} możliwe duplikaty`, `${duplicates.length} możliwych duplikatów`)}
            </p>
            {duplicates.map((d) => (
              <DuplicateRow key={d.id} v={d} onDelete={onDeleteDuplicate} />
            ))}
          </div>
        )}

        <div className="pt-1">
          <Link href={`/admin/boisko/${venue.id}`} target="_blank" className="text-xs text-slate-400 hover:text-slate-600">
            ✏️ Edytuj szczegóły
          </Link>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PrzegladPage() {
  const { user, loading: authLoading } = useAuth();
  const [adminState, setAdminState] = useState<'checking' | 'yes' | 'no'>('checking');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setAdminState('no'); return; }
    supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
      .then(({ data }) => setAdminState(data?.is_admin ? 'yes' : 'no'), () => setAdminState('no'));
  }, [authLoading, user]);

  // queue = pending only; allVenues = everything (for duplicate detection)
  const [queue, setQueue] = useState<VenueRow[]>([]);
  const [allVenues, setAllVenues] = useState<VenueRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (adminState !== 'yes') return;
    const cols = 'id,name,address,sport,lat,lng,surface,is_indoor,description,phone,website,email,opening_hours,operator,venue_type,dimensions_m,fee,lit,has_changing_rooms,has_shower,has_toilets,capacity,source,moderation_status';
    Promise.all([
      supabase.from('fields').select(cols).or('moderation_status.is.null,moderation_status.eq.pending').order('name'),
      supabase.from('fields').select('id,name,address,sport,lat,lng,source,moderation_status').order('name'),
    ]).then(([{ data: pending }, { data: all }]) => {
      setQueue((pending ?? []) as VenueRow[]);
      setAllVenues((all ?? []) as VenueRow[]);
      setLoading(false);
      if (!pending || pending.length === 0) setDone(true);
    });
  }, [adminState]);

  const decide = useCallback(async (status: 'approved' | 'hidden') => {
    if (busy || !queue[idx]) return;
    setBusy(true);
    await supabase.from('fields').update({
      moderation_status: status,
      map_visibility: status === 'approved' ? 'public' : 'hidden',
    }).eq('id', queue[idx].id);
    setBusy(false);
    const next = idx + 1;
    if (next >= queue.length) setDone(true);
    else setIdx(next);
  }, [busy, idx, queue]);

  const handleDeleteDuplicate = useCallback((id: string) => {
    setDeletedIds((prev) => new Set(Array.from(prev).concat(id)));
    setAllVenues((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const duplicates = useMemo(() => {
    if (!queue[idx]) return [];
    return findDuplicates(queue[idx], allVenues).filter((v) => !deletedIds.has(v.id));
  }, [queue, idx, allVenues, deletedIds]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowRight' || e.key === 'l') decide('approved');
      if (e.key === 'ArrowLeft'  || e.key === 'j') decide('hidden');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [decide]);

  if (authLoading || adminState === 'checking') {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Ładowanie…</div>;
  }
  if (adminState === 'no') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-slate-500">
        <Lock className="w-8 h-8" /><p className="font-semibold">Brak dostępu</p>
      </div>
    );
  }
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Ładowanie boisk…</div>;
  }
  if (done || queue.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="text-5xl">✅</div>
        <h2 className="text-2xl font-bold text-slate-800">Wszystko przejrzane!</h2>
        <p className="text-slate-500">Nie ma już boisk czekających na przegląd.</p>
        <Link href="/admin/moderacja" className="mt-2 rounded-xl bg-primary-700 text-white px-6 py-3 font-semibold hover:bg-primary-800">
          Lista boisk
        </Link>
      </div>
    );
  }

  const venue = queue[idx];

  return (
    <div className="min-h-screen bg-white flex flex-col max-w-lg mx-auto">
      {/* Back */}
      <div className="absolute top-3 left-3 z-10">
        <Link href="/admin/moderacja"
          className="inline-flex items-center gap-1 rounded-full bg-black/50 text-white text-xs px-3 py-1.5 hover:bg-black/70">
          <ChevronLeft className="w-3.5 h-3.5" /> Wróć
        </Link>
      </div>

      {/* Card */}
      <div className={`flex-1 flex flex-col min-h-0 transition-opacity duration-150 ${busy ? 'opacity-50' : ''}`}>
        <VenueCard
          venue={venue}
          total={queue.length}
          index={idx}
          duplicates={duplicates}
          onDeleteDuplicate={handleDeleteDuplicate}
        />
      </div>

      {/* Buttons */}
      <div className="shrink-0 flex gap-3 p-4 bg-white border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <button
          disabled={busy}
          onClick={() => decide('hidden')}
          className="flex-1 flex flex-col items-center gap-1 rounded-2xl bg-red-50 border-2 border-red-200 text-red-600 font-bold py-4 hover:bg-red-100 active:scale-95 transition-all disabled:opacity-40"
        >
          <X className="w-7 h-7" />
          <span className="text-sm">Ukryj</span>
          <span className="text-[10px] font-normal opacity-60">← / J</span>
        </button>
        <button
          disabled={busy}
          onClick={() => decide('approved')}
          className="flex-1 flex flex-col items-center gap-1 rounded-2xl bg-green-50 border-2 border-green-300 text-green-700 font-bold py-4 hover:bg-green-100 active:scale-95 transition-all disabled:opacity-40"
        >
          <Check className="w-7 h-7" />
          <span className="text-sm">Wyświetlaj</span>
          <span className="text-[10px] font-normal opacity-60">→ / L</span>
        </button>
      </div>
    </div>
  );
}
