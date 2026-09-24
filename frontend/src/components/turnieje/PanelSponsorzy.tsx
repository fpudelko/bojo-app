// Zarządzanie sponsorami turnieju w panelu (zakładka Ustawienia). Nazwa
// i link zapisują się przy wyjściu z pola — ten sam wzorzec co nazwa, opis
// i regulamin turnieju kilka kart wyżej.
'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Plus, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useToast } from '@/lib/toast';
import {
  getSponsorzy, dodajSponsora, aktualizujSponsora, ustawLogoSponsora, usunSponsora,
} from '@/lib/turniejGaleria';
import type { OpcjePotwierdzenia, WynikPotwierdzenia } from '@/lib/usePotwierdzenie';
import type { TurniejSponsor } from '@/types';

const inputCls =
  'w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500';

export interface PanelSponsorzyProps {
  turniejId: string;
  potwierdz: (opcje: OpcjePotwierdzenia) => Promise<WynikPotwierdzenia>;
}

export default function PanelSponsorzy({ turniejId, potwierdz }: PanelSponsorzyProps) {
  const { toast } = useToast();
  const [sponsorzy, setSponsorzy] = useState<TurniejSponsor[]>([]);
  const [wczytane, setWczytane] = useState(false);
  const [nazwa, setNazwa] = useState('');
  const [link, setLink] = useState('');
  const [dodaje, setDodaje] = useState(false);

  const odswiez = async () => {
    try {
      setSponsorzy(await getSponsorzy(turniejId));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się wczytać sponsorów', 'error');
    } finally {
      setWczytane(true);
    }
  };

  useEffect(() => {
    odswiez();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turniejId]);

  const dodaj = async () => {
    setDodaje(true);
    try {
      await dodajSponsora(turniejId, { nazwa, link });
      setNazwa('');
      setLink('');
      await odswiez();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się dodać sponsora', 'error');
    } finally {
      setDodaje(false);
    }
  };

  const usun = async (s: TurniejSponsor) => {
    const wynik = await potwierdz({
      tytul: `Usunąć sponsora ${s.nazwa}?`,
      konsekwencje: ['Zniknie ze strony turnieju razem z logo', 'Tego nie da się cofnąć'],
      potwierdzLabel: 'Usuń sponsora',
      wariant: 'destrukcyjny',
    });
    if (wynik !== 'tak') return;
    try {
      await usunSponsora(s);
      setSponsorzy((lista) => lista.filter((x) => x.id !== s.id));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się usunąć sponsora', 'error');
    }
  };

  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-ink">Sponsorzy</h2>
        <p className="text-xs text-slate-400">Widoczni dla wszystkich na zakładce Info. Logo nie jest obowiązkowe.</p>
      </div>

      {!wczytane ? (
        <p className="text-sm text-slate-400">Ładuję…</p>
      ) : sponsorzy.length > 0 && (
        <ul className="space-y-3">
          {sponsorzy.map((s) => (
            <WierszSponsora key={s.id} sponsor={s} onZmiana={odswiez} onUsun={() => usun(s)} />
          ))}
        </ul>
      )}

      <div className="space-y-2 border-t border-slate-100 dark:border-slate-700 pt-3">
        <input value={nazwa} onChange={(e) => setNazwa(e.target.value)} maxLength={60} placeholder="Nazwa sponsora" className={inputCls} />
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Strona sponsora (opcjonalnie)" inputMode="url" className={inputCls} />
        <Button size="sm" onClick={dodaj} disabled={nazwa.trim().length === 0 || dodaje} className="inline-flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> Dodaj sponsora
        </Button>
      </div>
    </div>
  );
}

function WierszSponsora({ sponsor, onZmiana, onUsun }: {
  sponsor: TurniejSponsor;
  onZmiana: () => Promise<void>;
  onUsun: () => void;
}) {
  const { toast } = useToast();
  const plikRef = useRef<HTMLInputElement>(null);
  const [nazwa, setNazwa] = useState(sponsor.nazwa);
  const [link, setLink] = useState(sponsor.link ?? '');
  const [wgrywam, setWgrywam] = useState(false);

  // Baza oddaje link znormalizowany („a.pl" → „https://a.pl/"). Bez
  // dociągnięcia go do pola każde kolejne wyjście z pola zapisywałoby
  // ponownie to samo.
  useEffect(() => {
    setNazwa(sponsor.nazwa);
    setLink(sponsor.link ?? '');
  }, [sponsor.nazwa, sponsor.link]);

  const zapisz = async (dane: { nazwa?: string; link?: string }) => {
    try {
      await aktualizujSponsora(sponsor.id, dane);
      await onZmiana();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się zapisać sponsora', 'error');
      setNazwa(sponsor.nazwa);
      setLink(sponsor.link ?? '');
    }
  };

  const logo = async (plik: File | null) => {
    setWgrywam(true);
    try {
      await ustawLogoSponsora(sponsor.id, plik);
      await onZmiana();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się zapisać logo', 'error');
    } finally {
      setWgrywam(false);
    }
  };

  return (
    <li className="flex items-start gap-3">
      <div className="shrink-0 space-y-1 text-center">
        <input
          ref={plikRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) logo(f); }}
        />
        <button
          type="button"
          onClick={() => plikRef.current?.click()}
          disabled={wgrywam}
          aria-label={sponsor.logoUrl ? 'Zmień logo' : 'Dodaj logo'}
          className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-white p-1 text-slate-400"
        >
          {wgrywam ? <Loader2 className="h-4 w-4 animate-spin" />
            : sponsor.logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={sponsor.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
              : <ImagePlus className="h-5 w-5" />}
        </button>
        {sponsor.logoUrl && !wgrywam && (
          <button type="button" onClick={() => logo(null)} className="text-[11px] text-slate-400 hover:text-red-600">
            usuń logo
          </button>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <input
          value={nazwa}
          onChange={(e) => setNazwa(e.target.value)}
          onBlur={() => nazwa.trim() !== sponsor.nazwa && zapisz({ nazwa })}
          maxLength={60}
          aria-label="Nazwa sponsora"
          className={inputCls}
        />
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onBlur={() => link.trim() !== (sponsor.link ?? '') && zapisz({ link })}
          placeholder="Strona sponsora (opcjonalnie)"
          inputMode="url"
          aria-label="Strona sponsora"
          className={inputCls}
        />
      </div>

      <button type="button" onClick={onUsun} aria-label={`Usuń sponsora ${sponsor.nazwa}`} className="shrink-0 pt-2 text-slate-300 hover:text-red-500">
        <X className="h-4 w-4" />
      </button>
    </li>
  );
}
