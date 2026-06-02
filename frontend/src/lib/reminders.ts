import { supabase } from './supabase';
import { sanitizeDescription } from './validation';
import type { EventReminder, ReminderChannel } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toReminder(row: any): EventReminder {
  return {
    id: row.id,
    eventId: row.event_id,
    offsetMinutes: row.offset_minutes,
    message: row.message ?? undefined,
    channel: row.channel as ReminderChannel,
    sent: row.sent,
    sentAt: row.sent_at ?? undefined,
    createdAt: row.created_at,
  };
}

export async function getEventReminders(eventId: string): Promise<EventReminder[]> {
  const { data, error } = await supabase
    .from('event_reminders')
    .select('*')
    .eq('event_id', eventId)
    .order('offset_minutes', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toReminder);
}

export interface AddReminderOptions {
  offsetMinutes: number;
  message?: string;
  channel: ReminderChannel;
}

export async function addReminder(eventId: string, opts: AddReminderOptions): Promise<EventReminder> {
  const safeMessage = opts.message ? sanitizeDescription(opts.message) : null;
  const { data, error } = await supabase
    .from('event_reminders')
    .insert({
      event_id: eventId,
      offset_minutes: Math.max(1, Math.round(opts.offsetMinutes)),
      message: safeMessage,
      channel: opts.channel,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toReminder(data);
}

export async function deleteReminder(reminderId: string): Promise<void> {
  const { error } = await supabase
    .from('event_reminders')
    .delete()
    .eq('id', reminderId);
  if (error) throw new Error(error.message);
}
