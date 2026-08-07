'use client';

import Header from '@/components/layout/Header';
import EventsListView from './EventsListView';

/** Strona /wydarzenia = nagłówek + widok listy.
 *
 *  Sama lista siedzi w EventsListView, bo służy też za tło ekranu logowania
 *  (components/auth/LoginBackdrop.tsx) — a tam własny <Header/> dałby dwa paski. */
export default function EventsListClient() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header hideMobileBarForUser />
      <main className="flex-1">
        <EventsListView />
      </main>
    </div>
  );
}
