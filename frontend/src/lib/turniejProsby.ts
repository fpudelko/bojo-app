// Prośby gracza do drużyny turniejowej (migracja 186, 2026-11-25):
// „Poproś o dołączenie”, „To ja” przy zawodniku bez konta, „Chcę być
// kapitanem”. Zapis i decyzja wyłącznie przez funkcje w bazie; RLS oddaje
// prośbę jej autorowi, kapitanowi drużyny i zarządzającym turniejem.
import { supabase } from './supabase';

export type TypProsby = 'dolaczenie' | 'to_ja' | 'kapitan' | 'wycofanie';

export interface ProsbaDoDruzyny {
  id: string;
  turniejId: string;
  druzynaId: string;
  druzynaNazwa?: string;
  userId: string;
  kto?: string;
  typ: TypProsby;
  zawodnikId?: string;
  zawodnikImie?: string;
  imie?: string;
  createdAt: string;
}

const BRAK_MIGRACJI = 'Prośby do drużyny jeszcze nie działają na tej bazie (brak migracji 186).';

function blad(error: { code?: string; message: string }): Error {
  if (error.code === 'PGRST202' || error.code === '42P01' || error.code === 'PGRST205') return new Error(BRAK_MIGRACJI);
  return new Error(error.message);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toProsba(r: any): ProsbaDoDruzyny {
  return {
    id: r.id,
    turniejId: r.turniej_id,
    druzynaId: r.druzyna_id,
    druzynaNazwa: r.druzyna?.nazwa ?? undefined,
    userId: r.user_id,
    typ: r.typ,
    zawodnikId: r.zawodnik_id ?? undefined,
    zawodnikImie: r.zawodnik?.imie ?? undefined,
    imie: r.imie ?? undefined,
    createdAt: r.created_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Czekające prośby w turnieju widoczne dla zalogowanego (RLS), z imionami autorów. */
async function czekajace(turniejId: string): Promise<ProsbaDoDruzyny[]> {
  const { data, error } = await supabase
    .from('turniej_prosby')
    .select('*, druzyna:turniej_druzyny(nazwa), zawodnik:turniej_zawodnicy(imie)')
    .eq('turniej_id', turniejId)
    .eq('status', 'czeka')
    .order('created_at');
  if (error) throw blad(error);
  const lista = (data ?? []).map(toProsba);
  const ids = Array.from(new Set(lista.map((p) => p.userId)));
  if (ids.length > 0) {
    const { data: profile } = await supabase.from('profiles').select('id, display_name').in('id', ids);
    const imiona = new Map((profile ?? []).map((p) => [p.id as string, (p.display_name as string | null) ?? '']));
    for (const p of lista) p.kto = imiona.get(p.userId)?.trim() || p.imie || 'Gracz';
  }
  return lista;
}

/** Prośby, które zalogowany może rozpatrzyć (cudze). Bez migracji: pusto. */
export async function getProsbyDoRozpatrzenia(turniejId: string, userId: string): Promise<ProsbaDoDruzyny[]> {
  try {
    return (await czekajace(turniejId)).filter((p) => p.userId !== userId);
  } catch {
    return [];
  }
}

/** Moje czekające prośby w turnieju (do pokazania „Prośba wysłana”). */
export async function getMojeProsby(turniejId: string, userId: string): Promise<ProsbaDoDruzyny[]> {
  try {
    return (await czekajace(turniejId)).filter((p) => p.userId === userId);
  } catch {
    return [];
  }
}

export async function zlozProsbe(
  druzynaId: string, typ: TypProsby, opcje: { zawodnikId?: string; imie?: string } = {},
): Promise<void> {
  const { error } = await supabase.rpc('zloz_prosbe_do_druzyny', {
    p_druzyna: druzynaId, p_typ: typ, p_zawodnik: opcje.zawodnikId ?? null, p_imie: opcje.imie ?? null,
  });
  if (error) throw blad(error);
}

/** „To ja” BEZ zatwierdzenia (migracja `198`): zawodnik dopisany bez konta
 *  zostaje od razu przypięty do konta wołającego. Daje wyłącznie przypisanie
 *  goli i kartek, nie kapitanat: edycja składu dalej wymaga zatwierdzenia.
 *  Zwraca id drużyny, żeby od razu na nią przejść. */
export async function przejmijWpis(zawodnikId: string): Promise<string> {
  const { data, error } = await supabase.rpc('przejmij_wpis_zawodnika', { p_zawodnik: zawodnikId });
  if (error) throw blad(error);
  return data as string;
}

/** Kapitan albo organizator cofa przypięcie konta do wpisu (migracja `198`).
 *  Wpis (z golami) zostaje, znika tylko konto. */
export async function odlaczKonto(zawodnikId: string): Promise<void> {
  const { error } = await supabase.rpc('odlacz_konto_zawodnika', { p_zawodnik: zawodnikId });
  if (error) throw blad(error);
}

/** Autor cofa własną, jeszcze czekającą prośbę (188). */
export async function anulujProsbe(prosbaId: string): Promise<void> {
  const { error } = await supabase.rpc('anuluj_prosbe_do_druzyny', { p_prosba: prosbaId });
  if (error) throw blad(error);
}

export async function rozpatrzProsbe(prosbaId: string, przyjmij: boolean): Promise<void> {
  const { error } = await supabase.rpc('rozpatrz_prosbe_do_druzyny', { p_prosba: prosbaId, p_przyjmij: przyjmij });
  if (error) throw blad(error);
}

/** Jedno zdanie o prośbie dla kapitana: „Kasia chce dołączyć”. */
export function opisProsby(p: Pick<ProsbaDoDruzyny, 'typ' | 'kto' | 'zawodnikImie' | 'druzynaNazwa'>): string {
  const kto = p.kto || 'Gracz';
  if (p.typ === 'to_ja') return `${kto} mówi „to ja” przy zawodniku ${p.zawodnikImie ?? 'bez konta'}`;
  if (p.typ === 'kapitan') return `${kto} chce być kapitanem`;
  if (p.typ === 'wycofanie') return `Kapitan (${kto}) prosi o wycofanie drużyny${p.druzynaNazwa ? ` ${p.druzynaNazwa}` : ''} z turnieju`;
  return `${kto} chce dołączyć do składu`;
}
