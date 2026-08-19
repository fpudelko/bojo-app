import { supabase } from './supabase';
import { validateName, sanitizeDescription, sanitizeAddress } from './validation';
import { logActivity } from './activityLog';
import { track } from './analytics';
import { zaktualizujJedenWiersz } from './zapytania';
import type { EventCreate, EventItem, EventParticipant, Visibility, EventStatus, PaymentMethod, SportsCardProvider } from '@/types';

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toEvent(row: any): EventItem {
  return {
    id: row.id,
    organizerId: row.organizer_id,
    organizerName: row.organizer_name,
    sport: row.sport,
    fieldId: row.field_id ?? undefined,
    fieldName: row.field_name,
    lat: row.lat != null ? Number(row.lat) : undefined,
    lng: row.lng != null ? Number(row.lng) : undefined,
    title: row.title ?? undefined,
    description: row.description ?? undefined,
    date: row.event_date,
    time: row.event_time,
    endTime: row.end_time ?? undefined,
    maxPlayers: row.max_players,
    minPlayers: row.min_players ?? undefined,
    participantsCount: Array.isArray(row.event_participants)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (row.event_participants as any[]).filter((p) => !p.is_reserve && !p.pending_approval).length
      : undefined,
    pendingApprovalCount: Array.isArray(row.event_participants)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (row.event_participants as any[]).filter((p) => p.pending_approval).length
      : undefined,
    unpaidCount: Array.isArray(row.event_participants)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (row.event_participants as any[]).filter((p) => !p.is_reserve && !p.pending_approval && !p.has_paid).length
      : undefined,
    visibility: row.visibility,
    createdAt: row.created_at,
    requireSmsConfirmation: row.require_sms_confirmation ?? false,
    teamMode: row.team_mode ?? 'brak',
    trackPayments: row.track_payments ?? false,
    showPaymentStatus: row.show_payment_status ?? false,
    trackResults: row.track_results ?? false,
    confirmationDeadlineH: row.confirmation_deadline_h ?? 24,
    costGrosze: row.cost_grosz ?? 0,
    teamsPublished: row.teams_published ?? false,
    allowGuestAdds: row.allow_guest_adds ?? false,
    joinCode: row.join_code ?? '',
    requireApproval: row.require_approval ?? false,
    maxGoalkeepers: row.max_goalkeepers ?? 2,
    goalkeeperSlotsReserved: row.goalkeeper_slots_reserved ?? true,
    goalkeepersEnabled: row.goalkeepers_enabled ?? false,
    reserveClaimHours: row.reserve_claim_hours ?? 3,
    acceptedPaymentMethods: row.accepted_payment_methods ?? [],
    blikPhone: row.blik_phone ?? undefined,
    acceptedSportsCards: row.accepted_sports_cards ?? [],
    sportsCardDiscountGrosze: row.sports_card_discount_grosz ?? null,
    sportsCardOtherName: row.sports_card_other_name ?? undefined,
    status: (row.status ?? 'active') as EventStatus,
    customLocationName: row.custom_location_name ?? undefined,
    customAddress: row.custom_address ?? undefined,
    fieldAddress: row.field_address ?? undefined,
    district: row.field_district ?? undefined,
    groupId: row.group_id ?? undefined,
    recurringEventId: row.recurring_event_id ?? undefined,
    coverImageUrl: row.cover_image_url ?? undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toParticipant(row: any): EventParticipant {
  return {
    id: row.id,
    eventId: row.event_id,
    userId: row.user_id ?? undefined,
    name: row.name,
    isGuest: row.is_guest,
    hasPaid: row.has_paid ?? false,
    isReserve: row.is_reserve ?? false,
    createdAt: row.created_at,
    zapisanoAt: row.zapisano_at ?? undefined,
    avatarUrl: row.avatarUrl ?? undefined,
    team: row.team ?? undefined,
    paidAmount: row.paid_amount ?? 0,
    phone: row.phone ?? undefined,
    isCaptain: row.is_captain ?? false,
    claimToken: row.claim_token ?? undefined,
    addedBy: row.added_by ?? undefined,
    isGoalkeeper: row.is_goalkeeper ?? false,
    pendingApproval: row.pending_approval ?? false,
    rsvp: row.rsvp ?? 'yes',
    claimOfferedAt: row.claim_offered_at ?? undefined,
    claimPassed: row.claim_passed ?? false,
    paymentMethod: row.payment_method ?? undefined,
    hasSportsCard: row.has_sports_card ?? false,
    sportsCardProvider: row.sports_card_provider ?? undefined,
  };
}

/** Moment, od którego liczy się miejsce w kolejce rezerwowej. Osobny od
 *  `createdAt`, bo wiersz obserwującego („Obserwuję") powstaje wcześniej niż
 *  prawdziwy zapis — patrz migracja `110`. Fallback na `createdAt` obsługuje
 *  bazę bez tej migracji: zachowanie jest wtedy dokładnie takie jak przed nią. */
export function momentZapisu(p: { zapisanoAt?: string; createdAt?: string }): string {
  return p.zapisanoAt ?? p.createdAt ?? '';
}

// ---------------------------------------------------------------------------
// Events — CRUD
// ---------------------------------------------------------------------------

export async function createEvent(
  data: EventCreate,
  organizerId: string,
  organizerName: string,
  organizerParticipates = true,
  organizerIsGoalkeeper = false,
): Promise<string> {
  // A match can't start in the past (covers UI bypass + repeat-into-past).
  try {
    const [y, m, d] = data.date.split('-').map(Number);
    const [h, min] = (data.time || '00:00').split(':').map(Number);
    if (new Date(y, m - 1, d, h, min).getTime() <= Date.now()) {
      throw new Error('Mecz nie może zaczynać się w przeszłości.');
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('przeszłości')) throw e;
    // unparseable date → let downstream validation handle it
  }

  // Rate limit: max 10 events per hour per user
  const { data: allowed } = await supabase.rpc('check_rate_limit', {
    p_action: 'create_event',
    p_max_per_hour: 10,
  });
  if (allowed === false) throw new Error('Tworzysz zbyt wiele wydarzeń. Spróbuj za chwilę.');

  // Validate & sanitize inputs
  const safeOrganizerName = validateName(organizerName, 'Nazwa organizatora', 80);
  const safeFieldName = validateName(data.fieldName, 'Nazwa miejsca', 100);
  const safeTitle = data.title ? sanitizeDescription(data.title).slice(0, 80) : undefined;
  const safeDesc = data.description ? sanitizeDescription(data.description) : undefined;
  const safeCustomName = data.customLocationName ? sanitizeAddress(data.customLocationName) : undefined;
  const safeCustomAddress = data.customAddress ? sanitizeAddress(data.customAddress) : undefined;

  const { data: row, error } = await supabase
    .from('events')
    .insert({
      organizer_id: organizerId,
      organizer_name: safeOrganizerName,
      sport: data.sport,
      field_id: data.fieldId ?? null,
      field_name: safeFieldName,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      title: safeTitle ?? null,
      description: safeDesc ?? null,
      event_date: data.date,
      event_time: data.time,
      end_time: data.endTime ?? null,
      max_players: data.maxPlayers,
      min_players: data.minPlayers ?? null,
      visibility: data.visibility,
      require_sms_confirmation: data.requireSmsConfirmation ?? false,
      team_mode: data.teamMode ?? 'brak',
      track_payments: data.trackPayments ?? false,
      show_payment_status: data.showPaymentStatus ?? false,
      track_results: data.trackResults ?? false,
      confirmation_deadline_h: data.confirmationDeadlineH ?? 24,
      cost_grosz: data.costGrosze ?? 0,
      require_approval: data.requireApproval ?? false,
      max_goalkeepers: data.maxGoalkeepers ?? 2,
      goalkeeper_slots_reserved: data.goalkeeperSlotsReserved ?? true,
      goalkeepers_enabled: data.goalkeepersEnabled ?? false,
      reserve_claim_hours: data.reserveClaimHours ?? 3,
      accepted_payment_methods: data.acceptedPaymentMethods ?? [],
      blik_phone: data.blikPhone?.trim() || null,
      accepted_sports_cards: data.acceptedSportsCards ?? [],
      sports_card_discount_grosz: data.sportsCardDiscountGrosze ?? null,
      sports_card_other_name: data.sportsCardOtherName?.trim() || null,
      group_id: data.groupId ?? null,
      recurring_event_id: data.recurringEventId ?? null,
      custom_location_name: safeCustomName ?? null,
      custom_address: safeCustomAddress ?? null,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  if (organizerParticipates) {
    // Błąd sprawdzany, nie połykany. Wcześniej wynik tego insertu leciał w
    // próżnię i awaria była całkowicie cicha: mecz powstawał, organizator nie
    // trafiał do składu, nikt nie widział dlaczego. Dokładnie tak objawiła się
    // regresja po migracji `064` (wysyłana kolumna `status` już nie istniała).
    //
    // Skład jest tu jeszcze PUSTY, więc reguła z `czy_na_rezerwe()` sprowadza
    // się do jednego pytania: czy limit miejsc w tej roli w ogóle jest
    // większy od zera. Pytanie bazy o pustą tabelę byłoby zapytaniem po nic —
    // ale warunek musi zgadzać się z regułą, więc trzyma się jej wprost.
    const limitRoli = !(data.goalkeepersEnabled ?? false)
      ? data.maxPlayers
      : organizerIsGoalkeeper
        ? (data.maxGoalkeepers ?? 2)
        : (data.goalkeeperSlotsReserved ?? true)
          ? Math.max(0, data.maxPlayers - (data.maxGoalkeepers ?? 2))
          : data.maxPlayers;
    const organiserReserve = limitRoli <= 0;
    const { error: bladUczestnika } = await supabase.from('event_participants').insert({
      event_id: row.id,
      user_id: organizerId,
      name: safeOrganizerName,
      is_guest: false,
      is_reserve: organiserReserve,
      is_goalkeeper: organizerIsGoalkeeper,
    });
    if (bladUczestnika) throw new Error(bladUczestnika.message);
  }

  const id = row.id as string;

  // Log activity (fire-and-forget)
  logActivity(id, organizerId, safeOrganizerName, 'event_created', {
    sport: data.sport,
    date: data.date,
    visibility: data.visibility,
  }).catch((e) => console.warn('[ActivityLog] event_created', e));
  track('event_created', { eventId: id, sport: data.sport, visibility: data.visibility });

  // Fire-and-forget: notify users with matching game alerts
  if (data.visibility === 'public') {
    supabase.functions.invoke('notify-game-alert', { body: { eventId: id } }).catch((e) => {
      console.warn('[notify-game-alert]', e);
    });
  }

  return id;
}

export async function updateEvent(
  id: string,
  data: EventCreate,
  actorId?: string,
  actorName?: string,
): Promise<void> {
  const { error } = await supabase
    .from('events')
    .update({
      sport: data.sport,
      field_id: data.fieldId ?? null,
      field_name: data.fieldName,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      title: data.title ?? null,
      description: data.description ?? null,
      event_date: data.date,
      event_time: data.time,
      end_time: data.endTime ?? null,
      max_players: data.maxPlayers,
      min_players: data.minPlayers ?? null,
      visibility: data.visibility,
      require_sms_confirmation: data.requireSmsConfirmation ?? false,
      team_mode: data.teamMode ?? 'brak',
      track_payments: data.trackPayments ?? false,
      show_payment_status: data.showPaymentStatus ?? false,
      track_results: data.trackResults ?? false,
      confirmation_deadline_h: data.confirmationDeadlineH ?? 24,
      cost_grosz: data.costGrosze ?? 0,
      require_approval: data.requireApproval ?? false,
      max_goalkeepers: data.maxGoalkeepers ?? 2,
      goalkeeper_slots_reserved: data.goalkeeperSlotsReserved ?? true,
      goalkeepers_enabled: data.goalkeepersEnabled ?? false,
      reserve_claim_hours: data.reserveClaimHours ?? 3,
      accepted_payment_methods: data.acceptedPaymentMethods ?? [],
      blik_phone: data.blikPhone?.trim() || null,
      accepted_sports_cards: data.acceptedSportsCards ?? [],
      sports_card_discount_grosz: data.sportsCardDiscountGrosze ?? null,
      sports_card_other_name: data.sportsCardOtherName?.trim() || null,
    })
    .eq('id', id);

  if (error) throw new Error(error.message);

  if (actorId) {
    logActivity(id, actorId, actorName ?? null, 'event_updated', { date: data.date }).catch(
      (e) => console.warn('[ActivityLog] event_updated', e),
    );
  }
}

export async function getEvent(
  id: string,
): Promise<{ event: EventItem; participants: EventParticipant[] }> {
  const { data: eventRow, error } = await supabase
    .from('events')
    .select('*, fields(address)')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);

  // Flatten the joined field address onto the row for toEvent()
  if (eventRow?.fields) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    eventRow.field_address = (eventRow.fields as any)?.address ?? null;
    delete eventRow.fields;
  }

  const { data: partRows, error: pErr } = await supabase
    .from('event_participants')
    .select('*')
    .eq('event_id', id)
    .order('is_reserve', { ascending: true })
    .order('created_at', { ascending: true });
  if (pErr) throw new Error(pErr.message);

  // Batch-fetch avatar URLs for logged-in participants
  const userIds = (partRows ?? []).filter((p) => p.user_id).map((p) => p.user_id as string);
  let avatarMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, avatar_url')
      .in('id', userIds);
    avatarMap = Object.fromEntries(
      (profileRows ?? [])
        .filter((p) => p.avatar_url)
        .map((p) => [p.id, p.avatar_url as string]),
    );
  }

  return {
    event: toEvent(eventRow),
    participants: (partRows ?? []).map((row) => ({
      ...toParticipant(row),
      avatarUrl: row.user_id ? avatarMap[row.user_id] : undefined,
    })),
  };
}

export async function getMyEvents(userId: string): Promise<EventItem[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*, event_participants(id, is_reserve, pending_approval)')
    .eq('organizer_id', userId)
    .order('event_date', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toEvent);
}

export async function getEventsByGroup(groupId: string): Promise<EventItem[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*, event_participants(id, is_reserve, pending_approval)')
    .eq('group_id', groupId)
    .order('event_date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toEvent);
}

export async function getPublicEvents(): Promise<EventItem[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*, fields(district), event_participants(id, is_reserve, pending_approval)')
    .eq('visibility', 'public')
    .gte('event_date', new Date().toISOString().slice(0, 10))
    .order('event_date', { ascending: true });
  if (error) throw new Error(error.message);
  // flatten the joined district onto the row before mapping
  return (data ?? []).map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any;
    r.field_district = r.fields?.district ?? null;
    return toEvent(r);
  });
}

