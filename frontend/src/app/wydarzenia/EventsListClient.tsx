'use client';

import { useEffect } from 'react';
import Header from '@/components/layout/Header';
import EventsListView from './EventsListView';
import { KLUCZ_WYDARZENIA_WIDZIANO } from '@/lib/events';

/** Strona /wydarzenia = nagłówek + widok listy.
 *
 *  Sama lista siedzi w EventsListView, bo służy też za tło ekranu logowania
 *  (components/auth/LoginBackdrop.tsx) — a tam własny <Header/> dałby dwa paski. */
export default function EventsListClient() {
  // Wejście tutaj gasi pomarańczową kropkę „nowe wydarzenia w pobliżu" na
  // „Znajdź grę" (BottomNav.tsx). Tylko ta strona, nie EventsListView —
  // tamten komponent renderuje się też jako tło ekranu logowania, gdzie
  // wizyta nie powinna liczyć się jako „widziałem listę".
  useEffect(() => {
    window.localStorage.setItem(KLUCZ_WYDARZENIA_WIDZIANO, new Date().toISOString());
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header hideMobileBarForUser />
      <main className="flex-1">
        <EventsListView />
      </main>
    </div>
  );
}
