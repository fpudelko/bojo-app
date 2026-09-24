// Prośba o inny wygląd strony turnieju — wprost z panelu, do zespołu Bojo
// (migracja `162`). Świadomie NIE automatyzujemy zmiany: organizator opisuje,
// czego brakuje, a wygląd i tak zmienia człowiek po stronie Bojo. To pole
// zbiera TREŚĆ prośby razem z kontekstem (który turniej, kto pisze) — bez
// niego trafiałaby do nas mailem bez adresu do panelu i trzeba by dopytywać.
'use client';

import { useState } from 'react';
import { Loader2, Palette } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useToast } from '@/lib/toast';
import { zglosZyczenieWygladu } from '@/lib/bledy';

export interface PanelProsbaOWygladProps {
  turniejId: string;
}

export default function PanelProsbaOWyglad({ turniejId }: PanelProsbaOWygladProps) {
  const { toast } = useToast();
  const [opis, setOpis] = useState('');
  const [wysylam, setWysylam] = useState(false);

  const wyslij = async () => {
    setWysylam(true);
    try {
      await zglosZyczenieWygladu(turniejId, opis);
      setOpis('');
      toast('Dzięki, zajmiemy się tym');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się wysłać prośby', 'error');
    } finally {
      setWysylam(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Palette className="h-4 w-4 text-slate-400" /> Inny wygląd strony turnieju?
        </h2>
        <p className="text-xs text-slate-400">
          Kolory, układ albo dodatkowy element na zakładce Info. Zmianę wprowadzamy ręcznie,
          nie jest automatyczna.
        </p>
      </div>
      <textarea
        value={opis}
        onChange={(e) => setOpis(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Np. „Chcę logo sponsora większe i na górze strony”."
        className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
      <Button
        size="sm"
        onClick={wyslij}
        disabled={opis.trim().length === 0 || wysylam}
        className="inline-flex items-center gap-1.5"
      >
        {wysylam && <Loader2 className="h-4 w-4 animate-spin" />} Wyślij prośbę
      </Button>
    </div>
  );
}