/**
 * Upcoming matches from the groups I belong to — including private ones.
 *
 * Without this the only way into a group's private match is the invite link
 * someone pasted into Messenger, which people miss. Membership in the group
 * already implies the right to see its matches, so the feed shows them.
 *
 * Note this covers private matches too: `events.group_id` steers listing, and
 * being a member is what earns the listing. Visibility of a *public* match is
 * unaffected — it just also shows up here for members.
 */
export async function getMyGroupEvents(userId: string): Promise<EventItem[]> {
  const { data: memberRows, error: mErr } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);
  if (mErr) throw new Error(mErr.message);

  const groupIds = (memberRows ?? []).map((r) => r.group_id as string);
  if (groupIds.length === 0) return [];

  const { data, error } = await supabase
    .from('events')
    .select('*, fields(district), event_participants(id, is_reserve, pending_approval)')
    .in('group_id', groupIds)
    .eq('status', 'active')
    .gte('event_date', new Date().toISOString().slice(0, 10))
    .order('event_date', { ascending: true });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any;
    r.field_district = r.fields?.district ?? null;
    return toEvent(r);
  });
}

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------

export interface JoinPaymentChoice {
  method?: PaymentMethod;
  hasSportsCard?: boolean;
  sportsCardProvider?: SportsCardProvider;
}

