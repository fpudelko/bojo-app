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
