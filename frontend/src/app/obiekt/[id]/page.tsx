'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, DollarSign, CalendarCheck, MapPin, Lock, ExternalLink } from 'lucide-react';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import { useAuth } from '@/lib/auth';
import { getField } from '@/lib/api';
import type { Field } from '@/types';
import { sportEmoji } from '@/lib/sports';


export default function VenueDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [field, setField] = useState<Field | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }

    getField(id)
      .then(setField)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [authLoading, user, id]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Header />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
          <div className="h-8 w-56 bg-slate-200 rounded-lg animate-pulse mb-2" />
          <div className="h-4 w-40 bg-slate-100 rounded animate-pulse mb-8" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 bg-slate-100 rounded-2xl animate-pulse" />
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
            <Lock className="w-10 h-10 mx-auto mb-4 text-slate-300" />
            <p className="font-medium text-slate-700">Zaloguj się, aby zarządzać obiektem.</p>
          </div>
        </main>
      </div>
    );
  }

  if (notFound || !field) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <Lock className="w-10 h-10 mx-auto mb-4 text-slate-300" />
            <p className="font-medium text-slate-700">Nie znaleziono obiektu.</p>
            <Link href="/obiekt" className="text-primary-600 text-sm underline mt-3 inline-block">
              Wróć do listy
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (field.managerId !== user.id) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <Lock className="w-10 h-10 mx-auto mb-4 text-slate-300" />
            <p className="font-medium text-slate-700">Brak dostępu</p>
            <p className="text-sm text-slate-500 mt-1">Nie jesteś menedżerem tego obiektu.</p>
            <Link href="/obiekt" className="text-primary-600 text-sm underline mt-3 inline-block">
              Wróć do listy
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const actions = [
    {
      href: `/obiekt/${id}/harmonogram`,
      icon: Calendar,
      label: 'Harmonogram',
      desc: 'Ustaw godziny otwarcia i długość slotów',
    },
    {
      href: `/obiekt/${id}/cennik`,
      icon: DollarSign,
      label: 'Cennik',
      desc: 'Ustal ceny w zależności od pory dnia i dnia tygodnia',
    },
    {
      href: `/obiekt/${id}/rezerwacje`,
      icon: CalendarCheck,
      label: 'Rezerwacje',
      desc: 'Potwierdzaj i zarządzaj rezerwacjami',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/obiekt"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 truncate">{field.name}</h1>
            <p className="text-sm text-slate-500 flex items-center gap-1 truncate">
              <MapPin className="w-3.5 h-3.5 shrink-0" /> {field.address}
            </p>
          </div>
        </div>

        {field.sport.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-4">
            {field.sport.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600 text-xs font-medium"
              >
                {sportEmoji(s)} {s}
              </span>
            ))}
          </div>
        )}

        <Link
          href={`/boisko/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium mb-8"
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Widok publiczny →
        </Link>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {actions.map(({ href, icon: Icon, label, desc }) => (
            <Link key={href} href={href}>
              <Card
                className="h-full hover:shadow-md hover:border-primary-200 transition-all group"
                padding="lg"
              >
                <div className="flex flex-col h-full">
                  <div className="p-2.5 bg-primary-50 rounded-xl w-fit mb-4 group-hover:bg-primary-100 transition-colors">
                    <Icon className="w-5 h-5 text-primary-600" />
                  </div>
                  <p className="font-semibold text-slate-900 mb-1">{label}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