/** Wynik zapisu — wywołujący musi wiedzieć, CZY wszedł do składu.
 *
 *  Bez tego strona meczu pokazywała zawsze „Dołączyłeś do meczu!", także
 *  wtedy, gdy zapis wylądował na rezerwie. */
export interface WynikZapisu {
  isReserve: boolean;
  pending: boolean;
}

// Były tu `confirmedCounts()` i `decydujCzyRezerwa()` — druga, równoległa
// implementacja reguły „skład czy rezerwa", obok tej w `sync_reserve_claim()`.
// Rozjazd między nimi nie dawał błędu, tylko niespójność: gracz wchodził do
// składu, a kolejka i tak trzymała go w rezerwie. Przy każdej zmianie zasad
// (limit bramkarzy w `075`, tryb rezerwacji w `077`) trzeba było pamiętać
// o obu miejscach.
//
// Od migracji `078` regułę zna wyłącznie SQL: `czy_na_rezerwe()`. TypeScript
// pyta o nią przez `czyNaRezerwe()` albo woła `dolacz_do_meczu()`, które
// decyduje i wstawia wiersz w jednej transakcji.

/** Wolne miejsca w rozbiciu na role.
 *
 *  Licznik „Zostało X wolnych miejsc" sumował obie pule, więc przy meczu
 *  z rozróżnieniem bramkarzy potrafił obiecywać miejsca, których dla danej roli
 *  już nie było: „zostały 2 miejsca" znaczyło w rzeczywistości „2 miejsca dla
 *  bramkarzy", a zawodnik z pola i tak lądował na rezerwie.
 *
 *  Czysta funkcja — liczy z listy zawodników w składzie, bez zapytań, więc da
 *  się ją przetestować i wywołać przy każdym renderze. */
export function wolneMiejscaWgRol(
  skladWSkladzie: { isGoalkeeper?: boolean }[],
  event: {
    maxPlayers: number; maxGoalkeepers?: number;
    goalkeepersEnabled?: boolean; goalkeeperSlotsReserved?: boolean;
  },
): { pole: number; bramkarze: number; razem: number; rozdzielone: boolean } {
  const zajete = skladWSkladzie.length;
  const razem = Math.max(0, event.maxPlayers - zajete);

  if (!event.goalkeepersEnabled) {
    return { pole: razem, bramkarze: 0, razem, rozdzielone: false };
  }

  const limitBramkarzy = event.maxGoalkeepers ?? 2;
  const bramkarzeWSkladzie = skladWSkladzie.filter((p) => p.isGoalkeeper).length;
  const poleWSkladzie = zajete - bramkarzeWSkladzie;
  const wolneDlaBramkarzy = Math.max(0, limitBramkarzy - bramkarzeWSkladzie);

  // Wspólna pula: wolne miejsce jest jedno i to samo dla obu ról — bramkarz
  // dodatkowo nie przekroczy własnego limitu. Nie ma tu czego „rozdzielać",
  // więc licznik nie udaje, że pule są osobne.
  if (event.goalkeeperSlotsReserved === false) {
    return {
      pole: razem,
      bramkarze: Math.min(razem, wolneDlaBramkarzy),
      razem,
      rozdzielone: false,
    };
  }

  const limitPola = Math.max(0, event.maxPlayers - limitBramkarzy);
  return {
    pole: Math.max(0, limitPola - poleWSkladzie),
    bramkarze: wolneDlaBramkarzy,
    razem,
    rozdzielone: true,
  };
}

/** Werdykt „czy gramy" — jedno miejsce z regułą progu minimum graczy (097),
 *  zamiast liczenia w głowie organizatora ("brakuje nam 1go? Dobrze liczę?").
 *  `wSkladzie` to ta sama liczba, co `participantsCount` — potwierdzeni
 *  i nierezerwowi. Brak progu (`minPlayers` puste) daje `'brak-progu'`, żeby
 *  UI nie udawał werdyktu tam, gdzie organizator go nie ustawił. */
export function werdyktGry(
  event: { minPlayers?: number },
  wSkladzie: number,
): { stan: 'gramy' | 'zagrozona' | 'brak-progu'; brakuje: number } {
  if (!event.minPlayers || event.minPlayers <= 0) return { stan: 'brak-progu', brakuje: 0 };
  const brakuje = Math.max(0, event.minPlayers - wSkladzie);
  return { stan: brakuje === 0 ? 'gramy' : 'zagrozona', brakuje };
}

