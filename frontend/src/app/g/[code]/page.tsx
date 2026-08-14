import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import ZaproszenieClient from './ZaproszenieClient';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

async function nacytajZaproszenie(rawCode: string) {
  const code = rawCode.toUpperCase().trim();

  const { data: group } = await supabaseAdmin
    .from('groups')
    .select('*, group_members(id)')
    .eq('join_code', code)
    .maybeSingle();
  if (!group) return null;

  const dzis = new Date().toISOString().slice(0, 10);
  const [{ data: nextRows }, { count: totalMatches }] = await Promise.all([
    supabaseAdmin
      .from('events')
      .select('event_date, event_time, field_name, max_players, event_participants(id, is_reserve, pending_approval)')
      .eq('group_id', group.id)
      .neq('status', 'cancelled')
      .gte('event_date', dzis)
      .order('event_date', { ascending: true })
      .order('event_time', { ascending: true })
      .limit(1),
    supabaseAdmin
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', group.id)
      .neq('status', 'cancelled')
      .lt('event_date', dzis),
  ]);

  const nextRow = nextRows?.[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nextEvent = nextRow ? {
    date: nextRow.event_date as string,
    time: (nextRow.event_time as string).slice(0, 5),
    fieldName: (nextRow.field_name as string) ?? undefined,
    maxPlayers: nextRow.max_players as number,
    participantsCount: Array.isArray(nextRow.event_participants)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (nextRow.event_participants as any[]).filter((p) => !p.is_reserve && !p.pending_approval).length
      : 0,
  } : undefined;

  return {
    group: {
      id: group.id as string,
      name: group.name as string,
      sport: (group.sport as string) ?? undefined,
      city: (group.city as string) ?? undefined,
      fieldName: (group.field_name as string) ?? undefined,
      coverImageUrl: (group.cover_image_url as string) ?? undefined,
      joinCode: group.join_code as string,
      memberCount: Array.isArray(group.group_members) ? group.group_members.length : 0,
      createdAt: group.created_at as string,
    },
    nextEvent,
    totalMatches: totalMatches ?? 0,
  };
}

/** Kto zaprasza — TYLKO gdy `?od=` naprawdę należy do grupy (baza sprawdza to
 *  samo przy dołączeniu, migracja `094`). Podrobiony parametr pokaże w
 *  najgorszym razie niewłaściwe imię członka — nieszkodliwe. */
async function nazwaZapraszajacego(groupId: string, od: string | undefined) {
  if (!od) return undefined;
  const { data: member } = await supabaseAdmin
    .from('group_members').select('user_id').eq('group_id', groupId).eq('user_id', od).maybeSingle();
  if (!member) return undefined;
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('display_name').eq('id', od).maybeSingle();
  return profile?.display_name ?? undefined;
}

/** Strona jest celem linku wklejanego na Messengera/WhatsAppie — OG-podgląd
 *  robi połowę roboty przy konwersji. `robots: noindex`: to zaproszenie, nie
 *  treść do wyszukania. */
export async function generateMetadata({ params }: { params: { code: string } }): Promise<Metadata> {
  try {
    const dane = await nacytajZaproszenie(params.code);
    if (!dane) return { title: 'Zaproszenie — Bojo', robots: { index: false, follow: false } };
    const title = `Dołącz do ekipy ${dane.group.name} w Bojo`;
    const description = 'Terminy, skład na żywo i rozliczenia w jednym miejscu — zamiast liczenia plusów w czacie.';
    return {
      title, description,
      robots: { index: false, follow: false },
      openGraph: { title, description },
    };
  } catch {
    return { title: 'Zaproszenie — Bojo', robots: { index: false, follow: false } };
  }
}

export default async function GroupInvitePage({
  params, searchParams,
}: {
  params: { code: string };
  searchParams: { od?: string };
}) {
  const dane = await nacytajZaproszenie(params.code);
  if (!dane) notFound();

  const inviterName = await nazwaZapraszajacego(dane.group.id, searchParams.od);

  return (
    <ZaproszenieClient
      code={dane.group.joinCode}
      group={dane.group}
      nextEvent={dane.nextEvent}
      totalMatches={dane.totalMatches}
      inviterName={inviterName}
      od={searchParams.od}
    />
  );
}
