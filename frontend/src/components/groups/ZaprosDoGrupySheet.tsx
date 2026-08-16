'use client';

import { useState } from 'react';
import { Check, Copy, Share2, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { linkDoGrupy, udostepnijGrupe } from '@/lib/groupShare';
import { useBlokadaPrzewijania } from '@/lib/blokadaPrzewijania';
import { WARSTWA } from '@/lib/warstwy';
import type { Group, EventItem } from '@/types';

export default function ZaprosDoGrupySheet({
  group, najblizszy, onClose,
}: {
  group: Group;
  najblizszy?: EventItem;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  useBlokadaPrzewijania(true);

  const link = linkDoGrupy(group.joinCode, user?.id);

  const handleShare = async () => {
    const wynik = await udostepnijGrupe(group, link, undefined, najblizszy);
    if (wynik === 'copied') toast('Skopiowano zaproszenie');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div
      className={`fixed inset-0 ${WARSTWA.modal} flex items-end justify-center bg-black/40 p-0 pb-[env(safe-area-inset-bottom)] sm:items-center sm:p-4 sm:pb-4`}
      onClick={onClose}
    >
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-semibold text-ink">Zaproś do ekipy</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Zamknij">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Wyślij link — po kliknięciu znajomy od razu zobaczy ekipę i najbliższy mecz.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleShare}
            className="inline-flex min-w-[140px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary-700 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-800 active:scale-95"
          >
            <Share2 className="h-4 w-4" /> Udostępnij link
          </button>
          <button
            onClick={handleCopy}
            className="inline-flex min-w-[140px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95"
          >
            {copied ? <><Check className="h-4 w-4 text-green-600" /> Skopiowano</> : <><Copy className="h-4 w-4" /> Kopiuj link</>}
          </button>
        </div>
        <p className="mt-4 text-xs text-slate-400">
          lub podaj kod: <span className="font-mono font-bold tracking-widest text-primary-700">{group.joinCode}</span>
        </p>
      </div>
    </div>
  );
}
