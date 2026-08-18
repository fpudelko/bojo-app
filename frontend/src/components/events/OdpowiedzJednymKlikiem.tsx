'use client';

import { useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { useAuth, displayName } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { joinEvent } from '@/lib/events';
import { odmow } from '@/lib/eventDeclines';

/**
 * „Gram" / „Nie gram" bez wchodzenia na stronę meczu.
 *
 * DLACZEGO W OGÓLE: do tej pory na zaproszenie odpowiadało się wyłącznie
 * z poziomu meczu — trzeba było otworzyć kartę, przewinąć do przycisku,
 * zapisać się. Czyli „tak" kosztowało więcej kliknięć niż „nie" (nie robisz
 * nic), w produkcie, którego całym sensem jest zebranie składu. Przy stałej
 * ekipie ta sama pętla wraca co tydzień, więc koszt mnoży się przez 50.
 *
 * DLACZEGO TAK MAŁE: dwa poprzednie podejścia — obwódka z nagłówkiem
 * „ZAPROSZENIE" i para dużych przycisków pod kartą — odpadły, bo przy trzech
 * zaproszeniach pod rząd lista robiła się ścianą kontrolek. Tu para przycisków
 * jest wielkości plakietki i stoi w jednym wierszu, a nie pod kartą.
 *
 * ZNIKA PO ODPOWIEDZI, nie po odświeżeniu strony: `onOdpowiedziano` mówi
 * rodzicowi, żeby zdjął pozycję z listy. Zaproszenie, na które się właśnie
 * odpowiedziało, a które dalej wisi jak nieodpowiedziane, czyta się jak błąd
 * zapisu i ludzie klikają drugi raz.
 *
 * ODMOWA jest jawna (`event_declines`, migracja `097`), nie jest zwykłym
 * schowaniem karty: organizator ma widzieć „nie gram", bo to jego jedyna
 * informacja, że ma szukać kogoś innego.
 */
export default function OdpowiedzJednymKlikiem({
  eventId, onOdpowiedziano, wariant = 'karta',
}: {
  eventId: string;
  onOdpowiedziano?: (odpowiedz: 'gram' | 'nie-gram') => void;
  /** `karta` — na liście zaproszeń; `panel` — węższy, w panelu powiadomień. */
  wariant?: 'karta' | 'panel';
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState<'gram' | 'nie-gram' | null>(null);

  if (!user) return null;

  const wykonaj = async (odpowiedz: 'gram' | 'nie-gram', e: React.MouseEvent) => {
    // Przyciski siedzą WEWNĄTRZ klikalnej karty (cała karta to odnośnik do
    // meczu). Bez tego „Gram" zapisywałoby i jednocześnie przenosiło na stronę
    // meczu — chmurka z potwierdzeniem mignęłaby i zniknęła razem z widokiem.
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(odpowiedz);
    try {
      if (odpowiedz === 'gram') {
        const wynik = await joinEvent(eventId, user.id, displayName(user));
        // `joinEvent` sam decyduje, co się stało: skład, rezerwa (komplet
        // w składzie albo w roli) albo prośba do akceptacji. Komunikat musi
        // mówić, co NAPRAWDĘ zaszło — „jesteś w składzie" przy wpisie na
        // rezerwę to najgorszy możliwy wariant tego przycisku.
        toast(
          wynik?.pending
            ? 'Prośba wysłana — czeka na akceptację organizatora'
            : wynik?.isReserve
              ? 'Komplet — jesteś na liście rezerwowej'
              : 'Grasz — jesteś w składzie',
        );
      } else {
        await odmow(eventId, user.id);
        toast('Dzięki — organizator wie, że nie grasz');
      }
      onOdpowiedziano?.(odpowiedz);
    } catch (blad) {
      toast(blad instanceof Error ? blad.message : 'Nie udało się zapisać odpowiedzi', 'error');
    } finally {
      setBusy(null);
    }
  };

  const rozmiar = wariant === 'panel'
    ? 'px-2 py-1 text-[11px]'
    : 'px-2.5 py-1 text-xs';

  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={(e) => wykonaj('gram', e)}
        disabled={!!busy}
        className={`inline-flex items-center gap-1 rounded-full bg-primary-700 font-bold text-white transition hover:bg-primary-800 disabled:opacity-60 ${rozmiar}`}
      >
        {busy === 'gram' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        Gram
      </button>
      <button
        type="button"
        onClick={(e) => wykonaj('nie-gram', e)}
        disabled={!!busy}
        aria-label="Nie gram"
        title="Nie gram"
        className={`inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white font-semibold text-slate-500 transition hover:border-red-200 hover:text-red-600 disabled:opacity-60 ${rozmiar}`}
      >
        {busy === 'nie-gram' ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
      </button>
    </span>
  );
}
