'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import PhoneShell from './PhoneShell';
import { MockMyGames, MockWizard, MockMatchPage } from './mockScreens';

const SCREENS = [
  { id: 'moje',    label: 'Twoje mecze',     Screen: MockMyGames },
  { id: 'kreator', label: 'Tworzenie meczu', Screen: MockWizard },
  { id: 'mecz',    label: 'Strona meczu',    Screen: MockMatchPage },
] as const;

const AUTO_ADVANCE_MS = 4000;

/**
 * Podgląd aplikacji w hero landingu: trzy pełne ekrany do przewinięcia palcem.
 *
 * Poprzednia wersja pokazywała jeden ekran, i to niepełny — ramka nie miała
 * zadanej wysokości, więc brała ją z treści, a treści była jedna karta.
 * Teraz proporcje trzyma PhoneShell (`aspect-[9/19]`), a tor przewijania stoi
 * na natywnym scroll-snapie: zero zależności, gest kciukiem działa dokładnie
 * tak, jak człowiek się spodziewa, i strona nadal renderuje się bez JS —
 * bez JS zostaje po prostu przewijalny w bok pasek.
 *
 * Auto-przewijanie kończy się na zawsze przy pierwszym dotknięciu: karuzela,
 * która przeskakuje pod palcem w trakcie oglądania, jest gorsza niż statyczna.
 */
export default function PhoneCarousel({ className = '' }: { className?: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);

  // Auto-przewijanie startuje dopiero po montażu i tylko, gdy użytkownik nie
  // poprosił systemowo o mniej ruchu.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setAutoPlay(true);
  }, []);

  const scrollTo = useCallback((i: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  }, []);

  // Aktywny slajd czytamy z pozycji przewinięcia — źródłem prawdy jest DOM,
  // nie stan Reacta, więc gest palcem i klik w kropkę nie mogą się rozjechać.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!el.clientWidth) return;
        setIndex(Math.round(el.scrollLeft / el.clientWidth));
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); };
  }, []);

  useEffect(() => {
    if (!autoPlay) return;
    const t = setInterval(() => {
      const el = trackRef.current;
      if (!el || !el.clientWidth) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % SCREENS.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(t);
  }, [autoPlay]);

  const stopAuto = () => setAutoPlay(false);

  return (
    <div
      className={className}
      role="group"
      aria-roledescription="karuzela"
      aria-label="Podgląd aplikacji Bojo"
    >
      <div
        ref={trackRef}
        onPointerDown={stopAuto}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {SCREENS.map(({ id, label, Screen }, i) => (
          <div
            key={id}
            className="w-full shrink-0 snap-center"
            role="group"
            aria-label={`Ekran ${i + 1} z ${SCREENS.length}: ${label}`}
          >
            <PhoneShell>
              {/* Treść makiety to atrapy tekstu, nie informacja — czytnik ekranu
                  dostaje sam opis slajdu wyżej. */}
              <div aria-hidden="true" className="h-full">
                <Screen />
              </div>
            </PhoneShell>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        {SCREENS.map(({ id, label }, i) => (
          <button
            key={id}
            type="button"
            onClick={() => { stopAuto(); scrollTo(i); }}
            aria-label={`Pokaż ekran: ${label}`}
            aria-current={i === index}
            className={[
              'h-2 rounded-full transition-all',
              i === index ? 'w-6 bg-white' : 'w-2 bg-white/40 hover:bg-white/70',
            ].join(' ')}
          />
        ))}
      </div>
    </div>
  );
}
