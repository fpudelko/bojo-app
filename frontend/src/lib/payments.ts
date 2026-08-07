import type { PaymentMethod, SportsCardProvider } from '@/types';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  blik: 'BLIK',
  gotowka: 'Gotówka',
  inne: 'Inny sposób',
};

export const PAYMENT_METHODS: PaymentMethod[] = ['blik', 'gotowka', 'inne'];

export const SPORTS_CARD_LABELS: Record<SportsCardProvider, string> = {
  multisport: 'Multisport',
  fitprofit: 'FitProfit',
  medicover: 'Medicover Sport',
  inne: 'Inna karta',
};

export const SPORTS_CARD_PROVIDERS: SportsCardProvider[] = ['multisport', 'fitprofit', 'medicover', 'inne'];

/** Label for a card provider, substituting the organizer's custom name for the
 *  generic "Inna karta" when they named it (e.g. "OK System"). */
export function sportsCardLabel(provider: SportsCardProvider, otherName?: string | null): string {
  if (provider === 'inne' && otherName?.trim()) return otherName.trim();
  return SPORTS_CARD_LABELS[provider];
}

export interface PriceForParticipant {
  /** Price to charge — falls back to the full price when the discount amount
   *  is unspecified, since there's nothing to subtract. */
  priceGrosze: number;
  /** True only when a specific discount amount was set and applied. */
  discountApplied: boolean;
  /** True when the participant holds a card but the organizer didn't say how
   *  much it's worth — show "ask the organizer" instead of a computed price. */
  discountUnspecified: boolean;
}

/** Resolves what a participant actually pays, accounting for the sports-card
 *  discount when the organizer specified an exact amount. Discount amount is
 *  optional (varies too much in the real world — %, daily limits, etc.), so a
 *  participant with a card but no known amount just gets flagged to ask. */
export function priceForParticipant(
  costGrosze: number,
  discountGrosze: number | null | undefined,
  hasSportsCard: boolean,
): PriceForParticipant {
  if (!hasSportsCard) {
    return { priceGrosze: costGrosze, discountApplied: false, discountUnspecified: false };
  }
  if (discountGrosze == null) {
    return { priceGrosze: costGrosze, discountApplied: false, discountUnspecified: true };
  }
  return { priceGrosze: Math.max(0, costGrosze - discountGrosze), discountApplied: true, discountUnspecified: false };
}

/** Keeps only the 9 digits of a Polish mobile number and groups them 3-3-3
 *  while typing. A leading "48" is stripped only when what remains after it
 *  is still a sensible length, so a number that genuinely starts with "48"
 *  (not a +48 prefix) isn't eaten. */
export function formatBlikPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.length > 9 && digits.startsWith('48')) digits = digits.slice(2);
  digits = digits.slice(0, 9);
  return digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}

/** Just the digits, no spaces — for length checks and storage. */
export function blikPhoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** Number of minutes before kickoff at which a squad member can see the
 *  organizer's BLIK phone number on the match page. */
export const BLIK_PHONE_REVEAL_MINUTES = 60;

/** The BLIK number is the organizer's personal phone. On the match page the
 *  organizer always sees it; a squad member sees it only within an hour of
 *  kickoff, when it's actually needed to settle up — the public, indexable
 *  match page doesn't hand the number to just anyone. The join dialog is the
 *  one deliberate exception: it shows the number right away, because without
 *  it there's no way to pay at sign-up time. */
export function canSeeBlikPhone(opts: {
  isOrganizer: boolean;
  isInSquad: boolean;
  minutesToStart: number | null;
}): boolean {
  if (opts.isOrganizer) return true;
  if (!opts.isInSquad || opts.minutesToStart == null) return false;
  return opts.minutesToStart <= BLIK_PHONE_REVEAL_MINUTES;
}
