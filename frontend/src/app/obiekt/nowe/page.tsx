'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Lock } from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { createManagedField } from '@/lib/api';

const SPORTS = [
  'piłka nożna',
  'futsal',
  'koszykówka',
  'siatkówka',
  'siatkówka plażowa',
  'piłka ręczna',
] as const;

const SURFACES = [
  { value: '', label: '— wybierz —' },
  { value: 'grass', label: 'Trawa' },
  { value: 'artificial', label: 'Sztuczna' },
  { value: 'concrete', label: 'Beton' },
  { value: 'sand', label: 'Piasek' },
  { value: 'indoor', label: 'Hala' },
] as const;

const inputCls =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';

export default function NewVenuePage() {
  const router = useRouter();
  const { user, loading: authLoading, signInWithGoogle } = useAuth();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [sport, setSport] = useState<string[]>([]);
  const [surface, setSurface] = useState('');
  const [isIndoor, setIsIndoor] = useState(false);
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSport = (s: string) => {
    setSport((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
          <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse mb-6" />
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <Lock className="w-10 h-10 mx-auto mb-4 text-gray-300" />
            <h1 className="text-xl font-bold text-gray-900">Zaloguj się</h1>
            <p className="text-gray-500 text-sm mt-2 mb-6">
              Musisz być zalogowany, aby dodać obiekt.
            </p>
            <Button onClick={() => signInWithGoogle()}>Zaloguj się przez Google</Button>
          </div>
        </main>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);

    if (!name.trim()) { setError('Podaj nazwę obiektu.'); return; }
    if (!address.trim()) { setError('Podaj adres.'); return; }
    if (lat && (isNaN(latNum) || latNum < -90 || latNum > 90)) {
      setError('Szerokość geograficzna musi być w zakresie -90 do 90.'); return;
    }
    if (lng && (isNaN(lngNum) || lngNum < -180 || lngNum > 180)) {
      setError('Długość geograficzna musi być w zakresie -180 do 180.'); return;
    }
    if (sport.length === 0) { setError('Wybierz co najmniej jeden sport.'); return; }

    setSubmitting(true);
    setError(null);
    try {
      const id = await createManagedField(
        {
          name: name.trim(),
          address: address.trim(),
          lat: lat ? latNum : 0,
          lng: lng ? lngNum : 0,
          sport,
          surface,
          isIndoor,
          isBookable: true,
          available: true,
          phone: phone.trim() || undefined,
          website: website.trim() || undefined,
        },
        user.id,
      );
      router.push(`/obiekt/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się dodać obiektu.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/obiekt"
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Nowy obiekt</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nazwa obiektu <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="np. Orlik Mokotów"
                className={inputCls}
                maxLength={120}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adres <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="ul. Sportowa 1, Warszawa"
                className={inputCls}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Współrzędne geograficzne
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Szerokość (lat)</label>
                  <input
                    type="number"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    placeholder="52.2297"
                    step="any"
                    min={-90}
                    max={90}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Długość (lng)</label>
                  <input
                    type="number"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    placeholder="21.0122"
                    step="any"
                    min={-180}
                    max={180}
                    className={inputCls}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                Otwórz Google Maps, kliknij prawym przyciskiem na swoje boisko i skopiuj współrzędne.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sporty <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {SPORTS.map((s) => (
                  <label key={s} className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={sport.includes(s)}
                      onChange={() => toggleSport(s)}
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">{s}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nawierzchnia</label>
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

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isIndoor}
                onChange={(e) => setIsIndoor(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">Kryty obiekt</span>
            </label>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefon kontaktowy{' '}
                <span className="text-gray-400 font-normal">(opcjonalnie)</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+48 123 456 789"
                className={inputCls}
                maxLength={30}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Strona www{' '}
                <span className="text-gray-400 font-normal">(opcjonalnie)</span>
              </label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://"
                className={inputCls}
                maxLength={200}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <Link href="/obiekt" className="flex-1">
              <Button type="button" variant="outline" size="lg" className="w-full">
                Anuluj
              </Button>
            </Link>
            <Button type="submit" size="lg" isLoading={submitting} className="flex-1">
              Dodaj obiekt
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
