'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { BellOff, Check, Loader2, AlertTriangle } from 'lucide-react';
import { wylaczAlertTokenem } from '@/lib/alerts';

type Stan = 'pracuje' | 'wylaczony' | 'juz-nieaktywny' | 'blad';

/**
 * Wyłącza alert OD RAZU po wejściu, bez pytania „na pewno?".
 *
 * Ktoś, kto kliknął „nie chcę więcej takich wiadomości" w mailu, już
 * odpowiedział na to pytanie — drugie pytanie na stronie to kolejna rzecz
 * między nim a spokojem, a przy niepewnym zasięgu w komunikacji miejskiej
 * całkiem realna szansa, że wyłączenie nie dojdzie do skutku. Operacja jest
 * odwracalna jednym kliknięciem w aplikacji, więc koszt pomyłki jest zerowy,
 * a koszt niewyłączenia — utrata zaufania do całego kanału.
 *
 * `useParams`, nie `useSearchParams`: token siedzi w ŚCIEŻCE. To nie jest
 * drobiazg — `useSearchParams()` w komponencie klienckim wywraca build
 * produkcyjny na trasie prerenderowanej (pułapka opisana w AGENTS.md).
 */
export default function WylaczAlertClient() {
  const params = useParams<{ token: string }>();
  const [stan, setStan] = useState<Stan>('pracuje');

  useEffect(() => {
    const token = params?.token;
    if (!token) { setStan('blad'); return; }
    let zywe = true;
    wylaczAlertTokenem(token)
      .then((wylaczono) => { if (zywe) setStan(wylaczono ? 'wylaczony' : 'juz-nieaktywny'); })
      .catch(() => { if (zywe) setStan('blad'); });
    return () => { zywe = false; };
  }, [params]);

  if (stan === 'pracuje') {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Wyłączam powiadomienia…
      </div>
    );
  }

  if (stan === 'blad') {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-amber-600" aria-hidden />
        <p className="mt-2 text-sm font-semibold text-amber-900">Nie udało się wyłączyć</p>
        <p className="mt-1 text-sm text-amber-800">
          Spróbuj jeszcze raz za chwilę albo wyłącz alert w aplikacji, w liście
          meczów, pod dzwonkiem.
        </p>
      </div>
    );
  }

  // „Wyłączony" i „był już wyłączony" mówią klikającemu dokładnie to samo:
  // nie będzie więcej wiadomości. Rozróżnianie ich w komunikacie zmuszałoby
  // go do zastanowienia się nad czymś, co go nie dotyczy — a mail zostaje
  // w skrzynce na zawsze, więc drugie kliknięcie w ten sam link jest normalne.
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-800">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-950">
        <BellOff className="h-5 w-5 text-primary-700" aria-hidden />
      </span>
      <p className="mt-3 text-base font-bold text-ink">Gotowe, nie damy już znać</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Alert o nowych meczach w okolicy jest wyłączony. Nie musisz nic więcej robić.
      </p>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-400">
        <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Możesz go włączyć z powrotem w każdej chwili w aplikacji.
      </p>
    </div>
  );
}
