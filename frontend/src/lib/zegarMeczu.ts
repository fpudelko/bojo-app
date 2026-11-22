// Zegar meczu turnieju sterowany przez prowadzącego (migracja 182):
// start, pauza, koniec 1. połowy, start 2. połowy, koniec meczu.
// Czyste funkcje: „teraz” z zewnątrz, zapis robi `updateMecz()`.
//
// Do 2026-11-22 zegar liczył od `rozpoczetyAt`, więc ruszał w chwili
// wejścia w tryb na żywo i nie dawał się zatrzymać (zgłoszenie właściciela).
import type { TurniejMecz } from '@/types';

export type FazaZegara = 'czeka' | 'gra' | 'pauza' | 'przerwa';

type MeczZegar = { zegarOd?: string | null; zegarSekundy?: number; polowa?: TurniejMecz['polowa'] };

/**
 * czeka   — przed pierwszym gwizdkiem (0:00, 1. połowa),
 * gra     — zegar biegnie,
 * pauza   — zatrzymany w trakcie połowy,
 * przerwa — po końcu 1. połowy, przed startem 2.
 */
export function fazaZegara(m: MeczZegar): FazaZegara {
  if (m.zegarOd) return 'gra';
  const sek = m.zegarSekundy ?? 0;
  if ((m.polowa ?? 1) === 2 && sek === 0) return 'przerwa';
  return sek > 0 ? 'pauza' : 'czeka';
}

/** Sekundy gry w bieżącej połowie. */
export function sekundyPolowy(m: MeczZegar, teraz: Date): number {
  const zebrane = m.zegarSekundy ?? 0;
  if (!m.zegarOd) return zebrane;
  const od = new Date(m.zegarOd).getTime();
  return Number.isNaN(od) ? zebrane : zebrane + Math.max(0, Math.floor((teraz.getTime() - od) / 1000));
}

export function formatZegara(sekundy: number): string {
  return `${String(Math.floor(sekundy / 60)).padStart(2, '0')}:${String(sekundy % 60).padStart(2, '0')}`;
}

/** Minuta meczu do zdarzenia (gol, kartka): w 2. połowie dolicza długość 1. */
export function minutaMeczu(m: MeczZegar, teraz: Date, czasMeczuMin: number): number | undefined {
  if (fazaZegara(m) === 'czeka') return undefined;
  const minutaPolowy = Math.floor(sekundyPolowy(m, teraz) / 60);
  return (m.polowa ?? 1) === 2 ? Math.round(czasMeczuMin / 2) + minutaPolowy : minutaPolowy;
}

/** Czy minął regulaminowy czas połowy (połowa = czas meczu / 2). */
export function poCzasiePolowy(m: MeczZegar, teraz: Date, czasMeczuMin: number): boolean {
  return czasMeczuMin > 0 && sekundyPolowy(m, teraz) >= (czasMeczuMin * 60) / 2;
}

/** Podpis zegara do ekranów: „1. poł. 05:12”, „Przerwa”, „Pauza 05:12”. */
export function opisZegara(m: MeczZegar, teraz: Date): string {
  const faza = fazaZegara(m);
  if (faza === 'przerwa') return 'Przerwa';
  if (faza === 'czeka') return 'Za chwilę start';
  const czas = formatZegara(sekundyPolowy(m, teraz));
  return faza === 'pauza' ? `Pauza ${czas}` : `${m.polowa ?? 1}. poł. ${czas}`;
}

// ── Zmiany stanu (to, co zapisuje `updateMecz`) ─────────────────────────────

export type ZmianaZegara = { zegarOd: string | null; zegarSekundy: number; polowa: 1 | 2 };

export function startZegara(m: MeczZegar, teraz: Date): ZmianaZegara {
  return { zegarOd: teraz.toISOString(), zegarSekundy: m.zegarSekundy ?? 0, polowa: (m.polowa ?? 1) as 1 | 2 };
}

export function pauzaZegara(m: MeczZegar, teraz: Date): ZmianaZegara {
  return { zegarOd: null, zegarSekundy: sekundyPolowy(m, teraz), polowa: (m.polowa ?? 1) as 1 | 2 };
}

/** Koniec 1. połowy: zegar staje i zeruje się na 2. połowę. */
export function koniecPolowy(): ZmianaZegara {
  return { zegarOd: null, zegarSekundy: 0, polowa: 2 };
}
