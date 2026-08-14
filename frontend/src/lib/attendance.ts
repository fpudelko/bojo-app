// Oznaczanie nieobecności przez organizatora — zapisuje do `player_reports`
// (report_type = 'nie_przyszedl'), tabeli istniejącej od migracji 011.
// get_player_stats() (migracja 074) już agreguje te wiersze w `no_shows`,
// wyświetlane na /gracz/[id] jako pasek frekwencji i plakietka "Niezawodny" —
// tu dopisujemy jedyny brakujący element: zapis.
import { supabase } from './supabase';

export interface NieobecnyWpis {
  reportId: string;
  reportedParticipantId: string;
}

/** Kto ma już zgłoszoną nieobecność na tym meczu. */
export async function getNieobecni(eventId: string): Promise<NieobecnyWpis[]> {
  const { data, error } = await supabase
    .from('player_reports')
    .select('id, reported_participant_id')
    .eq('event_id', eventId)
    .eq('report_type', 'nie_przyszedl');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ reportId: r.id, reportedParticipantId: r.reported_participant_id }));
}

export async function oznaczNieobecnosc(eventId: string, participantId: string): Promise<void> {
  const { error } = await supabase
    .from('player_reports')
    .insert({ event_id: eventId, reported_participant_id: participantId, report_type: 'nie_przyszedl' });
  if (error) throw new Error(error.message);
}

export async function cofnijNieobecnosc(reportId: string): Promise<void> {
  const { error } = await supabase.from('player_reports').delete().eq('id', reportId);
  if (error) throw new Error(error.message);
}