/** Pyta bazę, czy zapis w tej roli trafiłby teraz na rezerwę.
 *
 *  Reguła ma jedną implementację — `czy_na_rezerwe()` z migracji `078`. Ten
 *  helper istnieje po to, żeby ścieżki, które NIE przechodzą przez
 *  `dolacz_do_meczu()` (akceptacja prośby, dopisanie gościa bez konta), też
 *  z niej korzystały, zamiast liczyć po swojemu. */
async function czyNaRezerwe(eventId: string, asGoalkeeper: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc('czy_na_rezerwe', {
    p_event_id: eventId,
    p_bramkarz: asGoalkeeper,
  });
  if (error) throw new Error(error.message);
  return !!data;
}

export async function joinEvent(
  eventId: string,
  userId: string,
  name: string,
  asGoalkeeper = false,
  payment?: JoinPaymentChoice,
): Promise<WynikZapisu> {
  // Rate limit: max 20 joins per hour
  const { data: allowed } = await supabase.rpc('check_rate_limit', {
    p_action: 'join_event',
    p_max_per_hour: 20,
  });
  if (allowed === false) throw new Error('Zbyt wiele prób dołączenia. Spróbuj za chwilę.');

  const safeName = validateName(name, 'Imię', 80);

  // Cała decyzja „skład czy rezerwa" siedzi w `dolacz_do_meczu()` (migracja
  // `078`). Wcześniej zapis był sekwencją czterech kroków po stronie
  // przeglądarki — odśwież kolejkę, wczytaj ustawienia, policz pojemność,
  // wstaw wiersz — a reguła istniała RÓWNOLEGLE w TypeScripcie i w SQL.
  // Rozjazd między nimi nie dawał błędu, tylko niespójność. Do tego między
  // liczeniem a wstawianiem mogło wejść dwóch graczy naraz i obaj dostawali
  // to samo ostatnie miejsce; teraz to jedna transakcja.
  //
  // Organizatora funkcja rozpoznaje sama po `auth.uid()`, więc znikł też
  // argument `jestemOrganizatorem` — przeglądarka nie może już skłamać.
  const { data, error } = await supabase.rpc('dolacz_do_meczu', {
    p_event_id: eventId,
    p_nazwa: safeName,
    p_bramkarz: asGoalkeeper,
    p_metoda_platnosci: payment?.method ?? null,
    p_karta_sportowa: payment?.hasSportsCard ?? false,
    p_dostawca_karty: payment?.hasSportsCard ? (payment?.sportsCardProvider ?? null) : null,
  });
  if (error) throw new Error(error.message);

  const wiersz = Array.isArray(data) ? data[0] : data;
  const wynik: WynikZapisu = {
    isReserve: !!wiersz?.is_reserve,
    pending: !!wiersz?.pending,
  };

  logActivity(eventId, userId, safeName, 'participant_joined',
    { is_reserve: wynik.isReserve, pending: wynik.pending }).catch(
    (e) => console.warn('[ActivityLog] participant_joined', e),
  );
  track('event_joined', { eventId, ...wynik });
  return wynik;
}

/** Mark event as "maybe" — adds user to participants without taking a capacity slot. */
export async function joinEventMaybe(eventId: string, userId: string, name: string): Promise<void> {
  const safeName = validateName(name, 'Imię', 80);
  const { error } = await supabase.from('event_participants').insert({
    event_id: eventId,
    user_id: userId,
    name: safeName,
    is_guest: false,
    is_reserve: true,
    rsvp: 'maybe',
  });
  if (error && !error.message.toLowerCase().includes('duplicate')) throw new Error(error.message);
}

/** Switch an existing "maybe" to a confirmed join (takes a capacity spot).
 *
 *  Rola i płatność są tu tak samo obowiązkowe jak przy zwykłym „Dołącz":
 *  obserwujący, który się decyduje, podejmuje dokładnie te same decyzje co
 *  ktoś wchodzący prosto ze składu. Wcześniej ta ścieżka ustawiała wyłącznie
 *  `rsvp` i `is_reserve`, więc gracz lądował w składzie bez pozycji i bez
 *  zadeklarowanej płatności — a organizator nie miał czego rozliczyć. */
export async function confirmFromMaybe(
  participantId: string,
  eventId: string,
  asGoalkeeper = false,
  payment?: JoinPaymentChoice,
  actor?: { userId: string; name: string },
): Promise<WynikZapisu> {
  await runSyncReserveClaim(eventId);
  const isReserve = await czyNaRezerwe(eventId, asGoalkeeper);

  await zaktualizujJedenWiersz('event_participants', participantId, {
    rsvp: 'yes',
    is_reserve: isReserve,
    is_goalkeeper: asGoalkeeper,
    payment_method: payment?.method ?? null,
    has_sports_card: payment?.hasSportsCard ?? false,
    sports_card_provider: payment?.hasSportsCard ? (payment?.sportsCardProvider ?? null) : null,
  }, 'Nie udało się potwierdzić udziału');

  // Potwierdzenie z „obserwuję" nie zostawiało dotąd żadnego śladu w dzienniku
  // — to UPDATE, nie INSERT, więc `joinEvent`-owy `logActivity` po prostu nie
  // biegł na tej ścieżce.
  if (actor) {
    logActivity(eventId, actor.userId, actor.name, 'participant_joined',
      { is_reserve: isReserve, pending: false }).catch(
      (e) => console.warn('[ActivityLog] participant_joined', e),
    );
  }

  return { isReserve, pending: false };
}

/** Adds a guest (no account) to the roster. When the event is full, the guest
 *  lands on the reserve list automatically. Returns whether they were placed on
 *  the reserve so the UI can inform the organizer, plus the new row's id and
 *  claim_token (auto-generated by `trg_nadaj_token_gosciowi`, migration 066)
 *  so the caller can immediately offer the "invite to Bojo" share action. */
export async function addGuest(
  eventId: string,
  name: string,
  isReserve = false,
  addedByUserId?: string,
  asGoalkeeper = false,
): Promise<{ id: string; claimToken: string; isReserve: boolean }> {
  const safeName = validateName(name, 'Imię gościa', 80);

  // If not explicitly added to reserve, check capacity and overflow to reserve
  // when the event is full (mirrors joinEvent so the roster never exceeds limit).
  let reserve = isReserve;
  if (!reserve) {
    reserve = await czyNaRezerwe(eventId, asGoalkeeper);
  }

  const { data, error } = await supabase
    .from('event_participants')
    .insert({
      event_id: eventId,
      user_id: null,
      name: safeName,
      is_guest: true,
      is_reserve: reserve,
      is_goalkeeper: asGoalkeeper,
      added_by: addedByUserId ?? null,
    })
    .select('id, claim_token')
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id, claimToken: data.claim_token, isReserve: reserve };
}

