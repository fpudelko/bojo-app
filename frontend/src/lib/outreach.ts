import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Outreach CRM — types
// ---------------------------------------------------------------------------

export type OutreachStatus =
  | 'nowy'
  | 'do_kontaktu'
  | 'w_toku'
  | 'czeka_na_odpowiedz'
  | 'odpowiedzial'
  | 'zainteresowany'
  | 'umowiony'
  | 'odrzucony'
  | 'brak_kontaktu';

export type BookingSystem =
  | 'nieznany'
  | 'telefon'
  | 'email'
  | 'wlasny_system'
  | 'zewnetrzny'
  | 'brak'
  | 'inny';

export interface Outreach {
  fieldId: string;
  status: OutreachStatus;
  bookingSystem: BookingSystem;
  priority: number;
  assignedTo?: string;
  assignedName?: string;
  contactPerson?: string;
  notes?: string;
  lastContactedAt?: string;
  nextFollowupAt?: string;
  aiSummary?: string;
  aiEnrichedAt?: string;
  bookingUrl?: string;
  bookingProvider?: string;
  updatedBy?: string;
  updatedByName?: string;
  updatedAt?: string;
}

// Patch = the subset a user edits in the panel.
export type OutreachPatch = Partial<
  Pick<
    Outreach,
    | 'status'
    | 'bookingSystem'
    | 'priority'
    | 'assignedTo'
    | 'assignedName'
    | 'contactPerson'
    | 'notes'
    | 'lastContactedAt'
    | 'nextFollowupAt'
  >
>;

// ---------------------------------------------------------------------------
// Labels (display) — single source of truth for the UI
// ---------------------------------------------------------------------------

export const STATUS_META: Record<OutreachStatus, { label: string; cls: string }> = {
  nowy:               { label: 'Nowy',               cls: 'bg-gray-100 text-gray-600' },
  do_kontaktu:        { label: 'Do kontaktu',        cls: 'bg-blue-100 text-blue-700' },
  w_toku:             { label: 'W toku',             cls: 'bg-indigo-100 text-indigo-700' },
  czeka_na_odpowiedz: { label: 'Czeka na odpowiedź', cls: 'bg-amber-100 text-amber-700' },
  odpowiedzial:       { label: 'Odpowiedział',       cls: 'bg-cyan-100 text-cyan-700' },
  zainteresowany:     { label: 'Zainteresowany',     cls: 'bg-emerald-100 text-emerald-700' },
  umowiony:           { label: 'Umówiony ✓',         cls: 'bg-green-600 text-white' },
  odrzucony:          { label: 'Odrzucony',          cls: 'bg-rose-100 text-rose-700' },
  brak_kontaktu:      { label: 'Brak kontaktu',      cls: 'bg-gray-200 text-gray-500' },
};

export const STATUS_ORDER: OutreachStatus[] = [
  'nowy',
  'do_kontaktu',
  'w_toku',
  'czeka_na_odpowiedz',
  'odpowiedzial',
  'zainteresowany',
  'umowiony',
  'odrzucony',
  'brak_kontaktu',
];

export const BOOKING_SYSTEM_META: Record<BookingSystem, string> = {
  nieznany:      'Nieznany',
  telefon:       'Telefon',
  email:         'E-mail',
  wlasny_system: 'Własny system',
  zewnetrzny:    'Zewnętrzny',
  brak:          'Brak / z marszu',
  inny:          'Inny',
};

export const BOOKING_SYSTEM_ORDER: BookingSystem[] = [
  'nieznany',
  'telefon',
  'email',
  'wlasny_system',
  'zewnetrzny',
  'brak',
  'inny',
];

// ---------------------------------------------------------------------------
// Mappers (DB snake_case ↔ TS camelCase)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toOutreach(row: any): Outreach {
  return {
    fieldId: row.field_id,
    status: row.status,
    bookingSystem: row.booking_system,
    priority: row.priority ?? 0,
    assignedTo: row.assigned_to ?? undefined,
    assignedName: row.assigned_name ?? undefined,
    contactPerson: row.contact_person ?? undefined,
    notes: row.notes ?? undefined,
    lastContactedAt: row.last_contacted_at ?? undefined,
    nextFollowupAt: row.next_followup_at ?? undefined,
    aiSummary: row.ai_summary ?? undefined,
    aiEnrichedAt: row.ai_enriched_at ?? undefined,
    bookingUrl: row.booking_url ?? undefined,
    bookingProvider: row.booking_provider ?? undefined,
    updatedBy: row.updated_by ?? undefined,
    updatedByName: row.updated_by_name ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Fetch all outreach rows, keyed by field_id for easy merge with fields. */
export async function getOutreachMap(): Promise<Map<string, Outreach>> {
  const { data, error } = await supabase.from('field_outreach').select('*');
  if (error) throw new Error(error.message);
  const map = new Map<string, Outreach>();
  for (const row of data ?? []) map.set(row.field_id, toOutreach(row));
  return map;
}

/**
 * Upsert a patch for a field's outreach record, stamping who/when.
 * Returns the saved row so the caller can update local state.
 */
export async function saveOutreach(
  fieldId: string,
  patch: OutreachPatch,
  editor: { id: string; name: string },
): Promise<Outreach> {
  const payload: Record<string, unknown> = {
    field_id: fieldId,
    updated_by: editor.id,
    updated_by_name: editor.name,
    updated_at: new Date().toISOString(),
  };
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.bookingSystem !== undefined) payload.booking_system = patch.bookingSystem;
  if (patch.priority !== undefined) payload.priority = patch.priority;
  if (patch.assignedTo !== undefined) payload.assigned_to = patch.assignedTo;
  if (patch.assignedName !== undefined) payload.assigned_name = patch.assignedName;
  if (patch.contactPerson !== undefined) payload.contact_person = patch.contactPerson || null;
  if (patch.notes !== undefined) payload.notes = patch.notes || null;
  if (patch.lastContactedAt !== undefined) payload.last_contacted_at = patch.lastContactedAt;
  if (patch.nextFollowupAt !== undefined) payload.next_followup_at = patch.nextFollowupAt || null;

  const { data, error } = await supabase
    .from('field_outreach')
    .upsert(payload, { onConflict: 'field_id' })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return toOutreach(data);
}
