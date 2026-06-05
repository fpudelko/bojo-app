'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Lock, Search, Phone, Mail, Globe, Download, Star, ChevronDown,
  UserCheck, RotateCcw, Check, Sparkles, X, Building2, Clock, ExternalLink, MapPin,
  AlertTriangle, Trash2, Eye, EyeOff,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth, displayName } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getFields } from '@/lib/api';
import type { MapVisibility } from '@/types';
import {
  getOutreachMap, saveOutreach,
  STATUS_META, STATUS_ORDER, BOOKING_SYSTEM_META, BOOKING_SYSTEM_ORDER,
  type Outreach, type OutreachStatus, type BookingSystem, type OutreachPatch,
} from '@/lib/outreach';
import type { Field } from '@/types';

const inputCls =
  'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

function defaultOutreach(fieldId: string): Outreach {
  return { fieldId, status: 'nowy', bookingSystem: 'nieznany', priority: 0 };
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatPl(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function siteHost(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url.slice(0, 40); }
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
interface Toast { id: number; message: string; type: 'success' | 'error' }
let toastCounter = 0;

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------
function csvCell(v: string | number | undefined | null): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv(rows: { field: Field; o: Outreach }[]) {
  const headers = [
    'Nazwa', 'Adres', 'Kod', 'Sporty', 'Telefon', 'E-mail', 'WWW', 'Operator',
    'Status', 'System rezerwacji', 'Przypisany', 'Osoba kontaktowa',
    'Ostatni kontakt', 'Followup', 'Notatki', 'AI', 'Ostatnia zmiana',
  ];
  const lines = rows.map(({ field: f, o }) => [
    f.name, f.address, f.postcode, f.sport.join(' / '),
    f.phone, f.email, f.website, f.operator,
    STATUS_META[o.status].label, BOOKING_SYSTEM_META[o.bookingSystem],
    o.assignedName, o.contactPerson,
    o.lastContactedAt ? formatPl(o.lastContactedAt) : '',
    o.nextFollowupAt ? formatPl(o.nextFollowupAt) : '',
    o.notes, o.aiSummary, o.updatedByName,
  ].map(csvCell).join(','));

  const csv = '﻿' + [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `obiekty-outreach-${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ===========================================================================
export default function OutreachPanel() {
  const { user, loading: authLoading } = useAuth();
  const [adminState, setAdminState] = useState<'checking' | 'yes' | 'no'>('checking');

  const [fields, setFields] = useState<Field[]>([]);
  const [outreach, setOutreach] = useState<Map<string, Outreach>>(new Map());
  const [loading, setLoading] = useState(true);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = ++toastCounter;
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  }, []);

  // --- Filters ---
  const [search, setSearch] = useState('');
  const [fStatus, setFStatus] = useState<'all' | OutreachStatus>('all');
  const [fSport, setFSport] = useState('all');
  const [fAssign, setFAssign] = useState<'all' | 'mine' | 'unassigned'>('all');
  const [fContact, setFContact] = useState<'all' | 'phone' | 'email' | 'website' | 'any'>('all');
  const [fHideDone, setFHideDone] = useState(false);
  const [fDuplicates, setFDuplicates] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  // --- Admin check (own, to avoid access-denied flash) ---
  useEffect(() => {
    if (authLoading) return;
    if (!user) { setAdminState('no'); return; }
    supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
      .then(({ data }) => setAdminState(data?.is_admin ? 'yes' : 'no'), () => setAdminState('no'));
  }, [authLoading, user]);

  // --- Load data ---
  useEffect(() => {
    if (adminState !== 'yes') return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [fieldsRes, oMap] = await Promise.all([
          getFields({ limit: 5000 }),
          getOutreachMap(),
        ]);
        if (cancelled) return;
        setFields(fieldsRes.fields);
        setOutreach(oMap);
      } catch (e) {
        if (!cancelled) addToast(e instanceof Error ? e.message : 'Błąd ładowania', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [adminState, addToast]);

  const getO = useCallback(
    (fieldId: string): Outreach => outreach.get(fieldId) ?? defaultOutreach(fieldId),
    [outreach],
  );

  // --- Persist a patch ---
  const persist = useCallback(async (fieldId: string, patch: OutreachPatch) => {
    if (!user) return;
    // optimistic
    setOutreach((prev) => {
      const next = new Map(prev);
      next.set(fieldId, { ...(prev.get(fieldId) ?? defaultOutreach(fieldId)), ...patch } as Outreach);
      return next;
    });
    try {
      const saved = await saveOutreach(fieldId, patch, { id: user.id, name: displayName(user) });
      setOutreach((prev) => { const n = new Map(prev); n.set(fieldId, saved); return n; });
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Nie udało się zapisać', 'error');
    }
  }, [user, addToast]);

  // --- Suspicious contacts: phone/email shared by 3+ fields ---
  const suspiciousMap = useMemo(() => {
    const phoneCnt = new Map<string, number>();
    const emailCnt = new Map<string, number>();
    fields.forEach((f) => {
      if (f.phone) phoneCnt.set(f.phone, (phoneCnt.get(f.phone) ?? 0) + 1);
      if (f.email) emailCnt.set(f.email, (emailCnt.get(f.email) ?? 0) + 1);
    });
    const result = new Map<string, { phoneCount: number; emailCount: number }>();
    fields.forEach((f) => {
      const pc = f.phone ? (phoneCnt.get(f.phone) ?? 1) : 1;
      const ec = f.email ? (emailCnt.get(f.email) ?? 1) : 1;
      if (pc >= 3 || ec >= 3) result.set(f.id, { phoneCount: pc, emailCount: ec });
    });
    return result;
  }, [fields]);

  // --- Toggle map_visibility on a field ---
  const changeVisibility = useCallback(async (fieldId: string, v: MapVisibility) => {
    const { error } = await supabase
      .from('fields')
      .update({ map_visibility: v })
      .eq('id', fieldId);
    if (error) { addToast(error.message, 'error'); return; }
    setFields((prev) => prev.map((f) => f.id === fieldId ? { ...f, mapVisibility: v } : f));
    addToast(v === 'public' ? 'Obiekt widoczny na mapie' : 'Obiekt ukryty z mapy');
  }, [addToast]);

  // --- Clear AI-enriched contact data from fields table ---
  const clearContact = useCallback(async (fieldId: string) => {
    const { error } = await supabase
      .from('fields')
      .update({ phone: null, email: null, website: null })
      .eq('id', fieldId);
    if (error) { addToast(error.message, 'error'); return; }
    setFields((prev) => prev.map((f) =>
      f.id === fieldId ? { ...f, phone: undefined, email: undefined, website: undefined } : f,
    ));
    addToast('Dane kontaktowe wyczyszczone');
  }, [addToast]);

  // --- Sports for filter dropdown ---
  const sportOptions = useMemo(() => {
    const s = new Set<string>();
    fields.forEach((f) => f.sport.forEach((x) => s.add(x)));
    return Array.from(s).sort();
  }, [fields]);

  // --- Filtered + sorted rows ---
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = fields
      .map((f) => ({ field: f, o: getO(f.id) }))
      .filter(({ field: f, o }) => {
        if (q && !f.name.toLowerCase().includes(q) && !f.address.toLowerCase().includes(q)) return false;
        if (fStatus !== 'all' && o.status !== fStatus) return false;
        if (fSport !== 'all' && !f.sport.includes(fSport)) return false;
        if (fAssign === 'mine' && o.assignedTo !== user?.id) return false;
        if (fAssign === 'unassigned' && o.assignedTo) return false;
        if (fContact === 'phone' && !f.phone) return false;
        if (fContact === 'email' && !f.email) return false;
        if (fContact === 'website' && !f.website) return false;
        if (fContact === 'any' && !f.phone && !f.email && !f.website) return false;
        if (fHideDone && (o.status === 'umowiony' || o.status === 'odrzucony')) return false;
        if (fDuplicates && !suspiciousMap.has(f.id)) return false;
        return true;
      });
    // sort: high priority first, then has-contact-info, then name
    list.sort((a, b) => {
      if (b.o.priority !== a.o.priority) return b.o.priority - a.o.priority;
      const ca = a.field.phone || a.field.email || a.field.website ? 1 : 0;
      const cb = b.field.phone || b.field.email || b.field.website ? 1 : 0;
      if (cb !== ca) return cb - ca;
      return a.field.name.localeCompare(b.field.name, 'pl');
    });
    return list;
  }, [fields, getO, search, fStatus, fSport, fAssign, fContact, fHideDone, fDuplicates, suspiciousMap, user?.id]);

  const filtersActive = search || fStatus !== 'all' || fSport !== 'all' || fAssign !== 'all' || fContact !== 'all' || fHideDone || fDuplicates;

  // --- Pipeline stats ---
  const stats = useMemo(() => {
    const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<OutreachStatus, number>;
    fields.forEach((f) => { counts[getO(f.id).status]++; });
    return counts;
  }, [fields, getO]);

  // ---- Guards ----
  if (authLoading || adminState === 'checking') {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 py-8">
          <div className="h-8 w-56 bg-gray-200 rounded-lg animate-pulse mb-6" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        </main>
      </div>
    );
  }

  if (adminState === 'no') {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 text-center">
          <div>
            <Lock className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium text-gray-700">Brak dostępu</p>
            <p className="text-sm text-gray-500 mt-1">Panel kontaktu z obiektami jest dostępny tylko dla administratorów.</p>
            <Link href="/" className="text-primary-600 text-sm underline mt-4 inline-block">Wróć na stronę główną</Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 py-8">
        {/* Title row */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl font-bold text-ink">Kontakt z obiektami</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {loading ? 'Ładowanie…' : `${fields.length} obiektów łącznie`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => exportCsv(rows)} disabled={loading || rows.length === 0}>
            <Download className="w-4 h-4" /> Eksport CSV
          </Button>
        </div>

        {/* Pipeline stats */}
        <div className="flex flex-wrap gap-2 mb-5">
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => setFStatus((cur) => (cur === s ? 'all' : s))}
              className={[
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                fStatus === s ? 'ring-2 ring-primary-500 ' : '',
                STATUS_META[s].cls,
              ].join('')}
            >
              {STATUS_META[s].label}
              <span className="font-bold tabular-nums">{stats[s]}</span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-5 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj po nazwie lub adresie…"
              className={`${inputCls} w-full pl-9`}
            />
          </div>
          <select value={fSport} onChange={(e) => setFSport(e.target.value)} className={inputCls}>
            <option value="all">Wszystkie sporty</option>
            {sportOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={fContact} onChange={(e) => setFContact(e.target.value as typeof fContact)} className={inputCls}>
            <option value="all">Dowolny kontakt</option>
            <option value="any">Ma jakikolwiek kontakt</option>
            <option value="phone">Ma telefon</option>
            <option value="email">Ma e-mail</option>
            <option value="website">Ma stronę</option>
          </select>
          <select value={fAssign} onChange={(e) => setFAssign(e.target.value as typeof fAssign)} className={inputCls}>
            <option value="all">Wszyscy</option>
            <option value="mine">Moje</option>
            <option value="unassigned">Nieprzypisane</option>
          </select>
          <label className="inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={fHideDone} onChange={(e) => setFHideDone(e.target.checked)} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            Ukryj zamknięte
          </label>
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none text-amber-700">
            <input type="checkbox" checked={fDuplicates} onChange={(e) => setFDuplicates(e.target.checked)} className="rounded border-amber-300 text-amber-600 focus:ring-amber-500" />
            <AlertTriangle className="w-3.5 h-3.5" />
            Duplikaty kontaktu
            {suspiciousMap.size > 0 && (
              <span className="ml-0.5 bg-amber-100 text-amber-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{suspiciousMap.size}</span>
            )}
          </label>
          {/* Count badge */}
          {!loading && (
            <span className={`ml-auto text-sm font-medium tabular-nums px-3 py-1.5 rounded-lg ${filtersActive ? 'bg-primary-50 text-primary-700' : 'text-gray-500'}`}>
              {rows.length}{filtersActive ? ` / ${fields.length}` : ''} obiektów
            </span>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="font-medium">Brak obiektów spełniających filtry</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm min-w-[1000px]">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Obiekt</th>
                  <th className="text-left font-medium px-3 py-3">Kontakt</th>
                  <th className="text-left font-medium px-3 py-3">Status</th>
                  <th className="text-left font-medium px-3 py-3">System</th>
                  <th className="text-left font-medium px-3 py-3">Przypisany</th>
                  <th className="px-3 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(({ field: f, o }) => (
                  <OutreachRow
                    key={f.id}
                    field={f}
                    o={o}
                    isExpanded={expanded === f.id}
                    onToggle={() => setExpanded((cur) => (cur === f.id ? null : f.id))}
                    onPatch={(patch) => persist(f.id, patch)}
                    currentUser={user ? { id: user.id, name: displayName(user) } : null}
                    onToast={addToast}
                    suspicious={suspiciousMap.get(f.id)}
                    onClearContact={() => clearContact(f.id)}
                    onVisibilityChange={(v) => changeVisibility(f.id, v)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Toasts */}
      <div className="fixed inset-0 pointer-events-none flex flex-col items-end justify-start p-6 gap-2 pt-20 md:pt-6 z-[1020]">
        {toasts.map((t) => (
          <div key={t.id} className={[
            'px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-xs',
            t.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white',
          ].join(' ')}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}

// ===========================================================================
// Row + expandable editor
// ===========================================================================
interface RowProps {
  field: Field;
  o: Outreach;
  isExpanded: boolean;
  onToggle: () => void;
  onPatch: (patch: OutreachPatch) => void;
  currentUser: { id: string; name: string } | null;
  onToast: (m: string, t?: 'success' | 'error') => void;
  suspicious?: { phoneCount: number; emailCount: number };
  onClearContact: () => Promise<void>;
  onVisibilityChange: (v: MapVisibility) => Promise<void>;
}

function OutreachRow({ field: f, o, isExpanded, onToggle, onPatch, currentUser, onToast, suspicious, onClearContact, onVisibilityChange }: RowProps) {
  // Local draft for free-text fields (saved explicitly)
  const [notes, setNotes] = useState(o.notes ?? '');
  const [contactPerson, setContactPerson] = useState(o.contactPerson ?? '');
  const [followup, setFollowup] = useState(o.nextFollowupAt ?? '');
  const [assignName, setAssignName] = useState(o.assignedName ?? '');
  const [savingDraft, setSavingDraft] = useState(false);
  const [clearingContact, setClearingContact] = useState(false);
  const [togglingVis, setTogglingVis] = useState(false);

  // keep drafts in sync if outreach changes underneath
  useEffect(() => { setNotes(o.notes ?? ''); }, [o.notes]);
  useEffect(() => { setContactPerson(o.contactPerson ?? ''); }, [o.contactPerson]);
  useEffect(() => { setFollowup(o.nextFollowupAt ?? ''); }, [o.nextFollowupAt]);
  useEffect(() => { setAssignName(o.assignedName ?? ''); }, [o.assignedName]);

  const dirty =
    notes !== (o.notes ?? '') ||
    contactPerson !== (o.contactPerson ?? '') ||
    followup !== (o.nextFollowupAt ?? '') ||
    assignName !== (o.assignedName ?? '');

  const saveDraft = async () => {
    setSavingDraft(true);
    const patch: OutreachPatch = { notes, contactPerson, nextFollowupAt: followup };
    if (assignName !== (o.assignedName ?? '')) {
      patch.assignedName = assignName || null;
      if (!assignName) patch.assignedTo = null;
    }
    await onPatch(patch);
    setSavingDraft(false);
    onToast('Zapisano');
  };

  const claim = () => {
    if (!currentUser) return;
    onPatch({ assignedTo: currentUser.id, assignedName: currentUser.name });
  };
  const release = () => onPatch({ assignedTo: null, assignedName: null });

  const markContactedToday = () => onPatch({ lastContactedAt: new Date().toISOString() });

  const isMyRow = o.assignedTo === currentUser?.id;
  const isSomeoneElsesRow = !!o.assignedTo && !isMyRow;

  return (
    <>
      <tr className="hover:bg-gray-50/60 transition-colors">
        {/* Obiekt */}
        <td className="px-4 py-3 align-top cursor-pointer" onClick={onToggle}>
          <div className="flex items-start gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onPatch({ priority: o.priority ? 0 : 1 }); }}
              title={o.priority ? 'Usuń flagę' : 'Oznacz jako ważny'}
              className="mt-0.5 shrink-0"
            >
              <Star className={`w-4 h-4 ${o.priority ? 'fill-amber-400 text-amber-400' : 'text-gray-300 hover:text-amber-300'}`} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="font-medium text-ink truncate">{f.name}</p>
                {f.mapVisibility === 'organizer_only' && (
                  <EyeOff className="w-3 h-3 text-gray-300 shrink-0" />
                )}
                {f.mapVisibility === 'hidden' && (
                  <X className="w-3 h-3 text-red-400 shrink-0" />
                )}
              </div>
              <p className="text-xs text-gray-500 truncate">
                {f.district && <span className="font-medium text-gray-600">{f.district} · </span>}
                {f.address}
              </p>
              {f.sport.length > 0 && (
                <p className="text-[11px] text-gray-400 truncate mt-0.5">{f.sport.join(' · ')}</p>
              )}
            </div>
          </div>
        </td>

        {/* Kontakt — pełny tekst */}
        <td className="px-3 py-3 align-top">
          <div className="flex flex-col gap-1">
            {suspicious && (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-medium mb-0.5">
                <AlertTriangle className="w-3 h-3" />
                {Math.max(suspicious.phoneCount, suspicious.emailCount)}× ten sam kontakt
              </span>
            )}
            {f.phone ? (
              <a href={`tel:${f.phone}`} className="inline-flex items-center gap-1.5 text-xs text-primary-700 hover:text-primary-900 hover:underline" onClick={(e) => e.stopPropagation()}>
                <Phone className="w-3.5 h-3.5 shrink-0" /> {f.phone}
              </a>
            ) : null}
            {f.email ? (
              <a href={`mailto:${f.email}`} className="inline-flex items-center gap-1.5 text-xs text-primary-700 hover:text-primary-900 hover:underline max-w-[200px] truncate" onClick={(e) => e.stopPropagation()}>
                <Mail className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{f.email}</span>
              </a>
            ) : null}
            {f.website ? (
              <a href={f.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary-700 hover:text-primary-900 hover:underline max-w-[200px]" onClick={(e) => e.stopPropagation()}>
                <Globe className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{siteHost(f.website)}</span>
              </a>
            ) : null}
            {!f.phone && !f.email && !f.website && (
              <span className="text-xs text-gray-300">brak kontaktu</span>
            )}
          </div>
        </td>

        {/* Status */}
        <td className="px-3 py-3 align-top">
          <div className="relative inline-block">
            <select
              value={o.status}
              onChange={(e) => onPatch({ status: e.target.value as OutreachStatus })}
              onClick={(e) => e.stopPropagation()}
              className={`appearance-none pr-6 pl-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 ${STATUS_META[o.status].cls}`}
            >
              {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>
            <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
          </div>
        </td>

        {/* System rezerwacji */}
        <td className="px-3 py-3 align-top">
          <select
            value={o.bookingSystem}
            onChange={(e) => onPatch({ bookingSystem: e.target.value as BookingSystem })}
            onClick={(e) => e.stopPropagation()}
            className="border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
          >
            {BOOKING_SYSTEM_ORDER.map((b) => <option key={b} value={b}>{BOOKING_SYSTEM_META[b]}</option>)}
          </select>
        </td>

        {/* Przypisany */}
        <td className="px-3 py-3 align-top">
          {o.assignedName ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${isMyRow ? 'bg-primary-50 text-primary-700' : 'bg-gray-100 text-gray-600'}`}>
                <UserCheck className="w-3.5 h-3.5" /> {o.assignedName}
              </span>
              {isMyRow ? (
                <button
                  onClick={(e) => { e.stopPropagation(); release(); }}
                  title="Zwolnij"
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); claim(); }}
                  className="text-xs text-primary-700 hover:underline font-medium"
                >
                  Przejmij
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); claim(); }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 border border-dashed border-gray-300"
            >
              Przejmij
            </button>
          )}
        </td>

        {/* Expand chevron */}
        <td className="px-3 py-3 align-top cursor-pointer" onClick={onToggle}>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </td>
      </tr>

      {/* Expanded editor */}
      {isExpanded && (
        <tr className="bg-gray-50/80">
          <td colSpan={6} className="px-4 py-4">

            {/* Dane obiektu */}
            <div className="mb-4 p-3 rounded-xl bg-white border border-gray-200">
              {/* Header: name + address + link */}
              <div className="flex items-start justify-between gap-3 mb-3 pb-2.5 border-b border-gray-100">
                <div>
                  <p className="font-semibold text-ink">{f.name}</p>
                  <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    {f.address}{f.postcode ? `, ${f.postcode}` : ''}
                  </p>
                  {f.sport.length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">{f.sport.join(' · ')}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className={[
                    'inline-flex items-center gap-1 rounded-lg border text-xs font-medium overflow-hidden',
                    togglingVis ? 'opacity-50 pointer-events-none' : '',
                  ].join(' ')} onClick={(e) => e.stopPropagation()}>
                    {([
                      { value: 'public',         icon: Eye,    label: 'Na mapie',    cls: 'bg-green-50 text-green-700 border-green-200' },
                      { value: 'organizer_only', icon: EyeOff, label: 'Tylko org.',  cls: 'bg-amber-50 text-amber-700 border-amber-200' },
                      { value: 'hidden',         icon: X,      label: 'Ukryty',      cls: 'bg-red-50 text-red-700 border-red-200' },
                    ] as { value: MapVisibility; icon: React.ElementType; label: string; cls: string }[]).map(({ value, icon: Icon, label, cls }) => (
                      <button
                        key={value}
                        onClick={async () => {
                          if (f.mapVisibility === value) return;
                          setTogglingVis(true);
                          await onVisibilityChange(value);
                          setTogglingVis(false);
                        }}
                        className={[
                          'inline-flex items-center gap-1 px-2.5 py-1.5 transition-colors',
                          f.mapVisibility === value ? cls : 'bg-white text-gray-400 hover:text-gray-600',
                        ].join(' ')}
                      >
                        <Icon className="w-3 h-3" /> {label}
                      </button>
                    ))}
                  </div>
                  <Link
                    href={`/boisko/${f.id}`}
                    target="_blank"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Otwórz
                  </Link>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {f.phone && (
                  <a href={`tel:${f.phone}`} className="inline-flex items-center gap-2 text-sm text-primary-700 hover:underline break-all">
                    <Phone className="w-4 h-4 text-gray-400 shrink-0" /> {f.phone}
                  </a>
                )}
                {f.email && (
                  <a href={`mailto:${f.email}`} className="inline-flex items-center gap-2 text-sm text-primary-700 hover:underline break-all">
                    <Mail className="w-4 h-4 text-gray-400 shrink-0" /> {f.email}
                  </a>
                )}
                {f.website && (
                  <a href={f.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-primary-700 hover:underline break-all">
                    <Globe className="w-4 h-4 text-gray-400 shrink-0" /> {f.website}
                  </a>
                )}
                {f.operator && (
                  <span className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <Building2 className="w-4 h-4 text-gray-400 shrink-0" /> {f.operator}
                  </span>
                )}
                {f.openingHours && (
                  <span className="inline-flex items-start gap-2 text-sm text-gray-700">
                    <Clock className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                    <span className="whitespace-pre-wrap">{f.openingHours}</span>
                  </span>
                )}
                {f.description && (
                  <p className="text-sm text-gray-600 border-t border-gray-100 pt-2 mt-1">{f.description}</p>
                )}
              </div>
              {suspicious && (
                <div className="mt-3 pt-2.5 border-t border-amber-100 flex items-center justify-between gap-3">
                  <p className="text-xs text-amber-700 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    {f.phone && suspicious.phoneCount >= 3 && <>Telefon {f.phone} używany w {suspicious.phoneCount} obiektach. </>}
                    {f.email && suspicious.emailCount >= 3 && <>E-mail {f.email} używany w {suspicious.emailCount} obiektach. </>}
                    Prawdopodobnie błędne dane z AI.
                  </p>
                  <button
                    onClick={async () => {
                      if (!confirm('Wyczyścić telefon, e-mail i stronę WWW z tego obiektu?')) return;
                      setClearingContact(true);
                      await onClearContact();
                      setClearingContact(false);
                    }}
                    disabled={clearingContact}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 shrink-0 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {clearingContact ? 'Czyszczę…' : 'Wyczyść dane kontaktowe'}
                  </button>
                </div>
              )}
            </div>

            {/* AI enrichment */}
            {(o.aiSummary || o.bookingUrl) && (
              <div className="mb-4 flex gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5">
                <Sparkles className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-violet-700 mb-0.5">
                    AI znalazł{o.aiEnrichedAt ? ` · ${formatPl(o.aiEnrichedAt)}` : ''}
                    {o.bookingProvider && <span className="ml-2 font-normal">· {o.bookingProvider}</span>}
                  </p>
                  {o.aiSummary && (
                    <p className="text-sm text-violet-900 whitespace-pre-wrap mb-1">{o.aiSummary}</p>
                  )}
                  {o.bookingUrl && (
                    <a
                      href={o.bookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-violet-700 underline hover:text-violet-900 break-all"
                    >
                      <Globe className="w-3 h-3 shrink-0" />
                      {o.bookingUrl}
                    </a>
                  )}
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-3 gap-4">
              {/* Notes */}
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Notatki — co odpowiedzieli</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Np. rezerwacja tylko telefonicznie u Pana Marka, w weekendy zajęte, otwarci na współpracę…"
                  className={`${inputCls} w-full resize-y`}
                />
              </div>

              {/* Side fields */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Osoba kontaktowa</label>
                  <input
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="Z kim rozmawiano"
                    className={`${inputCls} w-full`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Oddzwonić / followup</label>
                  <input
                    type="date"
                    value={followup}
                    onChange={(e) => setFollowup(e.target.value)}
                    className={`${inputCls} w-full`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Ostatni kontakt</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">{formatPl(o.lastContactedAt)}</span>
                    <button onClick={markContactedToday} className="text-xs text-primary-700 hover:underline inline-flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" /> Ustaw dziś
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Przypisany do</label>
                  <div className="flex gap-1.5">
                    <input
                      value={assignName}
                      onChange={(e) => setAssignName(e.target.value)}
                      placeholder={isSomeoneElsesRow ? o.assignedName : 'Imię osoby…'}
                      className={`${inputCls} flex-1 min-w-0`}
                    />
                    {assignName && assignName !== (o.assignedName ?? '') && (
                      <button onClick={() => setAssignName(o.assignedName ?? '')} className="text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
              <div className="text-xs text-gray-400">
                {o.updatedByName ? <>Ostatnia zmiana: {o.updatedByName} · {formatPl(o.updatedAt)}</> : 'Brak historii zmian'}
              </div>
              <Button size="sm" variant="primary" onClick={saveDraft} isLoading={savingDraft} disabled={!dirty}>
                <Check className="w-4 h-4" /> Zapisz
              </Button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
