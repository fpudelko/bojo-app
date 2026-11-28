'use client';

// „Twoje turnieje” na `/moje-gry` (2026-11-22, prośba właściciela): turniej,
// w którego drużynie grasz, który organizujesz albo obserwujesz, stoi na
// koncie jako karta, nie tylko jako wejście „🏆 Turnieje”. Bez turniejów
// zostaje samo wejście (dla tych, którzy w ogóle widzą moduł).
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getMojeTurniejeZRola, getTurniejePubliczne, turniejeNaMojeMecze, type MojTurniej } from '@/lib/turnieje';
import { terazWPolsce } from '@/lib/czasPolski';
import KartaTurnieju from './KartaTurnieju';

export default function MojeTurniejeSekcja({ userId, pokazWejscie }: { userId: string | null; pokazWejscie: boolean }) {
  const [moje, setMoje] = useState<MojTurniej[]>([]);
  // Czy poza moimi jest jakikolwiek inny publiczny turniej (2026-11-28,
  // uwaga właściciela): „Wszystkie turnieje” przy jedynym turnieju na liście
  // prowadziło do tej samej karty. `null` = jeszcze nie wiemy.
  const [saInne, setSaInne] = useState<boolean | null>(null);

  useEffect(() => {
    if (!userId) { setMoje([]); return; }
    let aktualne = true;
    getMojeTurniejeZRola(userId)
      .then((lista) => { if (aktualne) setMoje(turniejeNaMojeMecze(lista, terazWPolsce().data)); })
      .catch(() => { if (aktualne) setMoje([]); });
    return () => { aktualne = false; };
  }, [userId]);

  useEffect(() => {
    let aktualne = true;
    getTurniejePubliczne(20)
      .then((lista) => {
        if (!aktualne) return;
        const moja = new Set(moje.map((m) => m.turniej.id));
        setSaInne(lista.some((t) => !moja.has(t.id)));
      })
      .catch(() => { if (aktualne) setSaInne(true); });
    return () => { aktualne = false; };
  }, [moje]);

  if (moje.length === 0 && !pokazWejscie) return null;

  return (
    <section className="space-y-2" aria-label="Twoje turnieje">
      {/* Sama karta, bez nagłówka „Twoje turnieje” (2026-11-28): rola
          („Organizujesz”, „Grasz w …”) stoi już na karcie. */}
      {moje.map((m) => <KartaTurnieju key={m.turniej.id} t={m.turniej} rola={m.rola} druzyna={m.druzyna} />)}
      {(moje.length === 0 || saInne) && <Link prefetch={false}
        href="/turnieje"
        className="flex items-center justify-between rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 px-4 py-3.5 shadow-sm hover:border-primary-200 hover:shadow-md transition-all group"
      >
        <span className="text-sm font-semibold text-ink">🏆 {moje.length > 0 ? 'Wszystkie turnieje' : 'Turnieje'}</span>
        <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-primary-600 transition-colors" />
      </Link>}
    </section>
  );
}