/** Guest self-signup without an account: collect name, email, and optional role/payment.
 *  Returns (migration 088):
 *  - `claimToken` — token for later account linkage, or `null` when the entry already has
 *    an owner, so there is nothing left to claim and the caller should offer sign-in;
 *  - `isReserve` — whether the guest landed on the reserve list;
 *  - `alreadyJoined` — this was a repeat of an existing entry, not a fresh insert;
 *  - `hasAccount` — that e-mail already has a Bojo account, so the follow-up screen should
 *    push sign-in instead of sign-up.
 *
 *  Migrations run by hand in this repo, so the pre-088 shape (three columns, an exception
 *  instead of the owned-entry row) must keep working: `has_account` falls back to false and
 *  the thrown message is still handled by the caller. */
export async function joinEventAsGuest(
  eventId: string,
  name: string,
  email: string,
  asGoalkeeper = false,
  payment?: JoinPaymentChoice,
): Promise<{ claimToken: string | null; isReserve: boolean; alreadyJoined: boolean; hasAccount: boolean }> {
  const { validateEmail } = await import('./validation');
  const safeName = validateName(name, 'Imię i nazwisko', 80);
  const safeEmail = validateEmail(email);

  const { data, error } = await supabase.rpc('dolacz_do_meczu_jako_goscie', {
    p_event_id: eventId,
    p_imie: safeName,
    p_email: safeEmail,
    p_bramkarz: asGoalkeeper,
    p_metoda_platnosci: payment?.method ?? null,
    p_karta_sportowa: payment?.hasSportsCard ?? false,
  });

  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  const claimToken: string | null = row.claim_token ?? null;

  // Determine if guest landed on reserve by checking the database
  // (we could add it to the RPC return, but for now query it). Skipped when the entry
  // already has an owner — there is no token to look it up by, and the sign-in screen
  // shown in that case does not mention the reserve list anyway.
  let isReserve = false;
  if (claimToken) {
    const { data: participant } = await supabase
      .from('event_participants')
      .select('is_reserve')
      .eq('claim_token', claimToken)
      .single();
    isReserve = participant?.is_reserve ?? false;
  }

  return {
    claimToken,
    isReserve,
    alreadyJoined: row.already_joined ?? false,
    hasAccount: row.has_account ?? false,
  };
}

/** Best-effort queue upkeep. Never let a failure here break the caller's main
 *  action — the next page load will retry it anyway. */
async function runSyncReserveClaim(eventId: string): Promise<void> {
  try {
    await supabase.rpc('sync_reserve_claim', { p_event_id: eventId });
  } catch {
    /* ignore — idempotent, retried on next load */
  }
}

export async function removeParticipant(participantId: string): Promise<void> {
  // Deliberately NO silent auto-promotion: a freed spot is *offered* to the
  // first reserve, who must accept it themselves (see sync_reserve_claim /
  // acceptReserveClaim). Nobody ever wakes up already in the squad.
  const { data: row } = await supabase
    .from('event_participants')
    .select('event_id, user_id, name, is_reserve')
    .eq('id', participantId)
    .maybeSingle();

  const { error } = await supabase.from('event_participants').delete().eq('id', participantId);
  if (error) throw new Error(error.message);

  // Wypisanie się jest jedyną zmianą składu, która nie zostawia po sobie
  // ŻADNEGO śladu: wiersz znika i nikt nie wie, czy ktoś odpadł, czy w ogóle
  // się nie zapisał. Log jest tu jedynym miejscem, gdzie ta informacja może
  // przeżyć — `event_participants` z definicji trzyma tylko stan bieżący.
  //
  // Kto wypisał: porównanie z sesją, nie parametr wywołania. `removeParticipant`
  // obsługuje oba przypadki (sam się wypisał / organizator usunął) i wołane
  // jest z czterech miejsc — parametr rozjechałby się przy pierwszym nowym.
  if (row?.event_id) {
    // Cały zapis do dziennika w `try` kończącym się ciszą: miejsce jest już
    // zwolnione, więc awaria samego zapisu historii nie może zamienić się
    // w błąd pokazany komuś, kto właśnie się wypisał.
    try {
      const { data: sesja } = await supabase.auth.getSession();
      const ktoUsuwa = sesja.session?.user.id ?? null;
      await logActivity(
        row.event_id,
        ktoUsuwa,
        row.name ?? null,
        row.user_id && ktoUsuwa === row.user_id ? 'participant_left' : 'participant_removed',
        { byla_rezerwa: !!row.is_reserve },
      );
    } catch { /* patrz wyżej */ }
  }

  // Hand the freed spot to the queue right away, so the first reserve sees the
  // offer without waiting for someone else to open the page.
  if (row?.event_id) {
    await runSyncReserveClaim(row.event_id);
  }
}

/** Bring the reserve queue up to date: lapse expired offers, hand a free spot
 *  to the next person. Safe to call on every event-page load — idempotent. */
export async function syncReserveClaim(eventId: string): Promise<void> {
  await runSyncReserveClaim(eventId);
}

/** Reserve accepts the offered spot and joins the squad. */
export async function acceptReserveClaim(participantId: string): Promise<void> {
  await zaktualizujJedenWiersz(
    'event_participants', participantId,
    { is_reserve: false, claim_offered_at: null, claim_passed: false },
    'Nie udało się przyjąć zwolnionego miejsca',
  );
}

/** Reserve passes on the offered spot. They stay on the list (the organizer can
 *  still promote them by hand) but stop blocking the queue. */
export async function declineReserveClaim(participantId: string, eventId: string): Promise<void> {
  const { error } = await supabase
    .from('event_participants')
    .update({ claim_offered_at: null, claim_passed: true })
    .eq('id', participantId);
  if (error) throw new Error(error.message);
  await runSyncReserveClaim(eventId);
}

/**
 * Organizator przesuwa kogoś z rezerwy do składu — ręcznie, poza kolejnością.
 *
 * Kolejka rezerwowa rozdaje zwolnione miejsca sama (`sync_reserve_claim`), ale
 * tylko wtedy, gdy miejsce faktycznie się zwolniło i tylko pierwszej osobie
 * w kolejce. Organizator ma powody, których baza nie zna: ktoś przepuścił swoją
 * kolej i wrócił, ktoś dogadał się poza aplikacją, brakuje bramkarza,
 * a w kolejce stoi jedyny chętny. Bez tej ścieżki jedynym wyjściem było
 * usunięcie wpisu i dopisanie tej samej osoby od nowa — co gubi jej konto,
 * historię i deklarację płatności.
 *
 * Uprawnienie jest po stronie bazy od migracji `004` („Organizer updates
 * participants"), więc nie trzeba tu nic dokładać — brakowało wyłącznie
 * wywołania.
 *
 * Czyścimy przy okazji ślady po ofercie (`claim_offered_at`, `claim_passed`):
 * osoba w składzie nie może mieć wiszącej oferty miejsca, a `claim_passed`
 * blokowałby ją, gdyby kiedyś wróciła na rezerwę.
 */
