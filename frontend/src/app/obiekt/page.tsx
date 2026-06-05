'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Building2, MapPin, Lock } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useAuth, displayName } from '@/lib/auth';
import { getFields } from '@/lib/api';
import type { Field } from '@/types';
import { sportEmoji } from '@/lib/sports';


export default function MyVenuesPage() {
  const { user, loading: authLoading } = useAuth();
  const [venues, setVenues] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }

    getFields({ managerId: user.id })
      .then(({ fields }) => setVenues(fields))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authLoading, user]);

  if (authLoading || (loading && user)) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-9 w-32 bg-gray-200 rounded-lg animate-pulse" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />
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
              Potrzebujesz konta, aby zarządzać obiektami sportowymi.
            </p>
            <Button onClick={() => { window.location.href = `/logowanie?next=${encodeURIComponent(window.location.pathname)}`; }}>Zaloguj się</Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Moje obiekty</h1>
            <p className="text-sm text-gray-500 mt-0.5">{displayName(user)}</p>
          </div>
          <Link href="/obiekt/nowe">
            <Button className="flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Dodaj obiekt
            </Button>
          </Link>
        </div>

        {venues.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium text-gray-700">
              Nie zarządzasz jeszcze żadnym obiektem
            </p>
            <p className="text-sm mt-1 mb-6">
              Dodaj swoje boisko lub halę i zacznij przyjmować rezerwacje.
            </p>
            <Link href="/obiekt/nowe">
              <Button>Dodaj pierwszy obiekt</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {venues.map((venue) => (
              <Link key={venue.id} href={`/obiekt/${venue.id}`}>
                <Card className="hover:shadow-md transition-shadow" padding="md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900 truncate">{venue.name}</p>
                        {venue.isBookable && (
                          <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700 border border-primary-200">
                            Rezerwacje
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-1 truncate">
                        <MapPin className="w-3.5 h-3.5 shrink-0" /> {venue.address}
                      </p>
                    </div>
                    <span className="text-xs text-primary-600 font-medium shrink-0 mt-0.5">
                      Zarządzaj →
                    </span>
                  </div>
                  {venue.sport.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mt-3 pt-3 border-t border-gray-100">
                      {venue.sport.map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium"
                        >
                          {sportEmoji(s)} {s}
                        </span>
                      ))}
                    </div>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
