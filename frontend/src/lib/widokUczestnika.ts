'use client';
// PRZEŁĄCZNIK „Organizator / Uczestnik” (2026-11-22, prośba właściciela).
// Organizator widzi stronę turnieju i meczu z przyciskami zarządzania; żeby
// sprawdzić, co widzi zawodnik albo kibic, przełącza się na widok uczestnika.
// To wygoda jednej osoby na jednym urządzeniu, więc `localStorage`, nie baza;
// zdarzenie `storage` / własne synchronizuje otwarte karty. Widok uczestnika
// niczego nie odbiera naprawdę: to tylko ukrycie przycisków, RLS bez zmian.
import { useCallback, useEffect, useState } from 'react';

const KLUCZ = 'bojo-widok-uczestnika';
const ZDARZENIE = 'bojo-widok-uczestnika';

function czytaj(): boolean {
  try { return window.localStorage.getItem(KLUCZ) === '1'; } catch { return false; }
}

export function useWidokUczestnika(): [boolean, (jakoUczestnik: boolean) => void] {
  const [jakoUczestnik, setJakoUczestnik] = useState(false);
  useEffect(() => {
    setJakoUczestnik(czytaj());
    const odswiez = () => setJakoUczestnik(czytaj());
    window.addEventListener('storage', odswiez);
    window.addEventListener(ZDARZENIE, odswiez);
    return () => { window.removeEventListener('storage', odswiez); window.removeEventListener(ZDARZENIE, odswiez); };
  }, []);
  const ustaw = useCallback((w: boolean) => {
    try { if (w) window.localStorage.setItem(KLUCZ, '1'); else window.localStorage.removeItem(KLUCZ); } catch { /* bez pamięci */ }
    setJakoUczestnik(w);
    window.dispatchEvent(new Event(ZDARZENIE));
  }, []);
  return [jakoUczestnik, ustaw];
}
