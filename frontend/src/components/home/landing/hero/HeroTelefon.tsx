'use client';

import { useEffect, useRef } from 'react';
import './hero.css';
import { LANDING_ANIMACJA } from '../content';
import { datyHero } from '@/lib/datyHero';
import { SPRITE_IKON, ekranyHtml } from './heroEkrany';
import { uruchomHero, type InterfejsHero, type SilnikHero } from './heroSilnik';
import { ustawStanHero } from './heroStan';

const ROZDZIALY = LANDING_ANIMACJA.rozdzialy;
const SZEROKOSC_TELEFONU = 376;

/**
 * Telefon z animacją, podpis pod nim i pięć pasków rozdziałów.
 *
 * Serwer renderuje tylko pustą ramkę (miejsce zarezerwowane w CSS, patrz
 * `.ha-slot` w hero.css), podpis pierwszego rozdziału i paski: to wystarcza,
 * żeby układ się nie przesunął, a makieta jest ozdobą (aria-hidden), więc
 * wyszukiwarka nic przez to nie traci. Ekrany, daty (od dziś w Polsce) i silnik
 * powstają dopiero po zamontowaniu, żeby HTML z serwera i pierwszy render
 * klienta były identyczne.
 *
 * Paski oznaczają ROZDZIAŁY, nie sceny (patrz `LANDING_ANIMACJA`), więc
 * dołożenie sceny nie zmienia ich liczby.
 */
export default function HeroTelefon({ className = '' }: { className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const podpisRef = useRef<HTMLDivElement>(null);
  const nazwaRef = useRef<HTMLDivElement>(null);
  const paskiRef = useRef<(HTMLButtonElement | null)[]>([]);
  const silnikRef = useRef<SilnikHero | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const ekran = root?.querySelector<HTMLElement>('.screen');
    if (!root || !ekran) return;

    ekran.innerHTML = SPRITE_IKON + ekranyHtml(datyHero());

    // Skala wynika z szerokości slotu (CSS), więc jest jedna prawda o rozmiarze.
    const ustawSkale = () => {
      root.style.setProperty('--s', Math.max(0.4, root.clientWidth / SZEROKOSC_TELEFONU).toFixed(4));
    };
    ustawSkale();
    root.dataset.gotowy = '1';
    const ro = new ResizeObserver(ustawSkale);
    ro.observe(root);

    const ograniczonyRuch = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ustawStanHero({ rozdzial: 0, staly: ograniczonyRuch });

    const timery = new Set<number>();
    const zamien = (e: HTMLElement | null, tekst: string, natychmiast: boolean) => {
      if (!e) return;
      if (natychmiast) { e.textContent = tekst; return; }
      if (e.textContent === tekst) return;
      e.classList.add('opacity-0');
      const t = window.setTimeout(() => {
        e.textContent = tekst; e.classList.remove('opacity-0'); timery.delete(t);
      }, 200);
      timery.add(t);
    };

    const ui: InterfejsHero = {
      podpis: (tekst, natychmiast) => zamien(podpisRef.current, tekst, natychmiast),
      rozdzial: (i, natychmiast) => {
        zamien(nazwaRef.current, ROZDZIALY[i].nazwa, natychmiast);
        ustawStanHero({ rozdzial: i });
      },
      paski: (aktualny, procent) => {
        paskiRef.current.forEach((b, k) => {
          const pasek = b?.firstElementChild as HTMLElement | null;
          const wypelnienie = pasek?.firstElementChild as HTMLElement | null;
          if (!b || !pasek || !wypelnienie) return;
          pasek.style.width = k === aktualny ? '40px' : '20px';
          pasek.style.background = k < aktualny ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.35)';
          wypelnienie.style.width = k === aktualny ? `${procent}%` : '0';
          if (k === aktualny) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
        });
      },
    };

    const silnik = uruchomHero({ root, daty: datyHero(), ui, ograniczonyRuch });
    silnikRef.current = silnik;

    return () => {
      silnik.zatrzymaj();
      silnikRef.current = null;
      ro.disconnect();
      timery.forEach((t) => window.clearTimeout(t));
      ustawStanHero({ rozdzial: 0, staly: false });
      delete root.dataset.gotowy;
      ekran.innerHTML = '';
    };
  }, []);

  return (
    // `data-zrzut-maskuj`: telefon, podpis i paski zmieniają się w czasie
    // rzeczywistym (silnik JS, nie animacja CSS, której `uspokoj()` w
    // `wizualne.spec.ts` by nie wyciszył), więc zrzut całej strony łapałby
    // losową klatkę i test migałby. Układ kolumny dalej widać (maska jest
    // prostokątem tego samego rozmiaru); ruch pilnuje
    // `hero-animacja.klikalnosc.spec.ts`.
    <div data-zrzut-maskuj className={`flex flex-col items-center ${className}`}>
      <div ref={rootRef} className="ha ha-slot" aria-hidden="true">
        <div className="phone"><div className="screen" /></div>
      </div>

      {/* Nazwa rozdziału pod telefonem: tylko na telefonie (na komputerze niesie ją plakietka). */}
      <div
        ref={nazwaRef}
        aria-hidden="true"
        className="mt-3 h-4 text-xs font-semibold leading-4 text-white/60 transition-opacity duration-200 motion-reduce:transition-none md:hidden"
      >
        {ROZDZIALY[0].nazwa}
      </div>
      <div
        ref={podpisRef}
        aria-live="off"
        className="mt-1 h-5 w-full max-w-[340px] truncate text-center text-sm leading-5 text-white/80 transition-opacity duration-200 motion-reduce:transition-none md:mt-3"
      >
        {ROZDZIALY[0].spoczynek}
      </div>

      <div role="group" aria-label={LANDING_ANIMACJA.paskiGrupa} className="mt-2.5 flex justify-center">
        {ROZDZIALY.map((r, i) => (
          <button
            key={r.nazwa}
            type="button"
            aria-label={`${LANDING_ANIMACJA.paskiPrzycisk} ${r.nazwa}`}
            ref={(b) => { paskiRef.current[i] = b; }}
            onClick={() => silnikRef.current?.przejdzDo(i)}
            className="grid h-6 min-w-11 place-items-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <i
              className="relative block h-1 overflow-hidden rounded-sm transition-[width,background-color] duration-300 motion-reduce:transition-none"
              style={{ width: 20, background: 'rgba(255,255,255,.35)' }}
            >
              <b className="absolute inset-y-0 left-0 block w-0 rounded-sm bg-white" />
            </i>
          </button>
        ))}
      </div>
    </div>
  );
}
