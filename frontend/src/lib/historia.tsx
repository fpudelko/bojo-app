'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * Dokąd wraca strzałka „wstecz" — jedno miejsce dla całej aplikacji.
 *
 * PROBLEM, KTÓRY TO ROZWIĄZUJE. Ekrany szczegółowe miały wstecz zapisane
 * na sztywno do JEDNEGO rodzica: `/grupy/[id]` zawsze na `/grupy`,
 * `/rozmowy/[id]` zawsze na `/rozmowy`. Do ekipy wchodzi się z siedmiu
 * miejsc (kafelek na stronie głównej, `/moje-gry`, lista rozmów, strona
 * meczu, przytrzymanie „Ekipy" w nawigacji, kod zaproszenia, przełącznik
 * ekip), a do rozmowy prywatnej z profilu gracza — więc wstecz wyrzucało
 * człowieka na ekran, na którym nigdy nie był. To jest opisywane jako
 * „wstecz prowadzi w losowe miejsca": nie było losowe, było stałe i przez
 * to prawie zawsze złe.
 *
 * DRUGA POŁOWA PROBLEMU: te ekrany robiły `router.push()`, nie `back()`.
 * Push DOKŁADA wpis do historii, więc systemowe „wstecz" zaraz po naszym
 * „wstecz" wracało na ekran, z którego się właśnie wyszło — pętla.
 *
 * ROZWIĄZANIE: wstecz znaczy wstecz. Gdy w tej karcie przeglądarki jest
 * dokąd wracać W APLIKACJI — `router.back()`, czyli dokładnie poprzedni
 * ekran, ze scrollem i stanem, które przeglądarka odtwarza sama. Gdy nie
 * ma (wejście z powiadomienia push, z linku od kolegi, z ikony PWA — świeży
 * kontekst JS, historia pusta albo cudza) — `replace()` na sensownego
 * rodzica podanego przez ekran.
 *
 * `replace`, nie `push`, właśnie dlatego: po wejściu z linku systemowe
 * „wstecz" ma wyprowadzić z aplikacji, a nie odbić z powrotem na ekran,
 * który przed chwilą opuściliśmy.
 *
 * OGRANICZENIE, ŚWIADOME: licznik żyje w pamięci modułu, więc twarde
 * przeładowanie strony (F5) zeruje go i wstecz użyje rodzica zamiast
 * prawdziwej historii. To jest bezpieczna strona pomyłki — rodzic zawsze
 * istnieje i jest sensowny, a `router.back()` na cudzy wpis w historii
 * wyprowadziłby z aplikacji bez ostrzeżenia.
 */

/** Ile ekranów w GŁĄB aplikacji jesteśmy od wejścia do tej karty. */
let glebokosc = 0;
/** Ustawiane przez `useWstecz()` tuż przed `router.back()`, żeby zmiana
 *  trasy, którą ten powrót wywoła, ZDJĘŁA poziom zamiast go dołożyć. */
let powrotWToku = false;

export function zanotujPrzejscie(): void {
  if (powrotWToku) {
    powrotWToku = false;
    glebokosc = Math.max(0, glebokosc - 1);
    return;
  }
  glebokosc += 1;
}

export function oznaczPowrot(): void {
  powrotWToku = true;
}

export function maHistorieWAplikacji(): boolean {
  return glebokosc > 0;
}

/** Wyłącznie do testów — moduł trzyma stan między przypadkami. */
export function zerujHistorie(): void {
  glebokosc = 0;
  powrotWToku = false;
}

/**
 * Liczy przejścia między ekranami. Montowany raz, w `app/layout.tsx`.
 *
 * Pierwsze uruchomienie efektu to WEJŚCIE na stronę, nie przejście — stąd
 * `pierwszy`. Bez tego każde wejście z linku wyglądałoby jak przejście
 * i wstecz próbowałoby wracać do strony, z której człowiek przyszedł
 * (Facebook, WhatsApp, wyniki wyszukiwania).
 */
export function SledzenieHistorii() {
  const pathname = usePathname();
  const pierwszy = useRef(true);
  useEffect(() => {
    if (pierwszy.current) {
      pierwszy.current = false;
      return;
    }
    zanotujPrzejscie();
  }, [pathname]);
  return null;
}

/**
 * Handler przycisku „wstecz". `zapasowyCel` to rodzic używany WYŁĄCZNIE
 * wtedy, gdy nie ma dokąd wracać — nie jest to „miejsce, do którego wstecz
 * prowadzi", tylko ostatnia deska ratunku.
 */
export function useWstecz(zapasowyCel: string): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (maHistorieWAplikacji()) {
      oznaczPowrot();
      router.back();
      return;
    }
    router.replace(zapasowyCel);
  }, [router, zapasowyCel]);
}
