'use client';
// Hooki adresów z nazwą (177): osobny plik, bo `lib/adresy.ts` czytają też
// komponenty serwerowe (adres kanoniczny), a tam hooków być nie może.
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { pobierzAdres, podmienSegmenty, UUID_W_ADRESIE, type RodzajAdresu } from './adresy';

/** Adres z nazwą do linku: slug, gdy jest, inaczej uuid. */
export function useAdres(rodzaj: RodzajAdresu, id: string | undefined): string | undefined {
  const [adres, setAdres] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!id || !UUID_W_ADRESIE.test(id)) return;
    let aktualne = true;
    void pobierzAdres(rodzaj, id).then((s) => { if (aktualne && s) setAdres(s); });
    return () => { aktualne = false; };
  }, [rodzaj, id]);
  return adres ?? id;
}

/**
 * Pasek przeglądarki pokazuje adres z nazwą, nawet gdy weszło się przez uuid
 * (link z powiadomienia, stary link z czatu). `replaceState`, nie nawigacja:
 * nic się nie przeładowuje i „wstecz” nie dostaje dodatkowego wpisu.
 */
export function useAdresWPasku(zamiany: Record<string, string | undefined>): void {
  const klucz = JSON.stringify(zamiany);
  // Także po każdej nawigacji wewnątrz turnieju/meczu: `router.push` z uuid
  // (zakładki, panel) wracał w pasku do uuid.
  const sciezka = usePathname();
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const czyste: Record<string, string> = {};
    for (const [z, na] of Object.entries(zamiany)) if (na && z !== na) czyste[z] = na;
    if (Object.keys(czyste).length === 0) return;
    const { pathname, search, hash } = window.location;
    const nowa = podmienSegmenty(pathname, czyste);
    if (nowa !== pathname) window.history.replaceState(null, '', nowa + search + hash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [klucz, sciezka]);
}
