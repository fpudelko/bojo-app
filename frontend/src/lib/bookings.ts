import { supabase } from './supabase';
import type { VenueSchedule, VenuePricing, Booking, TimeSlot } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toVenueSchedule(row: any): VenueSchedule {
  return {
    id: row.id,
    fieldId: row.field_id,
    dayOfWeek: row.day_of_week,
    openTime: row.open_time,
    closeTime: row.close_time,
    slotMinutes: row.slot_minutes,
    createdAt: row.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toVenuePricing(row: any): VenuePricing {
  return {
    id: row.id,
    fieldId: row.field_id,
    name: row.name,
    priceGrosze: row.price_grosz,
    dayOfWeek: row.day_of_week ?? undefined,
    timeFrom: row.time_from ?? undefined,
    timeTo: row.time_to ?? undefined,
    priority: row.priority,
    createdAt: row.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toBooking(row: any): Booking {
  return {
    id: row.id,
    fieldId: row.field_id,
    userId: row.user_id,
    userName: row.user_name,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    priceGrosze: row.price_grosz,
    status: row.status,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export async function getVenueSchedules(fieldId: string): Promise<VenueSchedule[]> {
  const { data, error } = await supabase
    .from('venue_schedules')
    .select('*')
    .eq('field_id', fieldId)
    .order('day_of_week', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toVenueSchedule);
}

export async function saveVenueSchedules(
  fieldId: string,
  schedules: Array<{
    dayOfWeek: number;
    openTime: string;
    closeTime: string;
    slotMinutes: number;
  }>,
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('venue_schedules')
    .delete()
    .eq('field_id', fieldId);
  if (deleteError) throw new Error(deleteError.message);

  if (schedules.length === 0) return;

  const rows = schedules.map((s) => ({
    field_id: fieldId,
    day_of_week: s.dayOfWeek,
    open_time: s.openTime,
    close_time: s.closeTime,
    slot_minutes: s.slotMinutes,
  }));

  const { error } = await supabase.from('venue_schedules').insert(rows);
  if (error) throw new Error(error.message);
}

export async function getVenuePricing(fieldId: string): Promise<VenuePricing[]> {
  const { data, error } = await supabase
    .from('venue_pricing')
    .select('*')
    .eq('field_id', fieldId)
    .order('priority', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toVenuePricing);
}

export async function saveVenuePricing(
  fieldId: string,
  rules: Array<Omit<VenuePricing, 'id' | 'fieldId' | 'createdAt'>>,
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('venue_pricing')
    .delete()
    .eq('field_id', fieldId);
  if (deleteError) throw new Error(deleteError.message);

  if (rules.length === 0) return;

  const rows = rules.map((r) => ({
    field_id: fieldId,
    name: r.name,
    price_grosz: r.priceGrosze,
    day_of_week: r.dayOfWeek ?? null,
    time_from: r.timeFrom ?? null,
    time_to: r.timeTo ?? null,
    priority: r.priority,
  }));

  const { error } = await supabase.from('venue_pricing').insert(rows);
  if (error) throw new Error(error.message);
}

export async function getBookingsForDate(fieldId: string, date: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('field_id', fieldId)
    .eq('date', date)
    .neq('status', 'cancelled');
  if (error) throw new Error(error.message);
  return (data ?? []).map(toBooking);
}

export async function getAvailableSlots(fieldId: string, date: string): Promise<TimeSlot[]> {
  const [schedules, pricing, bookings] = await Promise.all([
    getVenueSchedules(fieldId),
    getVenuePricing(fieldId),
    getBookingsForDate(fieldId, date),
  ]);

  const jsDay = new Date(date).getDay();
  const isoDay = jsDay === 0 ? 7 : jsDay;

  const schedule = schedules.find((s) => s.dayOfWeek === isoDay);
  if (!schedule) return [];

  const openMinutes = timeToMinutes(schedule.openTime);
  const closeMinutes = timeToMinutes(schedule.closeTime);
  const step = schedule.slotMinutes;

  const slots: TimeSlot[] = [];

  for (let start = openMinutes; start + step <= closeMinutes; start += step) {
    const end = start + step;
    const startTime = minutesToTime(start);
    const endTime = minutesToTime(end);

    const matchingRule = pricing
      .filter((rule) => {
        const dayMatches =
          rule.dayOfWeek == null || rule.dayOfWeek.includes(isoDay);
        const timeFromMatches =
          rule.timeFrom == null || timeToMinutes(rule.timeFrom) <= start;
        const timeToMatches =
          rule.timeTo == null || start < timeToMinutes(rule.timeTo);
        return dayMatches && timeFromMatches && timeToMatches;
      })
      .sort((a, b) => b.priority - a.priority)[0];

    const priceGrosze = matchingRule?.priceGrosze ?? 0;

    const available = !bookings.some((b) => {
      const bStart = timeToMinutes(b.startTime);
      const bEnd = timeToMinutes(b.endTime);
      return bStart < end && bEnd > start;
    });

    slots.push({ startTime, endTime, priceGrosze, available });
  }

  return slots;
}

export async function createBooking(
  fieldId: string,
  userId: string,
  userName: string,
  date: string,
  startTime: string,
  endTime: string,
  priceGrosze: number,
  notes?: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      field_id: fieldId,
      user_id: userId,
      user_name: userName,
      date,
      start_time: startTime,
      end_time: endTime,
      price_grosz: priceGrosze,
      status: 'pending',
      notes: notes ?? null,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function updateBookingStatus(
  bookingId: string,
  status: 'confirmed' | 'cancelled',
): Promise<void> {
  const { error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', bookingId);
  if (error) throw new Error(error.message);
}

export async function getMyBookings(
  userId: string,
): Promise<(Booking & { fieldName: string })[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, fields(name)')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    ...toBooking(row),
    fieldName: row.fields?.name ?? '',
  }));
}

export async function getFieldBookings(
  fieldId: string,
): Promise<(Booking & { fieldName: string })[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, fields(name)')
    .eq('field_id', fieldId)
    .order('date', { ascending: false })
    .order('start_time', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    ...toBooking(row),
    fieldName: row.fields?.name ?? '',
  }));
}
