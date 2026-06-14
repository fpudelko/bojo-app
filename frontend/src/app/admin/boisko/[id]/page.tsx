'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Lock, Eye, EyeOff, Trash2 } from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { useAdmin } from '@/lib/admin';
import { updateField } from '@/lib/api';
import { supabase } from '@/lib/supabase';

const SPORTS = [
  'piłka nożna',
  'futsal',
  'koszykówka',
  'siatkówka',
  'siatkówka plażowa',
  'piłka ręczna',
] as const;

const SURFACES = [
  { value: '', label: '— nieznana —' },
  { value: 'grass', label: 'Trawa naturalna' },
  { value: 'artificial', label: 'Trawa sztuczna' },
  { value: 'concrete', label: 'Beton / asfalt' },
  { value: 'sand', label: 'Piasek' },
  { value: 'indoor', label: 'Hala / parkiet' },
] as const;

const inputCls =
  'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';

export default function AdminVenueEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const isAdmin = useAdmin();

  const [pageLoading, setPageLoading] = useState(true);
  const [notAllowed, setNotAllowed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [sport, setSport] = useState<string[]>([]);
  const [available, setAvailable] = useState(true);
  const [surface, setSurface] = useState('');
  const [isIndoor, setIsIndoor] = useState(false);
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [contactVisible, setContactVisible] = useState(false);
  const [mapVisibility, setMapVisibility] = useState<'public' | 'hidden' | 'organizer_only'>('organizer_only');
  const [visibilityBusy, setVisibilityBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setNotAllowed(true); setPageLoading(false); return; }
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;

    (async () => {
      const { data: f, error } = await supabase
        .from('fields')
        .select('*')
        .eq('id', id)
        .single();
      if (error || !f) {
        setNotAllowed(true);
      } else {
        setName(f.name);
        setAddress(f.address);
        setSport(f.sport ?? []);
        setAvailable(f.available);
        setSurface(f.surface ?? '');
        setIsIndoor(f.is_indoor ?? false);
        setPhone(f.phone ?? '');
        setWebsite(f.website ?? '');
        setContactVisible(f.contact_visible ?? false);
        setMapVisibility(f.map_visibility ?? 'organizer_only');
      }
      setPageLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const toggleSport = (s: string) => {
    setSport((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  };

  const handleToggleVisibility = async () => {
    if (!isAdmin) return;
    const next = mapVisibility === 'public' ? 'hidden' : 'public';
    const nextModeration = next === 'public' ? 'approved' : 'hidden';
    setVisibilityBusy(true);
    try {
      await supabase.from('fields').update({
        map_visibility: next,
        moderation_status: nextModeration,
      }).eq('id', id);
      setMapVisibility(next);
    } finally { setVisibilityBusy(false); }
  };

  const handleDelete = async () => {
    if (!isAdmin || !deleteConfirm) return;
    setDeleteBusy(true);
    try {
      await supabase.from('fields').delete().eq('id', id);
      router.push('/admin/moderacja');
    } finally { setDeleteBusy(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setSubmitting(true);
    setError(null);
    try {
      await updateField(id, {
        name,
        address,
        sport,
        available,
        surface,
        isIndoor,
        phone: phone.trim() || undefined,
        website: website.trim() || undefined,
        contactVisible,
      });
      router.push('/mapa');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać zmian');
      setSubmitting(false);
    }
  };

  if (pageLoading || authLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
          <div className="h-8 w-40 bg-slate-100 rounded-lg animate-pulse mb-6" />
          <div className="space-y-4">
            <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
            <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
            <div className="h-24 bg-slate-100 rounded-xl animate-pulse" />
            <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
          </div>
        </main>
      </div>
    );
  }

  if (notAllowed || !isAdmin) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 text-center text-slate-500">
          <div>
            <Lock className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="font-medium text-slate-700">Brak dostępu</p>
            <p className="text-sm mt-1">Ta strona jest dostępna tylko dla administratorów.</p>
            <Link href="/mapa" className="text-primary-600 text-sm underline mt-4 inline-block">
              Wróć do mapy
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/mapa" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Edytuj boisko</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                required
                maxLength={120}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Adres</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={inputCls}
                required
                maxLength={200}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Sporty</label>
              <div className="grid grid-cols-2 gap-2">
                {SPORTS.map((s) => (
                  <label
                    key={s}
                    className="flex items-center gap-2 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={sport.includes(s)}
                      onChange={() => toggleSport(s)}
                      className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-slate-700">{s}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nawierzchnia</label>
              <select
                value={surface}
                onChange={(e) => setSurface(e.target.value)}
                className={inputCls}
              >
                {SURFACES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isIndoor}
                  onChange={(e) => setIsIndoor(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-slate-700">Hala (zadaszony obiekt)</span>
              </label>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={available}
                  onChange={(e) => setAvailable(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-slate-700">Dostępne do rezerwacji</span>
              </label>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-0.5">Dane kontaktowe</p>
              <p className="text-xs text-slate-400 mb-4">
                Telefon i e-mail ze scrapera OSM są domyślnie ukryte. Zaznacz poniżej, żeby udostępnić je użytkownikom.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Telefon (tylko dla admina)</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+48 123 456 789"
                    className={inputCls}
                    maxLength={30}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Strona www</label>
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://"
                    className={inputCls}
                    maxLength={200}
                  />
                </div>

                <label className="flex items-start gap-3 cursor-pointer select-none rounded-xl border border-slate-200 p-3 hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={contactVisible}
                    onChange={(e) => setContactVisible(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-800">Pokaż dane kontaktowe użytkownikom</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Gdy zaznaczone, telefon i e-mail będą widoczne na stronie boiska.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-sm font-medium text-slate-700 mb-2">Panel rezerwacji</p>
            <Link
              href={`/admin/${id}`}
              className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
            >
              → Panel rezerwacji
            </Link>
          </div>

          {/* ── Admin: widoczność + usuwanie ── */}
          {isAdmin && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
              <p className="text-sm font-semibold text-slate-700">Widoczność na mapie</p>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  {mapVisibility === 'public'
                    ? <Eye className="h-5 w-5 text-primary-600" />
                    : <EyeOff className="h-5 w-5 text-slate-400" />}
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {mapVisibility === 'public' ? 'Widoczny publicznie' : 'Ukryty'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {mapVisibility === 'public'
                        ? 'Obiekt pojawia się na mapie dla wszystkich'
                        : 'Obiekt nie jest widoczny na mapie'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleVisibility}
                  disabled={visibilityBusy}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                    mapVisibility === 'public'
                      ? 'bg-slate-200 text-slate-600 hover:bg-red-100 hover:text-red-700'
                      : 'bg-primary-50 text-primary-700 hover:bg-primary-100'
                  }`}
                >
                  {visibilityBusy ? '…' : mapVisibility === 'public' ? 'Ukryj' : 'Upublicznij'}
                </button>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="text-sm font-semibold text-red-600 mb-2">Strefa niebezpieczna</p>
                {!deleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" /> Usuń obiekt
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-red-600 font-medium">Na pewno? Tej operacji nie można cofnąć.</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleteBusy}
                        className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 transition-colors"
                      >
                        {deleteBusy ? 'Usuwanie…' : 'Tak, usuń'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(false)}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        Anuluj
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Link href="/mapa" className="flex-1">
              <Button type="button" variant="outline" size="lg" className="w-full">
                Anuluj
              </Button>
            </Link>
            <Button type="submit" size="lg" isLoading={submitting} className="flex-1">
              Zapisz zmiany
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
