'use client';

import { useEffect, useState } from 'react';
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
  // wizyta nie powinna liczyć się jako „widziałem listę". Stara wartość jest
  // odczytana PRZED nadpisaniem i przekazana niżej — bez tego lista nie miałaby
  // jak wiedzieć, które konkretnie karty pokazać jako nowe (kropka na
  // „Znajdź grę" gasłaby, ale nikt by nie wiedział, którego wydarzenia dotyczyła).
  const [widzianoWczesniej, setWidzianoWczesniej] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    setWidzianoWczesniej(window.localStorage.getItem(KLUCZ_WYDARZENIA_WIDZIANO));
    window.localStorage.setItem(KLUCZ_WYDARZENIA_WIDZIANO, new Date().toISOString());
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Header hideMobileBarForUser />
      <main className="flex-1">
        <EventsListView widzianoWczesniej={widzianoWczesniej} />
      </main>
    </div>
  );
}
