// Zarządzanie galerią turnieju w panelu (zakładka Ustawienia). Kolejność
// strzałkami, nie przeciąganiem — przeciąganie na telefonie walczy
// z przewijaniem strony, a strzałki działają tak samo wszędzie.
'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Loader2, X } from 'lucide-react';
import { useToast } from '@/lib/toast';
import { getZdjecia, dodajZdjecie, usunZdjecie, przesunZdjecie } from '@/lib/turniejGaleria';
import type { OpcjePotwierdzenia, WynikPotwierdzenia } from '@/lib/usePotwierdzenie';
import type { TurniejZdjecie } from '@/types';

export interface PanelGaleriaProps {
  turniejId: string;
  userId: string;
  potwierdz: (opcje: OpcjePotwierdzenia) => Promise<WynikPotwierdzenia>;
}

export default function PanelGaleria({ turniejId, userId, potwierdz }: PanelGaleriaProps) {
  const { toast } = useToast();
  const plikRef = useRef<HTMLInputElement>(null);
  const [zdjecia, setZdjecia] = useState<TurniejZdjecie[]>([]);
  const [wczytane, setWczytane] = useState(false);
  const [wgrywam, setWgrywam] = useState(0);
  const [zajete, setZajete] = useState<string | null>(null);

  const odswiez = async () => {
    try {
      setZdjecia(await getZdjecia(turniejId));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się wczytać galerii', 'error');
    } finally {
      setWczytane(true);
    }
  };

  useEffect(() => {
    odswiez();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turniejId]);

  // Pliki po kolei, nie równolegle: kolejność w galerii ma odpowiadać
  // kolejności wyboru, a `dodajZdjecie` liczy pozycję z ostatniego wiersza.
  const dodaj = async (pliki: File[]) => {
    setWgrywam(pliki.length);
    let bledy = 0;
    for (const plik of pliki) {
      try {
        await dodajZdjecie(turniejId, plik, userId);
      } catch (e) {
        bledy += 1;
        toast(`${plik.name}: ${e instanceof Error ? e.message : 'nie udało się wgrać'}`, 'error');
      }
      setWgrywam((n) => n - 1);
    }
    await odswiez();
    if (bledy === 0) toast(pliki.length === 1 ? 'Zdjęcie dodane' : `Dodano zdjęcia: ${pliki.length}`);
  };

  const przesun = async (id: string, kierunek: 'gora' | 'dol') => {
    setZajete(id);
    try {
      await przesunZdjecie(id, kierunek);
      await odswiez();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się zmienić kolejności', 'error');
    } finally {
      setZajete(null);
    }
  };

  const usun = async (z: TurniejZdjecie) => {
    const wynik = await potwierdz({
      tytul: 'Usunąć zdjęcie?',
      konsekwencje: ['Zniknie z galerii na stronie turnieju', 'Tego nie da się cofnąć'],
      potwierdzLabel: 'Usuń zdjęcie',
      wariant: 'destrukcyjny',
    });
    if (wynik !== 'tak') return;
    setZajete(z.id);
    try {
      await usunZdjecie(z);
      setZdjecia((lista) => lista.filter((x) => x.id !== z.id));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się usunąć zdjęcia', 'error');
    } finally {
      setZajete(null);
    }
  };

  const przycisk = 'rounded-lg bg-black/50 p-1 text-white backdrop-blur-sm transition hover:bg-black/70 disabled:opacity-30';

  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-ink">Galeria</h2>
        <p className="text-xs text-slate-400">Widoczna dla wszystkich na zakładce Info. Do 5 MB na zdjęcie.</p>
      </div>

      {!wczytane ? (
        <p className="text-sm text-slate-400">Ładuję…</p>
      ) : zdjecia.length > 0 && (
        <ul className="grid grid-cols-3 gap-1.5">
          {zdjecia.map((z, i) => (
            <li key={z.id} className="relative aspect-square overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={z.url} alt="" loading="lazy" className="h-full w-full object-cover" />
              <div className="absolute inset-x-1 top-1 flex justify-between">
                <div className="flex gap-1">
                  <button type="button" onClick={() => przesun(z.id, 'gora')} disabled={i === 0 || zajete !== null} aria-label="Przesuń wcześniej" className={przycisk}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => przesun(z.id, 'dol')} disabled={i === zdjecia.length - 1 || zajete !== null} aria-label="Przesuń dalej" className={przycisk}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button type="button" onClick={() => usun(z)} disabled={zajete !== null} aria-label="Usuń zdjęcie" className={przycisk}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={plikRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const pliki = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (pliki.length > 0) dodaj(pliki);
        }}
      />
      <button
        type="button"
        onClick={() => plikRef.current?.click()}
        disabled={wgrywam > 0}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 py-2.5 text-sm font-medium text-primary-600 transition hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:opacity-60"
      >
        {wgrywam > 0
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Wgrywam ({wgrywam})…</>
          : <><ImagePlus className="h-4 w-4" /> Dodaj zdjęcia</>}
      </button>
    </div>
  );
}
