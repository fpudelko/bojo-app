'use client';

// STAŁA RAMKA TURNIEJU (2026-11-25, uwaga właściciela: „różne zakładki mają
// różną szerokość, a po wejściu w ustawienia zmienia się cały widok, gubię
// się, gdzie jestem i jak wrócić”). Jeden nagłówek na KAŻDYM ekranie
// turnieju: strona publiczna, panel, mecz i drużyna. Nazwa turnieju i jeden
// rząd zakładek zawsze w tym samym miejscu i tej samej szerokości; zarządzający
// dostaje w tym samym rzędzie „Prowadź” (dzień turnieju) i „Edytuj”
// (przygotowanie), prowadzący mecze samo „Prowadź”.
//
// Uprawnienia ramka liczy sama (organizator, admin, `turniej_osoby`), żeby
// ekran meczu i drużyny nie musiały ich znać.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useAdmin } from '@/lib/admin';
import { getMojaOsobe, uprawnieniaTurnieju } from '@/lib/turnieje';
import { ZAKLADKI_TURNIEJU, etykietaZakladkiTurnieju, type ZakladkaTurnieju } from '@/lib/turniejEtykiety';
import type { Turniej, TurniejOsoba } from '@/types';

export type ZakladkaRamki = ZakladkaTurnieju | 'prowadz' | 'edytuj';

/** Szerokość ramki i treści na każdym ekranie turnieju: ta sama wszędzie. */
export const SZEROKOSC_TURNIEJU = 'max-w-2xl lg:max-w-6xl lg:px-6';

export default function RamkaTurnieju({
  turniej, adres, aktywna, liczbaDruzyn, akcje, powrot, children, naglowek = false,
}: {
  turniej: Turniej;
  /** Adres turnieju z nazwą albo uuid (linki publiczne). */
  adres: string;
  /** Zaznaczona zakładka; ekran meczu i drużyny zaznacza tę, z której się do nich wchodzi. */
  aktywna: ZakladkaRamki | null;
  liczbaDruzyn?: number;
  /** Przyciski po prawej od nazwy (udostępnij, tablica wyników…). */
  akcje?: ReactNode;
  /** Ścieżka powrotu nad treścią ekranu pod turniejem: „‹ Mecze”. */
  powrot?: { etykieta: string; href: string };
  /** Nazwa turnieju jako <h1>: strona turnieju i panel. Mecz i drużyna mają własny nagłówek. */
  naglowek?: boolean;
  /** Pasek pod zakładkami (np. podzakładki „Edytuj”). */
  children?: ReactNode;
}) {
  const { user } = useAuth();
  const jestAdmin = useAdmin();
  const [osoba, setOsoba] = useState<TurniejOsoba | null>(null);
  useEffect(() => {
    if (!user) { setOsoba(null); return; }
    let aktualne = true;
    getMojaOsobe(turniej.id, user.id).then((o) => { if (aktualne) setOsoba(o); }, () => undefined);
    return () => { aktualne = false; };
  }, [turniej.id, user]);
  const u = uprawnieniaTurnieju(turniej, osoba, user?.id, jestAdmin);
  // Na telefonie rząd zakładek jest szerszy niż ekran: „Prowadź” i „Edytuj”
  // stoją za krawędzią. Aktywna zakładka zawsze wjeżdża w widok.
  const pasek = useRef<HTMLElement>(null);
  const zakladekRazem = 4 + (u.mozeProwadzic ? 1 : 0) + (u.mozeEdytowac ? 1 : 0);
  useEffect(() => {
    const el = pasek.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (el && pasek.current) {
      pasek.current.scrollLeft = Math.max(0, el.offsetLeft - (pasek.current.clientWidth - el.offsetWidth) / 2);
    }
  }, [aktywna, zakladekRazem]);

  const panel = `/turnieje/${turniej.id}/panel`;
  const zakladki: { klucz: ZakladkaRamki; etykieta: string; href: string; zarzad?: boolean }[] = [
    ...ZAKLADKI_TURNIEJU.map((z) => ({
      klucz: z as ZakladkaRamki,
      etykieta: etykietaZakladkiTurnieju(z, turniej.format, liczbaDruzyn),
      href: `/turnieje/${adres}?tab=${z}`,
    })),
    ...(u.mozeProwadzic ? [{ klucz: 'prowadz' as const, etykieta: 'Prowadź', href: `${panel}?tab=prowadz`, zarzad: true }] : []),
    ...(u.mozeEdytowac ? [{ klucz: 'edytuj' as const, etykieta: 'Edytuj', href: `${panel}?tab=ustawienia`, zarzad: true }] : []),
  ];

  return (
    <div className="sticky top-0 z-20 border-b border-slate-100 bg-canvas/95 backdrop-blur dark:border-slate-700">
      <div className={`mx-auto flex items-start gap-3 px-4 pb-1 pt-3 ${SZEROKOSC_TURNIEJU}`}>
        {/* Dwie linie zamiast ucięcia: na 360 px nazwa turnieju bywa jedyną
            nazwą wydarzenia na ekranie (audyt 7). */}
        {(() => {
          const Tytul = naglowek ? 'h1' : 'p';
          return (
            <Tytul className="line-clamp-2 min-w-0 flex-1 font-display text-xl font-bold leading-tight text-ink sm:text-2xl">
              <Link href={`/turnieje/${adres}?tab=info`}>{turniej.nazwa}</Link>
            </Tytul>
          );
        })()}
        {akcje && <div className="flex shrink-0 items-center gap-2">{akcje}</div>}
      </div>
      <div className="relative">
      {/* Cień przy prawej krawędzi: mówi, że za nią są jeszcze zakładki. */}
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-canvas to-transparent md:hidden" />
      <nav ref={pasek} aria-label="Zakładki turnieju" className={`relative mx-auto flex gap-1 overflow-x-auto px-4 pb-2 scrollbar-hide ${SZEROKOSC_TURNIEJU}`}>
        {zakladki.map((z, i) => (
          <span key={z.klucz} className="flex shrink-0">
          {/* Zakładki zarządzania oddziela kreska: to inna rola, nie kolejna strona turnieju. */}
          {z.zarzad && !zakladki[i - 1]?.zarzad && <span aria-hidden className="mx-1.5 my-2.5 w-px bg-slate-200 dark:bg-slate-700" />}
          <Link
            href={z.href}
            aria-current={aktywna === z.klucz ? 'page' : undefined}
            className={[
              'inline-flex min-h-[44px] shrink-0 items-center rounded-lg px-3 text-sm font-medium transition-colors',
              aktywna === z.klucz
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-200'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
            ].join(' ')}
          >
            {z.etykieta}
          </Link>
          </span>
        ))}
      </nav>
      </div>
      {children}
      {powrot && (
        <div className={`mx-auto px-4 pb-2 ${SZEROKOSC_TURNIEJU}`}>
          <Link href={powrot.href} className="inline-flex min-h-[36px] items-center gap-0.5 text-sm font-medium text-slate-500 hover:text-ink">
            <ChevronLeft className="h-4 w-4" aria-hidden /> {powrot.etykieta}
          </Link>
        </div>
      )}
    </div>
  );
}
