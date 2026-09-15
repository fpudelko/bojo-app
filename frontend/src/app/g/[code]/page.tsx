import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import ZaproszenieClient from './ZaproszenieClient';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

/**
 * Wszystko o ekipie, do której ktoś jest zapraszany — JEDNYM zapytaniem, przez
 * `podglad_zaproszenia_do_grupy()` (migracja `150`).
 *
 * Wcześniej ta funkcja czytała `groups`, `group_members` i `events` wprost,
 * kluczem `anon`. Od `150` żadnej z tych trzech tabel ten klucz nie przeczyta
 * — ekipa jest prywatna. Uprawnieniem jest tu sam KOD, dokładnie jak
 * `claim_token` przy wpisie gościa: kto go ma, dostaje wizytówkę. Wizytówkę,
 * nie skład: liczba osób, najbliższy termin, liczba rozegranych meczów.
 */
async function nacytajZaproszenie(rawCode: string, od?: string) {
  const code = rawCode.toUpperCase().trim();

  const { data } = await supabaseAdmin.rpc('podglad_zaproszenia_do_grupy', {
    p_code: code,
    p_od: od ?? null,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  const nextEvent = row.next_date ? {
    date: row.next_date as string,
    time: (row.next_time as string).slice(0, 5),
    fieldName: (row.next_field_name as string) ?? undefined,
    maxPlayers: row.next_max_players as number,
    participantsCount: (row.next_taken as number) ?? 0,
  } : undefined;

  return {
    group: {
      id: row.id as string,
      name: row.name as string,
      sport: (row.sport as string) ?? undefined,
      city: (row.city as string) ?? undefined,
      fieldName: (row.field_name as string) ?? undefined,
      coverImageUrl: (row.cover_image_url as string) ?? undefined,
      joinCode: row.join_code as string,
      memberCount: (row.member_count as number) ?? 0,
      createdAt: row.created_at as string,
    },
    nextEvent,
    totalMatches: (row.matches_played as number) ?? 0,
    inviterName: (row.inviter_name as string) ?? undefined,
  };
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
  const dane = await nacytajZaproszenie(params.code, searchParams.od);
  if (!dane) notFound();

  return (
    <ZaproszenieClient
      code={dane.group.joinCode}
      group={dane.group}
      nextEvent={dane.nextEvent}
      totalMatches={dane.totalMatches}
      inviterName={dane.inviterName}
      od={searchParams.od}
    />
  );
}
