'use client';
// Czy pokazać wejście „🏆 Turnieje” obok Moich meczów (decyzja właściciela
// z 2026-11-21): tak, gdy zalogowany organizuje albo współorganizuje jakiś
// turniej, gra w składzie drużyny turniejowej albo jest adminem. Reszta
// użytkowników wejścia nie widzi; moduł dalej chowa przed nimi `SHOW_TURNIEJE`.
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';
import { useAdmin } from './admin';

async function czyMaTurnieje(userId: string): Promise<boolean> {
  const ile = async (zapytanie: PromiseLike<{ count: number | null; error: unknown }>) => {
    const { count, error } = await zapytanie;
    return !error && (count ?? 0) > 0;
  };
  const wyniki = await Promise.all([
    ile(supabase.from('turnieje').select('id', { count: 'exact', head: true }).eq('organizator_id', userId)),
    ile(supabase.from('turniej_zawodnicy').select('id', { count: 'exact', head: true }).eq('user_id', userId)),
    ile(supabase.from('turniej_osoby').select('turniej_id', { count: 'exact', head: true }).eq('user_id', userId)),
  ]);
  return wyniki.some(Boolean);
}

export function useMamTurnieje(): boolean {
  const { user } = useAuth();
  const jestAdmin = useAdmin();
  const [ma, setMa] = useState(false);
  useEffect(() => {
    if (!user) { setMa(false); return; }
    let aktualne = true;
    czyMaTurnieje(user.id).then((w) => { if (aktualne) setMa(w); }, () => { if (aktualne) setMa(false); });
    return () => { aktualne = false; };
  }, [user?.id]);
  return ma || jestAdmin;
}
