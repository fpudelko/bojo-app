// Draft persistence for the match-creation wizard (app/wydarzenia/nowe/page.tsx).
// The wizard has 26 separate useState hooks and, until now, zero persistence —
// leaving mid-way meant starting from scratch. This mirrors the guarded-storage
// idiom from lib/cookieConsent.ts (try/catch around every access) with a TTL
// like the one in components/home/NearbyGames.tsx — that file is dead code with
// an explicit "do not copy" notice, so this is a fresh, tested implementation.
import { withCount } from '@/lib/plural';
import type { Visibility, PaymentMethod, SportsCardProvider } from '@/types';
import type { LocationResult } from '@/components/map/UnifiedLocationPicker';

const KEY = 'bojo_event_draft_v1';

/** A draft older than this is treated as gone — stale enough that reviving it
 *  (a form for a match that was probably already organised some other way, or
 *  whose date has slipped) does more harm than starting fresh. */
export const EVENT_DRAFT_TTL_MS = 12 * 60 * 60 * 1000;

export interface EventDraftValues {
  sport: string;
  location: LocationResult;
  /** Nazwa dla pinezki spoza katalogu. Opcjonalna CELOWO, mimo że reszta pól
   *  jest wymagana: szkice zapisane przed jej dodaniem mają być nadal ważne,
   *  a `v` zostaje na `1` — odczyt robi `?? ''`, więc stary szkic wczytuje się
   *  bez zmian zamiast wylecieć jako „inna wersja schematu". */
  nazwaWlasnaMiejsca?: string;
  date: string;
  time: string;
  durationMin: number;
  czasWlasny: boolean;
  maxPlayers: number;
  maxPlayersTouched: boolean;
  /** `null` = organizator jeszcze nie zdecydował. Szkic musi umieć oddać brak
   *  decyzji, inaczej samo odtworzenie szkicu decydowałoby za niego. */
  goalkeepersEnabled: boolean | null;
  /** Tryb miejsc dla bramkarzy — patrz migracja `077`. */
  slotyZarezerwowane?: boolean;
  reserveClaimHours: number;
  title: string;
  description: string;
  descriptionEnabled: boolean;
  visibility: Visibility;
  requireApproval: boolean;
  organizerParticipates: boolean;
  organizerRole: 'field' | 'gk';
  costPln: string;
  kosztZaObiekt: boolean;
  kosztObiektuPln: string;
  acceptedPaymentMethods: PaymentMethod[];
  blikPhone: string;
  cardDiscountEnabled: boolean;
  cardDiscountPln: string;
  acceptedSportsCards: SportsCardProvider[];
  sportsCardOtherName: string;
  /** Ekipa wybrana w kroku 3. Opcjonalne, bo szkice zapisane przed dodaniem
   *  tego pola wczytują się dalej — brak wartości znaczy „bez ekipy". */
  grupaId?: string;
}

export interface EventDraft {
  v: 1;
  ts: number;
  step: number;
  values: EventDraftValues;
}

/** Returns the saved draft, or null when there isn't one, it's malformed, it's
 *  from an older schema version, or it has aged past the TTL. Never throws. */
export function loadEventDraft(): EventDraft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EventDraft>;
    if (parsed.v !== 1 || !parsed.ts || !parsed.values) return null;
    if (Date.now() - parsed.ts > EVENT_DRAFT_TTL_MS) return null;
    return parsed as EventDraft;
  } catch {
    return null;
  }
}

export function saveEventDraft(step: number, values: EventDraftValues): void {
  try {
    const draft: EventDraft = { v: 1, ts: Date.now(), step, values };
    localStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Storage full or unavailable (private mode) — the wizard still works,
    // it just won't survive a refresh.
  }
}

export function clearEventDraft(): void {
  try { localStorage.removeItem(KEY); } catch {}
}

/** "przed chwilą" / "N minut temu" / "N godzin temu" — for the "we restored
 *  your draft" banner. Coarse on purpose; nobody needs second-level precision
 *  on something that can be up to 12h old. */
export function draftAgeLabel(ts: number): string {
  const minutes = Math.floor((Date.now() - ts) / 60_000);
  if (minutes < 1) return 'przed chwilą';
  if (minutes < 60) return `${withCount(minutes, 'minutę', 'minuty', 'minut')} temu`;
  const hours = Math.floor(minutes / 60);
  return `${withCount(hours, 'godzinę', 'godziny', 'godzin')} temu`;
}
