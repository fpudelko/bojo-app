export type BookingType = 'internal' | 'external' | 'none';
export type MapVisibility = 'public' | 'organizer_only' | 'hidden';

export interface Field {
  id: string;
  name: string;
  sport: string[];
  address: string;
  lat: number;
  lng: number;
  available: boolean;
  surface: string;
  isIndoor: boolean;
  isBookable: boolean;
  bookingType: BookingType;
  bookingUrl?: string;
  bookingEnabled: boolean;
  managerId?: string;
  phone?: string;
  website?: string;
  email?: string;
  operator?: string;
  operatorType?: string;
  description?: string;
  imageUrl?: string;
  photoUrl?: string;
  photoReference?: string;
  photoSource?: string;
  openingHours?: string;
  postcode?: string;
  lit?: boolean;
  access?: string;
  fee?: boolean;
  hasChangingRooms?: boolean;
  hasShower?: boolean;
  hasToilets?: boolean;
  capacity?: number;
  mapVisibility: MapVisibility;
  district?: string;
  contactVisible?: boolean;
  venueType?: string;
  dimensionsM?: string;
  accessType?: string;
  isVerifiedVenue?: boolean;
  condition?: string;
  aiTypedAt?: string;
  /** Znormalizowane w scraper/backfill_lokalizacja.py — nie parsować z address. */
  city?: string;
  voivodeship?: string;
  /** 1 = pełna indeksacja, 2 = warunkowa, 3 = noindex,follow. Patrz migracja 112. */
  seoTier?: 1 | 2 | 3;
}

export interface FieldsResponse {
  fields: Field[];
  total: number;
}

export type SportType =
  | 'piłka nożna'
  | 'koszykówka'
  | 'siatkówka'
  | 'siatkówka plażowa'
  | 'futsal'
  | 'piłka ręczna'
  | 'gokarty'
  | 'inne';

export interface FieldFilters {
  sport?: SportType;
  available?: boolean;
  bookable?: boolean;
  bookingType?: BookingType;
  managerId?: string;
  search?: string;
  lat?: number;
  lng?: number;
  radius_km?: number;
  limit?: number;
  offset?: number;
  mapVisibility?: MapVisibility;
}

export interface VenueSchedule {
  id: string;
  fieldId: string;
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  slotMinutes: number;
  createdAt?: string;
}

export interface VenuePricing {
  id: string;
  fieldId: string;
  name: string;
  priceGrosze: number;
  dayOfWeek?: number[];
  timeFrom?: string;
  timeTo?: string;
  priority: number;
  createdAt?: string;
}

export interface Booking {
  id: string;
  fieldId: string;
  userId: string;
  userName: string;
  date: string;
  startTime: string;
  endTime: string;
  priceGrosze: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  sport?: string;
  playersCount: number;
  phone?: string;
  notes?: string;
  createdAt: string;
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  priceGrosze: number;
  available: boolean;
}

export type Visibility = 'private' | 'public';
export type EventStatus = 'active' | 'cancelled';

export type TeamMode = 'brak' | 'reczne' | 'kapitanowie' | 'losowe';

export interface EventAdvancedSettings {
  requireSmsConfirmation: boolean;
  teamMode: TeamMode;
  trackPayments: boolean;
  showPaymentStatus: boolean;
  trackResults: boolean;
  confirmationDeadlineH: number;
  costGrosze: number;
}

export type PaymentMethod = 'blik' | 'gotowka' | 'inne';
export type SportsCardProvider = 'multisport' | 'fitprofit' | 'medicover' | 'inne';