export async function awansujZRezerwy(participantId: string, eventId: string): Promise<void> {
  await zaktualizujJedenWiersz(
    'event_participants', participantId,
    { is_reserve: false, claim_offered_at: null, claim_passed: false },
    'Nie udało się przenieść gracza do składu',
  );
  // Kolejka mogła właśnie stracić osobę, której trzymała ofertę — niech
  // przeliczy się od razu, zamiast czekać na czyjeś wejście na stronę.
  await runSyncReserveClaim(eventId);
}

/** Organizator odsyła kogoś ze składu na koniec kolejki rezerwowej.
 *
 *  Odwrotność `awansujZRezerwy()`. Bez tego jedyną drogą było usunięcie
 *  gracza — a to co innego niż „nie tym razem, ale trzymam Cię w kolejce". */
export async function cofnijNaRezerwe(participantId: string, eventId: string): Promise<void> {
  await zaktualizujJedenWiersz(
    'event_participants', participantId,
    { is_reserve: true, claim_offered_at: null, claim_passed: false },
    'Nie udało się przenieść gracza na rezerwę',
  );
  await runSyncReserveClaim(eventId);
}

export async function togglePayment(participantId: string, hasPaid: boolean): Promise<void> {
  await zaktualizujJedenWiersz(
    'event_participants', participantId, { has_paid: hasPaid },
    'Nie udało się zmienić statusu płatności',
  );
}

/** Attach an existing match to a group, or detach it (`null`).
 *
 *  Deliberately its own function rather than a field on `updateEvent`: the edit
 *  form doesn't track `groupId`, so folding it in there would silently clear the
 *  group every time someone saved the form. Allowed for the organizer and for
 *  admins (both already hold UPDATE on `events` — migracje `002` i `005`), which
 *  is what lets an admin file a match somebody created outside their group. */
export async function setEventGroup(eventId: string, groupId: string | null): Promise<void> {
  const { error } = await supabase.from('events').update({ group_id: groupId }).eq('id', eventId);
  if (error) throw new Error(error.message);
}

/**
 * Move a match to a new date/time.
 *
 * Deliberately separate from `updateEvent()`, which takes a whole `EventCreate`
 * and would silently reset every field the caller didn't supply — the same trap
 * that made `setEventGroup()` necessary. Rescheduling from the event page has to
 * touch three columns and nothing else.
 */
export async function setEventWhen(
  eventId: string,
  date: string,
  time: string,
  endTime: string | null,
  actorId?: string,
  actorName?: string,
): Promise<void> {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = (time || '00:00').split(':').map(Number);
  if (new Date(y, m - 1, d, h, min).getTime() <= Date.now()) {
    throw new Error('Mecz nie może zaczynać się w przeszłości.');
  }

  const { error } = await supabase
    .from('events')
    .update({ event_date: date, event_time: time, end_time: endTime })
    .eq('id', eventId);
  if (error) throw new Error(error.message);

  if (actorId) {
    logActivity(eventId, actorId, actorName ?? null, 'event_updated', { date, time }).catch(
      (e) => console.warn('[ActivityLog] event_updated (reschedule)', e),
    );
  }
}

export async function setVisibility(
  eventId: string,
  visibility: Visibility,
  actorId?: string,
  actorName?: string,
): Promise<void> {
  const { error } = await supabase.from('events').update({ visibility }).eq('id', eventId);
  if (error) throw new Error(error.message);
  if (actorId) {
    logActivity(eventId, actorId, actorName ?? null, 'visibility_changed', { visibility }).catch(
      (e) => console.warn('[ActivityLog] visibility_changed', e),
    );
  }
  if (visibility === 'public') {
    supabase.functions.invoke('notify-game-alert', { body: { eventId } }).catch((e) => {
      console.warn('[notify-game-alert]', e);
    });
  }
}

export async function getNearbyEvents(lat: number, lng: number, radiusKm = 5, limit = 6): Promise<EventItem[]> {
  const { data, error } = await supabase.rpc('get_nearby_events', {
    p_lat: lat, p_lng: lng, p_radius_km: radiusKm, p_limit: limit,
  });
  if (error) return [];
  return (data ?? []).map(toEvent);
}

/** Klucz w `localStorage` pod którym trzymamy „ostatnio odwiedzono listę
 *  wydarzeń" — zasila pomarańczową kropkę „nowe wydarzenia w pobliżu" przy
 *  „Znajdź grę" na dolnej nawigacji (patrz `BottomNav.tsx`). Jeden klucz,
 *  nie per-lokalizacja: to pytanie „czy byłem na /wydarzenia od czasu, jak
 *  coś nowego się pojawiło w pobliżu", nie per-miejsce śledzenie. */
export const KLUCZ_WYDARZENIA_WIDZIANO = 'bojo:wydarzenia-widziano';

/** Czy wśród pobliskich wydarzeń jest choć jedno nowsze niż ostatnio widziano
 *  — ta sama logika co `maNoweMecze()` w `groups.ts` (brak znacznika =
 *  wszystko nowe), tylko dla wydarzeń w promieniu, nie meczów jednej ekipy. */
export function maNoweWydarzeniaWPobolizu(
  events: { createdAt: string }[],
  widzianoIso: string | null,
): boolean {
  if (events.length === 0) return false;
  if (!widzianoIso) return true;
  const widziano = new Date(widzianoIso).getTime();
  if (Number.isNaN(widziano)) return true;
  return events.some((e) => new Date(e.createdAt).getTime() > widziano);
}

export async function setRequireApproval(eventId: string, value: boolean): Promise<void> {
  const { error } = await supabase.from('events').update({ require_approval: value }).eq('id', eventId);
  if (error) throw new Error(error.message);
}

/** Approve a pending join request. Decides reserve vs. regular based on the
 *  event's current free capacity at approval time. */
export async function approveParticipant(participantId: string): Promise<void> {
  const { data: part, error: pErr } = await supabase
    .from('event_participants')
    .select('event_id, is_goalkeeper')
    .eq('id', participantId)
    .single();
  if (pErr) throw new Error(pErr.message);

  const eventId = part.event_id as string;
  const asGoalkeeper = part.is_goalkeeper ?? false;

  const isReserve = await czyNaRezerwe(eventId, asGoalkeeper);

  const { error } = await supabase
    .from('event_participants')
    .update({ pending_approval: false, is_reserve: isReserve })
    .eq('id', participantId);
  if (error) throw new Error(error.message);
}

