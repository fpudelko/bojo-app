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

export type ParticipantStatus = 'zaproszony' | 'potwierdzony' | 'odrzucony' | 'brak_odpowiedzi';
export type TeamMode = 'brak' | 'reczne' | 'kapitanowie' | 'losowe';
export type ReportType = 'niesportowe_zachowanie' | 'nie_przyszedl' | 'inne';

export interface EventAdvancedSettings {
  requireSmsConfirmation: boolean;
  trackAttendance: boolean;
  teamMode: TeamMode;
  trackPayments: boolean;
  showPaymentStatus: boolean;
  trackResults: boolean;
  confirmationDeadlineH: number;
  costGrosze: number;
}

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
  externalCount: number; // players already committed outside the app
  participantsCount?: number; // non-reserve app participants (populated in list queries)
  visibility: Visibility;
  createdAt: string;
  status: EventStatus;
  customLocationName?: string;
  customAddress?: string;
  fieldAddress?: string; // address fetched from fields table (when field_id is set)
  district?: string;     // dzielnica from the linked field (when field_id is set)
  // advanced features (always present, default false/0/'brak')
  requireSmsConfirmation: boolean;
  trackAttendance: boolean;
  teamMode: TeamMode;
  trackPayments: boolean;
  showPaymentStatus: boolean;
  trackResults: boolean;
  confirmationDeadlineH: number;
  costGrosze: number;
  teamsPublished: boolean;
  allowGuestAdds: boolean;
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
  avatarUrl?: string;
  // advanced fields
  status: ParticipantStatus;
  confirmedAt?: string;
  team?: 'A' | 'B';
  paidAmount: number;
  phone?: string;
  isCaptain: boolean;
  addedBy?: string;
  isGoalkeeper: boolean;
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
  externalCount?: number;
  visibility: Visibility;
  customLocationName?: string;
  customAddress?: string;
  // advanced (optional, default false)
  requireSmsConfirmation?: boolean;
  trackAttendance?: boolean;
  teamMode?: TeamMode;
  trackPayments?: boolean;
  showPaymentStatus?: boolean;
  trackResults?: boolean;
  confirmationDeadlineH?: number;
  costGrosze?: number;
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

export interface PlayerReport {
  id: string;
  eventId: string;
  reportedParticipantId: string;
  reportedName?: string;
  reporterId?: string;
  reportType: ReportType;
  comment?: string;
  createdAt: string;
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