export interface EventItem {
  id: string;
  organizerId: string;
  organizerName: string;
  sport: string;
  fieldId?: string;
  fieldName: string;
  lat?: number;
  lng?: number;
  title?: string;
  description?: string;
  date: string;
  time: string;
  endTime?: string;
  maxPlayers: number;
  /** Ilu graczy musi być w składzie, żeby gra się odbyła. `undefined` = brak progu (097). */
  minPlayers?: number;
  participantsCount?: number; // non-reserve app participants (populated in list queries)
  pendingApprovalCount?: number; // awaiting organizer approval (requireApproval matches)
  /** Regulars (not reserve, not pending) without has_paid — populated in list
   *  queries alongside participantsCount. Undefined where not fetched. */
  unpaidCount?: number;
  visibility: Visibility;
  createdAt: string;
  status: EventStatus;
  customLocationName?: string;
  customAddress?: string;
  fieldAddress?: string; // address fetched from fields table (when field_id is set)
  district?: string;     // dzielnica from the linked field (when field_id is set)
  groupId?: string;      // optional group this event belongs to
  /** Seria, do której należy ten termin (`recurring_events.id`). Ustawiona, gdy
   *  mecz powstał z szablonu cyklicznego — ręcznie albo automatycznie. Obecność
   *  tej wartości włącza pytanie o zakres przy edycji (to / to i przyszłe /
   *  cała seria). Patrz docs/domena.md. */
  recurringEventId?: string;
  // advanced features (always present, default false/0/'brak')
  requireSmsConfirmation: boolean;
  teamMode: TeamMode;
  trackPayments: boolean;
  showPaymentStatus: boolean;
  trackResults: boolean;
  confirmationDeadlineH: number;
  costGrosze: number;
  teamsPublished: boolean;
  allowGuestAdds: boolean;
  joinCode: string;
  requireApproval: boolean;
  coverImageUrl?: string;
  /** Max goalkeepers before extras overflow to reserve (football). Default 2. */
  maxGoalkeepers: number;
  /** `true` = miejsca dla bramkarzy zarezerwowane (pole ma `maxPlayers - maxGoalkeepers`).
   *  `false` = wspólna pula, bramkarze tylko ograniczeni liczbowo. Migracja `077`. */
  goalkeeperSlotsReserved: boolean;
  /** Whether the goalkeeper / field-player distinction is used at all. */
  goalkeepersEnabled: boolean;
  /** How long (minutes) a reserve has to accept a freed spot before it passes on. */
  reserveClaimMinutes: number;
  /** Czy przy komplecie chętni trafiają na listę rezerwową (migracja `124`).
   *  `false` = mecz przy komplecie jest ZAMKNIĘTY; kto chce więcej ludzi,
   *  podnosi `maxPlayers`. Wyłączenie nie kasuje kolejki, która już powstała. */
  reserveEnabled: boolean;
  /** Ways participants may pay when the match costs money. */
  acceptedPaymentMethods: PaymentMethod[];
  /** Phone number for BLIK transfers — shown when 'blik' is accepted. */
  blikPhone?: string;
  /** Sports-benefit cards honoured for this match (informational + discount). */
  acceptedSportsCards: SportsCardProvider[];
  /** Flat discount (grosze) when a participant holds an accepted card. Null =
   *  "there is a discount, but ask the organizer" (varies too much to fix a number). */
  sportsCardDiscountGrosze: number | null;
  /** Name for the "inne" (other) card option, e.g. "OK System" — shown instead
   *  of the generic "Inna karta" label wherever this event's cards are listed. */
  sportsCardOtherName?: string;
}

export interface EventParticipant {
  id: string;
  eventId: string;
  userId?: string;
  name: string;
  isGuest: boolean;
  hasPaid: boolean;
  isReserve: boolean;
  createdAt: string;
  /** Moment, od którego liczy się miejsce w kolejce rezerwowej (migracja `110`).
   *  Różny od `createdAt` dla kogoś, kto najpierw obserwował (rsvp 'maybe') —
   *  wiersz powstał wcześniej niż prawdziwe dołączenie. Brak (baza bez migracji
   *  `110`) — użyj `momentZapisu()` z `lib/events.ts`, nie tego pola wprost. */
  zapisanoAt?: string;
  avatarUrl?: string;
  // advanced fields
  team?: 'A' | 'B';
  paidAmount: number;
  isCaptain: boolean;
  addedBy?: string;
  isGoalkeeper: boolean;
  /** True while awaiting organizer approval (event.requireApproval). */
  pendingApproval: boolean;
  /** 'yes' = confirmed spot; 'maybe' = interested, doesn't take a capacity slot. */
  rsvp: 'yes' | 'maybe';
  /** Set when a freed spot has been offered to this reserve. Null = no pending
   *  offer. The window length is `event.reserveClaimMinutes`. */
  claimOfferedAt?: string;
  /** True once they declined the offer or let the window lapse. Stays on the
   *  reserve list (organizer can still promote by hand) but skipped by the queue. */
  claimPassed: boolean;
  /** Jednorazowy token, którym osoba dopisana ręcznie zwiąże ten wpis ze swoim
   *  kontem (migracja `066`).
   *
   *  UWAGA: wiersze z listy składu go NIE NIOSĄ — od migracji `127` kolumna
   *  `claim_token` nie jest czytelna przez API (był to sekret na okaziciela
   *  wystawiony każdemu, kto otworzył stronę meczu). Pole zostaje wyłącznie
   *  dla wyników operacji, które token tworzą (`addGuest`, zapis gościa bez
   *  konta). Żeby wysłać zaproszenie z listy składu, poproś o token funkcją
   *  `pobierzTokenGoscia()` — wyda go organizatorowi albo osobie, która tego
   *  gościa dopisała. Do samego PYTANIA „czy jest co przejmować" wystarczy
   *  `isGuest && !claimedAt`. */
  claimToken?: string;
  /** Kiedy wpis gościa został związany z kontem (migracja `066`). Ustawione =
   *  nie ma już czego przejmować. */
  claimedAt?: string;
  /** How this participant intends to pay (chosen when joining a paid match). */
  paymentMethod?: PaymentMethod;
  /** Whether they hold one of the event's accepted sports cards. */
  hasSportsCard: boolean;
  sportsCardProvider?: SportsCardProvider;
}

