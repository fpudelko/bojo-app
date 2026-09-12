'use client';

import { useCallback, useRef, useState } from 'react';
import OknoPotwierdzenia, { type OpcjeNotatki } from '@/components/ui/OknoPotwierdzenia';

/**
 * `confirm()` z aplikacji zamiast `confirm()` z przeglądarki.
 *
 * PO CO TAK, A NIE STAN NA KAŻDĄ AKCJĘ. Miejsc do zamiany było kilkanaście,
 * w tym siedem w jednym pliku na pięć tysięcy linii, który audyt oznaczył jako
 * regresyjny hot spot. Osobny stan (`otwarte`, `cel`, `wTrakcie`) na każdą
 * z nich to kilkadziesiąt nowych zmiennych i tyle samo okazji do pomyłki.
 *
 * Ten hak zachowuje kształt wywołania jeden do jednego:
 *
 *     if (!confirm('Usunąć?')) return;                    // przed
 *     if (await potwierdz({ … }) !== 'tak') return;       // po
 *
 * Różnica jest w treści: zamiast jednego zdania okno mieści LISTĘ KONSEKWENCJI
 * („kto dostanie powiadomienie", „czy da się cofnąć"), a przy akcjach, które
 * mają sensowną drugą drogę — także przycisk na nią (`akcjaDodatkowa`).
 *
 * PUŁAPKA, KTÓREJ TU NIE MA: `confirm()` blokuje wątek przeglądarki, więc kod
 * po nim wykonywał się synchronicznie. Tutaj wywołanie jest asynchroniczne —
 * funkcja obsługująca kliknięcie musi być `async`. React nie ma z tym problemu,
 * ale TypeScript przypomni o tym błędem, jeśli o tym zapomnisz.
 */

export type WynikPotwierdzenia = 'tak' | 'nie' | 'dodatkowa';

export interface OpcjePotwierdzenia {
  tytul: string;
  opis?: string;
  /** Co się STANIE po potwierdzeniu — jedna myśl na wiersz. */
  konsekwencje?: string[];
  potwierdzLabel: string;
  anulujLabel?: string;
  wariant?: 'zwykly' | 'destrukcyjny';
  /** Etykieta drugiej drogi; kliknięcie kończy się wynikiem `'dodatkowa'`. */
  akcjaDodatkowaLabel?: string;
  /** Dokłada pole tekstowe pod konsekwencjami — np. notatka organizatora przy
   *  odwołaniu meczu (migracja `142`). Wartość odczytujesz po rozstrzygnięciu
   *  przez `pobierzNotatke()`, nie przez wynik `potwierdz()` — inaczej zmiana
   *  typu wyniku dotknęłaby wszystkie dotychczasowe wywołania w siedmiu
   *  plikach, które porównują go z gołym stringiem (`wybor === 'nie'`). */
  notatka?: OpcjeNotatki;
}

export function usePotwierdzenie() {
  const [opcje, setOpcje] = useState<OpcjePotwierdzenia | null>(null);
  // Obietnica żyje między renderami, więc w `ref`, nie w stanie: zapis do stanu
  // wywołałby kolejny render i zgubił tożsamość funkcji rozwiązującej.
  const rozwiaz = useRef<((w: WynikPotwierdzenia) => void) | null>(null);
  // Też `ref`, nie stan: pole notatki jest niekontrolowane (`OknoPotwierdzenia`
  // czyta wartość z DOM-u przy `onChange`), więc odczyt po `await potwierdz()`
  // nie może polegać na zamknięciu ze starego renderu — miałby wartość sprzed
  // wpisywania tekstu.
  const notatkaRef = useRef('');

  const zakoncz = useCallback((wynik: WynikPotwierdzenia) => {
    setOpcje(null);
    rozwiaz.current?.(wynik);
    rozwiaz.current = null;
  }, []);

  const potwierdz = useCallback((o: OpcjePotwierdzenia): Promise<WynikPotwierdzenia> => {
    // Drugie otwarcie, zanim pierwsze się zamknie, nie powinno zostawić
    // wiszącej obietnicy — poprzednia kończy się jako „nie".
    rozwiaz.current?.('nie');
    notatkaRef.current = '';
    setOpcje(o);
    return new Promise<WynikPotwierdzenia>((res) => { rozwiaz.current = res; });
  }, []);

  /** Tekst wpisany w polu notatki, przycięty. Woła się PO `await potwierdz()`
   *  — czyta to, co zostało wpisane bez względu na to, którym przyciskiem
   *  okno się zamknęło (główny czy „dodatkowa"). */
  const pobierzNotatke = useCallback(() => notatkaRef.current.trim(), []);

  const oknoPotwierdzenia = (
    <OknoPotwierdzenia
      open={opcje !== null}
      tytul={opcje?.tytul ?? ''}
      opis={opcje?.opis}
      konsekwencje={opcje?.konsekwencje}
      potwierdzLabel={opcje?.potwierdzLabel ?? 'Potwierdź'}
      anulujLabel={opcje?.anulujLabel}
      wariant={opcje?.wariant}
      notatka={opcje?.notatka}
      onNotatkaChange={(tekst) => { notatkaRef.current = tekst; }}
      akcjaDodatkowa={
        opcje?.akcjaDodatkowaLabel
          ? { label: opcje.akcjaDodatkowaLabel, onClick: () => zakoncz('dodatkowa') }
          : undefined
      }
      onPotwierdz={() => zakoncz('tak')}
      onAnuluj={() => zakoncz('nie')}
    />
  );

  return { potwierdz, oknoPotwierdzenia, pobierzNotatke };
}
