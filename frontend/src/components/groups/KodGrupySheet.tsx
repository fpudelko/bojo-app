'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, Users, X } from 'lucide-react';
import { poprosODolaczenieKodem } from '@/lib/groups';
import { useToast } from '@/lib/toast';
import { WARSTWA } from '@/lib/warstwy';
import { useBlokadaPrzewijania } from '@/lib/blokadaPrzewijania';

/**
 * Bottom sheet „Masz kod zaproszenia?" — dawniej karta na pół ekranu na
 * `/grupy`, dziś dyskretny wiersz, który to otwiera na żądanie.
 *
 * KOD NIE WPUSZCZA DO EKIPY — SKŁADA PROŚBĘ (migracja `150`). Do `150` RPC
 * `dolacz_do_grupy_kodem` dopisywała do składu każdego, kto znał kod; kod jest
 * jeden dla całej ekipy, a link wklejony na czacie zostaje tam na zawsze.
 * Dlatego przycisk mówi dziś „Poproś", a nie „Dołącz" — obietnica ma pokrywać
 * się z tym, co się stanie. Nieznany kod dalej wraca błędem wprost z bazy,
 * więc literowka nie wygląda jak awaria.
 */
export default function KodGrupySheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  useBlokadaPrzewijania(true);

  const handleJoin = async () => {
    if (code.trim().length < 4 || busy) return;
    setBusy(true);
    try {
      const groupId = await poprosODolaczenieKodem(code);
      toast('Prośba wysłana — ekipa musi ją przyjąć');
      router.push(`/grupy/${groupId}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Błąd', 'error');
      setBusy(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 ${WARSTWA.modal} flex items-end justify-center bg-black/40 p-0 pb-[env(safe-area-inset-bottom)] sm:items-center sm:p-4 sm:pb-4`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-400" />
          <h2 className="flex-1 font-semibold text-ink">Masz kod zaproszenia?</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Zamknij">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-3 text-sm text-slate-500">
          Wpisz 6 znaków z linku albo od organizatora. Wyślemy prośbę — ekipa
          zobaczy, że przychodzisz z zaproszenia.
        </p>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="K7QP4B"
            maxLength={8}
            autoFocus
            className="w-32 min-w-0 rounded-xl border border-slate-300 px-3 py-2.5 font-mono text-base font-bold uppercase tracking-widest text-primary-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            onClick={handleJoin}
            disabled={code.trim().length < 4 || busy}
            className="inline-flex flex-1 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-800 active:scale-95 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Poproś <ArrowRight className="h-4 w-4" /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