/** Jawna odmowa udziału (migracja `097`) — "nie gram", nie "nieobecność". */
export interface EventDecline {
  eventId: string;
  userId: string;
  createdAt: string;
}

export interface EventCreate {
  sport: string;
  fieldId?: string;
  fieldName: string;
  lat?: number;
  lng?: number;
  title?: string;
  description?: string;
  date: string;
  time: string;
  endTime?: string;
  maxPlayers: number;
  /** Ilu graczy musi być, żeby gra się odbyła. Brak = brak progu (097). */
  minPlayers?: number;
  visibility: Visibility;
  customLocationName?: string;
  customAddress?: string;
  // advanced (optional, default false)
  requireSmsConfirmation?: boolean;
  teamMode?: TeamMode;
  trackPayments?: boolean;
  showPaymentStatus?: boolean;
  trackResults?: boolean;
  confirmationDeadlineH?: number;
  costGrosze?: number;
  requireApproval?: boolean;
  groupId?: string;
  /** Seria, do której należy tworzony termin — patrz `EventItem.recurringEventId`. */
  recurringEventId?: string;
  maxGoalkeepers?: number;
  goalkeeperSlotsReserved?: boolean;
  goalkeepersEnabled?: boolean;
  reserveClaimMinutes?: number;
  reserveEnabled?: boolean;
  acceptedPaymentMethods?: PaymentMethod[];
  blikPhone?: string;
  acceptedSportsCards?: SportsCardProvider[];
  sportsCardDiscountGrosze?: number | null;
  sportsCardOtherName?: string;
}

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

export type ReminderChannel = 'sms' | 'email' | 'both';