/** Czy organizator ma choć jedną nierozpatrzoną prośbę o dołączenie —
 *  w dowolnym ze swoich meczów, nie tylko na aktualnie oglądanej stronie.
 *  Zasila kropkę na zakładce "Moje" w dolnej nawigacji. */
export async function hasPendingApprovalRequests(userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('event_participants')
    .select('id, events!inner(organizer_id)', { count: 'exact', head: true })
    .eq('pending_approval', true)
    .eq('events.organizer_id', userId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/** Id-ki meczów, w których gram, jestem na rezerwie albo organizuję —
 *  świadomie BEZ „czeka na akceptację" i „obserwuję" (osobne, słabsze
 *  relacje). Lekkie zapytania (bez `select('*')`), bo zasila plakietkę
 *  „nowe wiadomości" na dolnej nawigacji, odpalaną przy każdej zmianie trasy. */
export async function getMyActiveEventIds(userId: string): Promise<string[]> {
  const { data: partRows, error: pErr } = await supabase
    .from('event_participants')
    .select('event_id, rsvp, pending_approval')
    .eq('user_id', userId);
  if (pErr) throw new Error(pErr.message);
  const grameLubRezerwa = (partRows ?? [])
    .filter((r) => !r.pending_approval && r.rsvp !== 'maybe')
    .map((r) => r.event_id as string);

  const { data: ownRows, error: oErr } = await supabase
    .from('events')
    .select('id')
    .eq('organizer_id', userId);
  if (oErr) throw new Error(oErr.message);

  return Array.from(new Set([...grameLubRezerwa, ...(ownRows ?? []).map((r) => r.id as string)]));
}

/**
 * Ile mam nadchodzących meczów — liczba na ikonie „Moje" w dolnej nawigacji.
 *
 * Liczy dokładnie to, co lista „Moje": mecze, w których gram, czekam na
 * rezerwie albo organizuję (`getMyActiveEventIds()` — bez „czeka na
 * akceptację" i bez obserwowanych), od dzisiaj w przód, bez odwołanych.
 * Liczba, której nie da się kliknąć i zobaczyć tego samego, jest gorsza niż
 * jej brak.
 *
 * `head: true` — potrzebujemy samej liczby, nie wierszy; to zapytanie leci
 * przy każdej zmianie trasy.
 */
export async function policzNadchodzaceMoje(userId: string): Promise<number> {
  const ids = await getMyActiveEventIds(userId);
  if (ids.length === 0) return 0;
  const dzis = new Date().toISOString().slice(0, 10);
  const { count, error } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .in('id', ids)
    .neq('status', 'cancelled')
    .gte('event_date', dzis);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Kto się wypisał z meczu i kiedy.
 *
 *  Czyta WYŁĄCZNIE dwa rodzaje wpisów z dziennika (`participant_left`,
 *  `participant_removed`) — reszta dziennika (płatności, zmiany ustawień)
 *  zostaje przy organizatorze. Politykę pod to dokłada migracja `101`:
 *  te dwa rodzaje widzi każdy, kto widzi mecz.
 *
 *  `user_name` z chwili wypisania, nie join do `profiles`: człowiek, który
 *  skasował konto, ma zniknąć z profili, ale wpis „wypisał się" nadal ma
 *  mówić, kogo dotyczył.
 */
export async function getWypisania(
  eventId: string,
): Promise<{ id: string; name: string; kiedy: string; przezOrganizatora: boolean }[]> {
  const { data, error } = await supabase
    .from('event_activity_log')
    .select('id, user_name, action, created_at')
    .eq('event_id', eventId)
    .in('action', ['participant_left', 'participant_removed'])
    .order('created_at', { ascending: false })
    .limit(20);
  // Cisza przy błędzie: brak historii wypisań nie może wywrócić strony meczu.
  if (error) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.user_name ?? 'Ktoś',
    kiedy: r.created_at,
    przezOrganizatora: r.action === 'participant_removed',
  }));
}

/** Reject (delete) a pending join request. */
export async function rejectParticipant(participantId: string): Promise<void> {
  const { error } = await supabase.from('event_participants').delete().eq('id', participantId);
  if (error) throw new Error(error.message);
}

export async function getEventByJoinCode(code: string): Promise<string | null> {
  const { data } = await supabase
    .from('events')
    .select('id')
    .eq('join_code', code.toUpperCase().trim())
    .maybeSingle();
  return data?.id ?? null;
}

export async function setAllowGuestAdds(eventId: string, value: boolean): Promise<void> {
  const { error } = await supabase.from('events').update({ allow_guest_adds: value }).eq('id', eventId);
  if (error) throw new Error(error.message);
}

export async function deleteEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  if (error) throw new Error(error.message);
}

export async function cancelEvent(
  eventId: string,
  actorId?: string,
  actorName?: string,
): Promise<void> {
  const { error } = await supabase.from('events').update({ status: 'cancelled' }).eq('id', eventId);
  if (error) throw new Error(error.message);
  if (actorId) {
    logActivity(eventId, actorId, actorName ?? null, 'event_cancelled').catch(
      (e) => console.warn('[ActivityLog] event_cancelled', e),
    );
  }
}

export async function restoreEvent(
  eventId: string,
  actorId?: string,
  actorName?: string,
): Promise<void> {
  const { error } = await supabase.from('events').update({ status: 'active' }).eq('id', eventId);
  if (error) throw new Error(error.message);
  if (actorId) {
    logActivity(eventId, actorId, actorName ?? null, 'event_restored').catch(
      (e) => console.warn('[ActivityLog] event_restored', e),
    );
  }
}

