'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Wrench } from 'lucide-react';
import Header from '@/components/layout/Header';

export default function EditRecurringEventPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <Wrench className="w-10 h-10 mx-auto mb-4 text-gray-300" />
          <h1 className="text-xl font-bold text-gray-900">Edycja szablonu</h1>
          <p className="text-gray-500 text-sm mt-2 mb-6">
            Ta funkcja jest jeszcze w przygotowaniu.
          </p>
          <Link
            href={`/cykliczne/${id}`}
            className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Wróć do cyklicznego
          </Link>
        </div>
      </main>
    </div>
  );
}