export interface EventReminder {
  id: string;
  eventId: string;
  offsetMinutes: number;
  message?: string;
  channel: ReminderChannel;
  sent: boolean;
  sentAt?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Match results — flexible per sport
// ---------------------------------------------------------------------------

export type MatchResultType =
  | 'goals'       // football, futsal, handball
  | 'volleyball'  // volleyball, beach volleyball
  | 'basketball'
  | 'racing'      // karting / other racing
  | 'generic';

export interface GoalsScorerStat { participantId: string; goals: number; assists?: number }
export interface VolleyballSet { a: number; b: number }
export interface BasketballPlayerStat { participantId: string; points: number; rebounds?: number; assists?: number }
export interface RacingRank { participantId: string; position: number; lapTime?: string }

export type MatchResultData =
  | { type: 'goals';      scoreA: number; scoreB: number; scorers?: GoalsScorerStat[] }
  | { type: 'volleyball'; setsA: number; setsB: number; sets: VolleyballSet[] }
  | { type: 'basketball'; scoreA: number; scoreB: number; players?: BasketballPlayerStat[] }
  | { type: 'racing';     rankings: RacingRank[] }
  | { type: 'generic';    text: string; winner?: 'A' | 'B' | 'remis' };

export interface MatchResult {
  id: string;
  eventId: string;
  scoreA: number;
  scoreB: number;
  winner?: 'A' | 'B' | 'remis';
  resultData?: MatchResultData;
  recordedBy?: string;
  recordedAt: string;
}

export interface PlayerGoal {
  id: string;
  eventId: string;
  participantId: string;
  participantName: string;
  goals: number;
}

export interface PlayerMatchStat {
  id: string;
  eventId: string;
  participantId: string;
  statData: Record<string, unknown>;
}

export interface PlayerStats {
  id: string;
  userId: string;
  recurringEventId?: string;
  invitedCount: number;
  confirmedCount: number;
  noShowCount: number;
  goalsTotal: number;
  matchesPlayed: number;
  updatedAt: string;
}

export interface RecurringEvent {
  id: string;
  organizerId: string;
  organizerName: string;
  sport: string;
  fieldId?: string;
  fieldName: string;
  lat?: number;
  lng?: number;
  title?: string;
  description?: string;
  dayOfWeek: number; // 1=Mon … 7=Sun
  eventTime: string;
  endTime?: string;
  maxPlayers: number;
  visibility: Visibility;
  notifyDaysBefore: number;
  isActive: boolean;
  createdAt: string;
}

export interface RecurringEventInvite {
  id: string;
  recurringEventId: string;
  name: string;
  email?: string;
  phone?: string;
  createdAt: string;
}

export interface GameAlert {
  id: string;
  userId: string;
  sport?: string;       // undefined = any sport
  daysOfWeek: number[]; // [] = any day; 1=Mon…7=Sun (ISO)
  lat: number;
  lng: number;
  radiusKm: number;
  cityLabel?: string;
  isActive: boolean;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body?: string;
  eventId?: string;
  alertId?: string;
  claimToken?: string;
  groupId?: string; // 093 — powiadomienia bez meczu (np. ogłoszenie na tablicy)
  readAt?: string;
  createdAt: string;
}

export interface EventComment {
  id: string;
  eventId: string;
  userId: string;
  userName: string;
  body: string;
  deletedAt?: string;
  createdAt: string;
}

/** Komentarz pod obiektem z katalogu boisk (migracja `063`). Osobny od
 *  `EventComment`, bo żyje dłużej niż pojedynczy mecz i opisuje miejsce. */
export interface FieldComment {
  id: string;
  fieldId: string;
  userId: string;
  userName: string;
  body: string;
  deletedAt?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Groups — a recurring crew of players
// ---------------------------------------------------------------------------

/** Etykieta wyliczana z `can_*` przez trigger `ustaw_role_czlonka` (migracja
 *  `092`) — nie źródło prawdy o uprawnieniach, tylko podpis pod awatarem. */
export type GroupRole = 'admin' | 'member';

export interface Group {
  id: string;
  name: string;
  description?: string;
  sport?: string;
  city?: string;
  createdBy?: string;
  joinCode: string;
  createdAt: string;
  memberCount?: number; // populated in list queries
  coverImageUrl?: string;
  fieldId?: string;    // optional venue this group is tied to
  fieldName?: string;
  joinCodeRotatedAt?: string; // 094 — kiedy ostatnio unieważniono stary link
}

/** Grupa z terminem najbliższego meczu — dla listy `/grupy`, żeby karta
 *  odpowiadała od razu na pytanie "kiedy gramy", nie tylko "jak się nazywa". */
export interface GroupWithNext extends Group {
  nextEvent?: EventItem;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: GroupRole;
  joinedAt: string;
  // Cztery niezależne przełączniki (migracje `092`, `096`) — założyciel ma
  // je zawsze `true` niezależnie od tego, co jest zapisane w wierszu (patrz
  // `uprawnieniaCzlonka()` w `lib/groups.ts`, lustro wyzwalacza w bazie).
  canManageMembers: boolean;
  canCreateEvents: boolean;
  canModerateWall: boolean;
  canInvite: boolean; // 096 — widzi przycisk "Zaproś" i kod dołączenia
  invitedBy?: string; // 094 — kto przyprowadził tę osobę do ekipy
  // joined from profiles / participations
  name: string;
  avatarUrl?: string;
}

/** Czyje uprawnienia w grupie widzi UI — wyliczone, nie surowy wiersz bazy. */
export interface GroupPermissions {
  isFounder: boolean;
  canManageMembers: boolean;
  canCreateEvents: boolean;
  canModerateWall: boolean;
  canInvite: boolean;
}

/** Wpis na tablicy grupy (migracja `093`) — płaska lista, bez wątków. */
export interface GroupPost {
  id: string;
  groupId: string;
  userId: string;
  userName: string;
  body: string;
  pinnedAt?: string;
  deletedAt?: string;
  createdAt: string;
}

/** Nagłówek statystyk grupy — publiczny, z `get_group_stats()` (migracja `095`). */
export interface GroupStats {
  matchesPlayed: number;
  matchesUpcoming: number;
  goalsTotal: number;
  membersCount: number;
  distinctPlayers: number;
}

/** Wiersz tabeli graczy grupy — z `get_group_leaderboard()` (migracja `095`),
 *  wyłącznie dla członków. `wins` ma sens wyłącznie gdy `matchesWithTeams > 0`
 *  — patrz `pokazacKolumneWygranych()` w `lib/groupStats.ts`. */
export interface GroupLeaderboardEntry {
  userId: string;
  name: string;
  avatarUrl?: string;
  matchesPlayed: number;
  goals: number;
  wins: number;
  matchesWithTeams: number;
  noShows: number;
  niezawodnoscPct: number;
}

// ---------------------------------------------------------------------------
// Player profile — aggregated stats + game history
// ---------------------------------------------------------------------------

export interface PlayerAggregateStats {
  eventsJoined: number;
  eventsOrganized: number;
  matchesPlayed: number;
  goalsTotal: number;
  noShows: number;
}

export interface PlayerHistoryItem {
  eventId: string;
  sport: string;
  title?: string;
  fieldName: string;
  date: string;
  isOrganizer: boolean;
  isReserve: boolean;
  goals: number;
  hasResult: boolean;
}

// ---------------------------------------------------------------------------
// BOJO Community Cup — turniej drużynowy
// ---------------------------------------------------------------------------

export type TournamentStatus =
  | 'draft'
  | 'registration'
  | 'group_stage'
  | 'knockout'
  | 'finals'
  | 'completed';

export type TeamStatus =
  | 'pending'
  | 'confirmed'
  | 'rejected'
  | 'eliminated'
  | 'withdrawn';

export type PlayerPosition =
  | 'bramkarz'
  | 'obrońca'
  | 'pomocnik'
  | 'napastnik'
  | 'uniwersalny';

export type MatchStage =
  | 'group'
  | 'round_of_32'
  | 'round_of_16'
  | 'quarter'
  | 'semi'
  | 'third_place'
  | 'final';

export type TournamentMatchStatus =
  | 'pending'
  | 'proposed'
  | 'scheduled'
  | 'played'
  | 'walkover'
  | 'disputed';

export type SlotStatus = 'free' | 'reserved' | 'taken';

export interface Tournament {
  id: string;
  slug: string;
  name: string;
  sport: string;
  city: string;
  status: TournamentStatus;
  format: string;
  maxTeams: number;
  groupSize: number;
  advancePerGroup: number;
  minSquad: number;
  maxSquad: number;
  registrationDeadline?: string;
  startDate?: string;
  finalsDate?: string;
  finalsVenue?: string;
  tagline?: string;
  prizePool?: string;
  rules?: string;
  entryFeeGrosze: number;
  createdAt: string;
}

export interface TournamentGroup {
  id: string;
  tournamentId: string;
  name: string;
  createdAt: string;
}

export interface TournamentTeam {
  id: string;
  tournamentId: string;
  name: string;
  district?: string;
  captainId: string;
  captainName: string;
  captainPhone?: string;
  captainEmail?: string;
  status: TeamStatus;
  paidAt?: string;
  groupId?: string;
  seed?: number;
  availabilityDays: number[]; // 1=Mon…7=Sun (ISO)
  availabilityFrom?: string;
  availabilityTo?: string;
  finalsConfirmed: boolean;
  createdAt: string;
  members?: TournamentTeamMember[];
}

export interface TournamentTeamMember {
  id: string;
  teamId: string;
  userId?: string;
  name: string;
  position: PlayerPosition;
  shirtNumber?: number;
  isCaptain: boolean;
  isReserve: boolean;
  createdAt: string;
}

export interface TournamentVenue {
  id: string;
  tournamentId: string;
  fieldId?: string;
  name: string;
  address?: string;
  district?: string;
  isPartner: boolean;
  createdAt: string;
  slots?: TournamentVenueSlot[];
}

export interface TournamentVenueSlot {
  id: string;
  venueId: string;
  startsAt: string;
  durationMin: number;
  status: SlotStatus;
  matchId?: string;
  createdAt: string;
}

export interface TournamentMatch {
  id: string;
  tournamentId: string;
  stage: MatchStage;
  groupId?: string;
  round?: number;
  bracketPosition?: number;
  teamAId?: string;
  teamBId?: string;
  feedsAMatchId?: string;
  feedsBMatchId?: string;
  proposedByTeamId?: string;
  proposedSlot?: string;
  venueSlotId?: string;
  venueText?: string;
  scheduledAt?: string;
  status: TournamentMatchStatus;
  scoreA?: number;
  scoreB?: number;
  winnerTeamId?: string;
  reportedByTeamId?: string;
  confirmedByTeamId?: string;
  disputeNote?: string;
  proofUrl?: string;
  deadline?: string;
  playedAt?: string;
  createdAt: string;
}

export interface TournamentStanding {
  teamId: string;
  tournamentId: string;
  groupId: string;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}