export async function repeatEvent(
  source: EventItem,
  newDate: string,
  newTime: string,
  organizerId: string,
  organizerName: string,
  organizerParticipates = true,
  organizerIsGoalkeeper = false,
  newEndTime?: string,
): Promise<string> {
  return createEvent(
    {
      sport: source.sport,
      fieldId: source.fieldId,
      fieldName: source.fieldName,
      lat: source.lat,
      lng: source.lng,
      title: source.title,
      description: source.description,
      date: newDate,
      time: newTime,
      // Bez `newEndTime` kopiowalibyśmy zegarową wartość źródłowego końca
      // dosłownie — przy zmianie tylko godziny startu (np. 18:00 → 10:00)
      // dawało to absurdalne długości meczu (690 minut). Wywołujący liczy
      // nowy koniec z zachowaniem oryginalnej długości (patrz modal "Powtórz
      // mecz" w `EventDetailClient.tsx`).
      endTime: newEndTime ?? source.endTime,
      maxPlayers: source.maxPlayers,
      minPlayers: source.minPlayers,
      visibility: source.visibility,
      requireSmsConfirmation: source.requireSmsConfirmation,
      teamMode: source.teamMode,
      trackPayments: source.trackPayments,
      showPaymentStatus: source.showPaymentStatus,
      trackResults: source.trackResults,
      confirmationDeadlineH: source.confirmationDeadlineH,
      costGrosze: source.costGrosze,
      maxGoalkeepers: source.maxGoalkeepers,
      goalkeepersEnabled: source.goalkeepersEnabled,
      reserveClaimHours: source.reserveClaimHours,
      acceptedPaymentMethods: source.acceptedPaymentMethods,
      blikPhone: source.blikPhone,
      acceptedSportsCards: source.acceptedSportsCards,
      sportsCardDiscountGrosze: source.sportsCardDiscountGrosze,
      sportsCardOtherName: source.sportsCardOtherName,
      customLocationName: source.customLocationName,
      customAddress: source.customAddress,
      // Powtórka meczu z serii ZOSTAJE w serii — inaczej „Powtórz mecz" po cichu
      // wypinałoby termin ze stałej gierki i psuło zarówno edycję zbiorczą, jak
      // i dziedziczenie ustawień przez kolejne terminy. Powtórka zwykłego meczu
      // pozostaje zwykłym meczem (`undefined`).
      recurringEventId: source.recurringEventId,
      // Powtórka meczu grupy ZOSTAJE w grupie — bez tego „Powtórz mecz" po cichu
      // wypinało termin z ekipy, i cotygodniowa gierka rozjeżdżała się z listą
      // meczów grupy po pierwszej powtórce.
      groupId: source.groupId,
    },
    organizerId,
    organizerName,
    organizerParticipates,
    organizerIsGoalkeeper,
  );
}

/**
 * How the signed-in user relates to an event. Two INDEPENDENT axes:
 *
 *   ownership     — isOrganizer: whose match this is (a lasting property)
 *   participation — status: my standing and what I can do next
 *
 * They must stay separate: you can organize a match and play in it, or organize
 * one without playing (the "Biorę udział" toggle). Collapsing them into a single
 * label loses information and made the UI ambiguous.
 *
 * 'invited' is reserved for the invitations feature — nothing produces it yet,
 * but the vocabulary is in place so adding it later touches only the label maps.
 */
export type MyEventStatus =
  | 'none'       // no relation — the default "Dołącz" call to action
  | 'invited'    // (future) someone invited me; awaiting my answer
  | 'pending'    // I asked to join; the organizer hasn't approved yet
  | 'observing'  // RSVP "maybe" — watching, holds no spot, counts in no stats
  | 'reserve'    // signed up, waiting for a spot to open
  | 'playing';   // signed up and holding a spot

export interface MyEventRelation {
  isOrganizer: boolean;
  status: MyEventStatus;
  /** Własny status opłacenia (gdy dotyczy) — populowane w getMyParticipatedEvents. */
  hasPaid?: boolean;
}

/** Derive the participation status from a participant row. */
function statusFromRow(row: { rsvp?: string | null; is_reserve?: boolean | null; pending_approval?: boolean | null }): MyEventStatus {
  if (row.pending_approval) return 'pending';
  if (row.rsvp === 'maybe') return 'observing';
  return row.is_reserve ? 'reserve' : 'playing';
}

export async function getMyParticipatedEvents(
  userId: string,
): Promise<{ event: EventItem; relation: MyEventRelation }[]> {
  const { data: partRows, error: pErr } = await supabase
    .from('event_participants')
    .select('event_id, rsvp, is_reserve, pending_approval, has_paid')
    .eq('user_id', userId);
  if (pErr) throw new Error(pErr.message);

  const rows = partRows ?? [];
  const myRow: Record<string, typeof rows[number]> = {};
  for (const r of rows) myRow[r.event_id as string] = r;

  // Matches I organize belong here too, even when I'm not playing in them.
  const { data: ownRows, error: oErr } = await supabase
    .from('events')
    .select('id')
    .eq('organizer_id', userId);
  if (oErr) throw new Error(oErr.message);

  // Delegat z can_edit (migracja 089/090) "prowadzi" mecz z perspektywy
  // dashboardu tak samo jak prawdziwy organizator — inaczej mecz, którego
  // sam nie gra (typowy powód delegowania), nigdy by mu się tu nie pokazał.
  // Delegaci z samym can_manage_squad/can_manage_payments (bez can_edit)
  // świadomie zostają poza tą listą, jeśli nie grają — muszą dotrzeć przez
  // link (patrz plan wdrożenia, "Świadome ograniczenie zakresu").
  const { data: delegateRows, error: dErr } = await supabase
    .from('event_delegates')
    .select('event_id')
    .eq('user_id', userId)
    .eq('can_edit', true);
  if (dErr) throw new Error(dErr.message);
  const delegatedEventIds = new Set((delegateRows ?? []).map((r) => r.event_id as string));

  const eventIds = Array.from(new Set([
    ...rows.map((r) => r.event_id as string),
    ...(ownRows ?? []).map((r) => r.id as string),
    ...Array.from(delegatedEventIds),
  ]));
  if (eventIds.length === 0) return [];

  const { data, error } = await supabase
    .from('events')
    .select('*, event_participants(id, is_reserve, pending_approval, has_paid)')
    .in('id', eventIds)
    .order('event_date', { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const mine = myRow[row.id as string];
    return {
      event: toEvent(row),
      relation: {
        isOrganizer: row.organizer_id === userId || delegatedEventIds.has(row.id as string),
        status: mine ? statusFromRow(mine) : 'none',
        hasPaid: mine?.has_paid ?? false,
      },
    };
  });
}

/** Map of eventId → my participation status, so lists don't invite someone to
 *  "Dołącz" to a match they're already part of. */
export async function getMyParticipationMap(
  userId: string,
): Promise<Record<string, MyEventStatus>> {
  const { data, error } = await supabase
    .from('event_participants')
    .select('event_id, rsvp, is_reserve, pending_approval')
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  const out: Record<string, MyEventStatus> = {};
  for (const r of data ?? []) out[r.event_id as string] = statusFromRow(r);

  // A player invite (event_player_invites, migration 060) that hasn't been
  // dismissed and has no participant row yet means "invited, awaiting my
  // answer" — the one MyEventStatus this map never produced before that
  // table existed. Anyone who already answered (joined/observing/reserve/
  // pending) keeps that status; the invite becomes just context at that
  // point, not the relation. Queried here rather than via lib/playerInvites.ts
  // to avoid a circular import (that module imports toEvent from this file).
  const { data: inviteRows, error: inviteErr } = await supabase
    .from('event_player_invites')
    .select('event_id')
    .eq('user_id', userId)
    .is('dismissed_at', null);
  if (inviteErr) throw new Error(inviteErr.message);
  for (const r of inviteRows ?? []) {
    const eventId = r.event_id as string;
    if (!(eventId in out)) out[eventId] = 'invited';
  }

  return out;
}
