'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, Lock, MapPin, ChevronDown, ChevronUp, X, RefreshCw, Copy, Check, LogOut, Trash2,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import CoverUpload from '@/components/ui/CoverUpload';
import VenuePicker from '@/components/map/VenuePicker';
import UprawnieniaCzlonkaPanel from '@/components/groups/UprawnieniaCzlonkaPanel';
import { useAuth } from '@/lib/auth';
import {
  getGroup, updateGroup, setGroupCover, getMyGroupPermissions, getGroupMembers,
  setMemberPermissions, regenerateJoinCode, leaveGroup, deleteGroup, uprawnieniaCzlonka,
} from '@/lib/groups';
import { linkDoGrupy } from '@/lib/groupShare';
import { useToast } from '@/lib/toast';
import { useWstecz } from '@/lib/historia';
import { usePotwierdzenie } from '@/lib/usePotwierdzenie';
import { FOCUS_SPORTS, sportLabel, sportEmoji } from '@/lib/sports';
import type { Group, GroupMember, GroupPermissions } from '@/types';

type UstawieniaTab = 'ogolne' | 'zaproszenia' | 'uprawnienia';

export default function EditGroupPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const wstecz = useWstecz(`/grupy/${id}`);
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [state, setState] = useState<'loading' | 'ok' | 'denied' | 'notfound'>('loading');
  const [group, setGroup] = useState<Group | null>(null);
  const [perms, setPerms] = useState<GroupPermissions | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sport, setSport] = useState('');
  const [city, setCity] = useState('');
  const [fieldId, setFieldId] = useState<string | undefined>(undefined);
  const [fieldName, setFieldName] = useState<string | undefined>(undefined);
  const [venueOpen, setVenueOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [regenBusy, setRegenBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [settingsTab, setSettingsTab] = useState<UstawieniaTab>('ogolne');
  const [rozwinietyId, setRozwinietyId] = useState<string | null>(null);

  const inputCls =
    'w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-700 dark:text-slate-100';

  const load = useCallback(async () => {
    try {
      const g = await getGroup(id);
      if (!g) { setState('notfound'); return; }
      if (!user) { setState('denied'); return; }
      const p = await getMyGroupPermissions(id, user.id);
      // Ustawienia edytuje założyciel albo zarządzający (can_manage_members) —
      // ta sama granica, co polityka UPDATE na `groups` (migracja `092`).
      if (!p || (!p.isFounder && !p.canManageMembers)) { setState('denied'); return; }
      setGroup(g);
      setPerms(p);
      setName(g.name);
      setDescription(g.description ?? '');
      setSport(g.sport ?? '');
      setCity(g.city ?? '');
      setFieldId(g.fieldId);
      setFieldName(g.fieldName);
      if (p.isFounder) {
        getGroupMembers(id).then(setMembers).catch(() => {});
      }
      setState('ok');
    } catch {
      setState('notfound');
    }
  }, [id, user]);

  useEffect(() => { if (!authLoading) load(); }, [authLoading, load]);

  const handleSubmit = async () => {
    if (name.trim().length < 2) return;
    setSubmitting(true);
    try {
      await updateGroup(id, {
        name, description: description || undefined, sport: sport || undefined,
        city: city || undefined, fieldId, fieldName,
      });
      toast('Zapisano zmiany');
      router.push(`/grupy/${id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się zapisać', 'error');
      setSubmitting(false);
    }
  };

  const { potwierdz, oknoPotwierdzenia } = usePotwierdzenie();

  const handleRegen = async () => {
    if (await potwierdz({
      tytul: 'Wygenerować nowy link do ekipy?',
      konsekwencje: [
        'Stary link i kod przestaną działać — kto ma je zapisane, nie wejdzie.',
        'Kto już jest w ekipie, zostaje.',
        'Nowy link trzeba rozesłać jeszcze raz.',
      ],
      potwierdzLabel: 'Wygeneruj nowy',
      anulujLabel: 'Zostaw stary',
    }) !== 'tak') return;
    setRegenBusy(true);
    try {
      const kod = await regenerateJoinCode(id);
      setGroup((g) => (g ? { ...g, joinCode: kod } : g));
      toast('Nowy link gotowy');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
    } finally {
      setRegenBusy(false);
    }
  };

  const handleCopyLink = async () => {
    if (!group) return;
    try {
      await navigator.clipboard.writeText(linkDoGrupy(group.joinCode, user?.id));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const handleSetPerms = async (member: GroupMember, patch: Partial<{ canManageMembers: boolean; canCreateEvents: boolean; canModerateWall: boolean; canInvite: boolean }>) => {
    try {
      await setMemberPermissions(member.id, {
        canManageMembers: patch.canManageMembers ?? member.canManageMembers,
        canCreateEvents: patch.canCreateEvents ?? member.canCreateEvents,
        canModerateWall: patch.canModerateWall ?? member.canModerateWall,
        canInvite: patch.canInvite ?? member.canInvite,
      });
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, ...patch } : m)));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się zmienić uprawnień', 'error');
    }
  };

  const handleLeave = async () => {
    if (!user) return;
    if (await potwierdz({
      tytul: 'Opuścić ekipę?',
      konsekwencje: [
        'Stracisz dostęp do rozmowy ekipy i do jej prywatnych meczów.',
        'Twoje wpisy na tablicy i historia meczów zostają.',
        'Wrócisz przez link albo kod zaproszenia — jeśli go masz.',
      ],
      potwierdzLabel: 'Opuszczam ekipę',
      anulujLabel: 'Zostaję',
      wariant: 'destrukcyjny',
    }) !== 'tak') return;
    setBusy(true);
    try { await leaveGroup(id, user.id); toast('Opuściłeś ekipę'); router.push('/grupy'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Błąd', 'error'); setBusy(false); }
  };

  // NAJCIĘŻSZA DECYZJA NA TYM EKRANIE — i do 2026-09-03 pytało o nią systemowe
  // okno przeglądarki, czyli to samo, którym strona pyta o zgodę na wyskakujące
  // okienka. Cztery konsekwencje, których `confirm()` nie miał jak pokazać jedna
  // pod drugą, plus wariant destrukcyjny (czerwony przycisk).
  const handleDelete = async () => {
    if (!group) return;
    if (await potwierdz({
      tytul: `Usunąć ekipę ${group.name}?`,
      konsekwencje: [
        'Znika rozmowa ekipy, tablica, skład i statystyki.',
        'Rozegrane i nadchodzące mecze ZOSTAJĄ — przestają tylko być przypisane do ekipy.',
        'Członkowie stracą dostęp do prywatnych meczów tej ekipy.',
        'Tego nie da się cofnąć.',
      ],
      potwierdzLabel: 'Usuń ekipę',
      anulujLabel: 'Zostaw',
      wariant: 'destrukcyjny',
    }) !== 'tak') return;
    setBusy(true);
    try { await deleteGroup(id); toast('Ekipa usunięta'); router.push('/grupy'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Błąd', 'error'); setBusy(false); }
  };

  if (state === 'loading' || authLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header />
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
          <div className="h-40 animate-pulse rounded-2xl border border-slate-100 bg-white dark:border-slate-700 dark:bg-slate-800" />
        </main>
      </div>
    );
  }

  if (state === 'denied' || state === 'notfound') {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <Header />
        <main className="flex flex-1 items-center justify-center px-4 text-center">
          <div>
            <Lock className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="font-medium text-slate-700 dark:text-slate-300">
              {state === 'denied' ? 'Nie masz uprawnień do ustawień tej ekipy' : 'Nie znaleziono ekipy'}
            </p>
            <Link href={`/grupy/${id}`} className="mt-3 inline-block text-sm font-medium text-primary-700 hover:underline">
              Wróć do ekipy
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (!group || !perms) return null;
  const isOwner = perms.isFounder;

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header />
      <main className="mx-auto w-full max-w-lg flex-1 space-y-5 px-4 py-8">
        <button onClick={wstecz} className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Wróć
        </button>

        <h1 className="font-display text-2xl font-bold text-ink">Ustawienia ekipy</h1>

        {/* Zakładki — łatwiej trafić we właściwą sekcję niż przewijać jeden
            długi formularz. Stan czysto kliencki (bez URL-a, w odróżnieniu
            od zakładek na `/grupy/[id]`) — to podstrona ustawień, nie widok
            do udostępniania linkiem. */}
        <div className="border-b border-slate-100 dark:border-slate-700">
          <div className="flex gap-5 overflow-x-auto">
            {(
              [
                { value: 'ogolne', label: 'Ogólne' },
                // Zaproszenia dotyczą wyłącznie osób, które mogą zapraszać —
                // reszcie (np. wyłącznie can_manage_members) ten kod i link
                // nic nie dają.
                ...(isOwner || perms.canInvite ? [{ value: 'zaproszenia', label: 'Zaproszenia' } as const] : []),
                ...(isOwner ? [{ value: 'uprawnienia', label: 'Uprawnienia' } as const] : []),
              ] as { value: UstawieniaTab; label: string }[]
            ).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setSettingsTab(value)}
                className={`pb-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                  settingsTab === value
                    ? 'border-b-2 border-primary-700 font-semibold text-primary-700'
                    : 'text-slate-500 hover:text-ink dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {settingsTab === 'ogolne' && (
        <>
        {/* Podstawowe */}
        <div className="space-y-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Nazwa ekipy *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="np. Czwartkowa gierka" maxLength={60} className={inputCls} />
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Sport</span>
            <div className="flex flex-wrap gap-2">
              {FOCUS_SPORTS.map((s) => (
                <button
                  key={s} type="button" onClick={() => setSport(sport === s ? '' : s)}
                  className={[
                    'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                    sport === s ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800',
                  ].join(' ')}
                >
                  <span>{sportEmoji(s)}</span> {sportLabel(s)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Miasto / dzielnica</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="np. Mokotów" maxLength={60} className={inputCls} />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Boisko (opcjonalnie)</label>
            {fieldName ? (
              <div className="flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2.5 text-sm dark:bg-primary-950">
                <MapPin className="h-4 w-4 shrink-0 text-primary-600" />
                <span className="flex-1 truncate text-primary-800 dark:text-primary-200">{fieldName}</span>
                <button type="button" onClick={() => { setFieldId(undefined); setFieldName(undefined); }} className="text-slate-400 hover:text-red-500" aria-label="Usuń boisko">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button" onClick={() => setVenueOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" /> Przypisz boisko ekipy</span>
                {venueOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            )}
            {venueOpen && !fieldName && (
              <div className="mt-2 h-[320px] overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                <VenuePicker sport={sport || undefined} onSelect={(f) => { setFieldId(f.id); setFieldName(f.name); setVenueOpen(false); }} />
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Opis (opcjonalnie)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Kilka słów o ekipie…" rows={3} maxLength={300} className={inputCls} />
          </div>

          <Button onClick={handleSubmit} disabled={name.trim().length < 2 || submitting} className="inline-flex w-full items-center justify-center gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Zapisz zmiany'}
          </Button>
        </div>

        {/* Okładka */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-3 text-sm font-semibold text-ink">Okładka</h2>
          <div className="relative h-28 overflow-hidden rounded-xl bg-gradient-to-br from-primary-700 to-primary-900">
            {group.coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={group.coverImageUrl} alt="" className="h-full w-full object-cover" />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <CoverUpload
                currentUrl={group.coverImageUrl}
                path={`groups/${group.id}/cover`}
                onSaved={async (url) => {
                  try {
                    await setGroupCover(group.id, url ?? null);
                    setGroup((g) => (g ? { ...g, coverImageUrl: url ?? undefined } : g));
                  } catch { toast('Nie udało się zapisać okładki', 'error'); }
                }}
              />
            </div>
          </div>
        </div>

        {/* Strefa niebezpieczna */}
        <div className="flex justify-center pb-2 pt-2">
          {isOwner ? (
            <button onClick={handleDelete} disabled={busy} className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-red-600">
              <Trash2 className="h-3.5 w-3.5" /> Usuń ekipę
            </button>
          ) : (
            <button onClick={handleLeave} disabled={busy} className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-red-600">
              <LogOut className="h-3.5 w-3.5" /> Opuść ekipę
            </button>
          )}
        </div>
        </>
        )}

        {settingsTab === 'zaproszenia' && (isOwner || perms.canInvite) && (
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-3 text-sm font-semibold text-ink">Zaproszenia</h2>
          <div className="flex items-center gap-2">
            <input readOnly value={linkDoGrupy(group.joinCode, user?.id)} className={`${inputCls} font-mono text-xs`} />
            <button onClick={handleCopyLink} className="shrink-0 rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300" aria-label="Kopiuj link">
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            lub podaj kod: <span className="font-mono font-bold tracking-widest text-primary-700">{group.joinCode}</span>
          </p>
          <button
            onClick={handleRegen} disabled={regenBusy}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary-700 disabled:opacity-50"
          >
            {regenBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Wygeneruj nowy link
          </button>
        </div>
        )}

        {/* Uprawnienia — tylko założyciel (zgodnie z RLS na group_members).
            Akordeon zamiast zawsze rozwiniętej listy: przy większej ekipie
            cztery przełączniki na każdego z dwunastu ludzi to ekran, który
            trzeba przewijać, żeby znaleźć jedną osobę. */}
        {settingsTab === 'uprawnienia' && isOwner && (
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-1 text-sm font-semibold text-ink">Uprawnienia</h2>
            <p className="mb-3 text-xs text-slate-500">Komu ufasz na tyle, żeby pomógł prowadzić ekipę.</p>
            <ul className="divide-y divide-slate-50 dark:divide-slate-700">
              {members.filter((m) => m.userId !== group.createdBy).map((m) => {
                const p = uprawnieniaCzlonka(group, m);
                const rozwiniety = rozwinietyId === m.id;
                return (
                  <li key={m.id}>
                    <button
                      onClick={() => setRozwinietyId(rozwiniety ? null : m.id)}
                      aria-expanded={rozwiniety}
                      className="flex w-full items-center justify-between py-3 text-left"
                    >
                      <span className="text-sm font-medium text-ink">{m.name}</span>
                      {rozwiniety ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                    </button>
                    {rozwiniety && (
                      <div className="pb-2">
                        <UprawnieniaCzlonkaPanel perms={p} onChange={(patch) => handleSetPerms(m, patch)} />
                      </div>
                    )}
                  </li>
                );
              })}
              {members.filter((m) => m.userId !== group.createdBy).length === 0 && (
                <p className="py-3 text-sm text-slate-400">Ekipa ma na razie tylko Ciebie.</p>
              )}
            </ul>
          </div>
        )}
      </main>
      {oknoPotwierdzenia}
    </div>
  );
}
