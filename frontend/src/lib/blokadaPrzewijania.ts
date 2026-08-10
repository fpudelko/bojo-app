'use client';

import { useEffect } from 'react';

/**
 * Blokuje przewijanie strony pod otwartym modalem.
 *
 * Bez tego palec przesuwający się po zaciemnieniu przewijał treść POD oknem:
 * na telefonie wyglądało to jak zepsute okno, bo przycisk potwierdzenia
 * uciekał, a ruch działał na czymś innym niż to, co widać.
 *
 * `position: fixed` zamiast samego `overflow: hidden`: iOS Safari ignoruje
 * `overflow` na <body> i przewija mimo wszystko. Zapamiętujemy pozycję i po
 * zamknięciu wracamy w to samo miejsce — inaczej każde okno przerzucałoby
 * użytkownika na górę strony.
 */
export function useBlokadaPrzewijania(zablokowane: boolean): void {
  useEffect(() => {
    if (!zablokowane) return;
    const y = window.scrollY;
    const b = document.body.style;
    const poprzednie = { position: b.position, top: b.top, width: b.width };

    b.position = 'fixed';
    b.top = `-${y}px`;
    b.width = '100%';

    return () => {
      b.position = poprzednie.position;
      b.top = poprzednie.top;
      b.width = poprzednie.width;
      window.scrollTo(0, y);
    };
  }, [zablokowane]);
}
