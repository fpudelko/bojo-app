'use client';

import type { Dispatch, SetStateAction } from 'react';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, SPORTS_CARD_PROVIDERS, SPORTS_CARD_LABELS, formatBlikPhone } from '@/lib/payments';
import type { PaymentMethod, SportsCardProvider } from '@/types';

/**
 * Metody płatności + numer BLIK + zniżka z kartą sportową — pokazywane, gdy
 * mecz w ogóle coś kosztuje (`costPln > 0`). Wspólne dla kreatora
 * (`wydarzenia/nowe`) i edycji wydarzenia — dawniej wklejone osobno w obu
 * plikach, przez co notatka o widoczności numeru BLIK ("godzinę przed
 * meczem", patrz `lib/payments.ts#canSeeBlikPhone`) istniała tylko w
 * kreatorze, nie w edycji.
 */
export default function EventPaymentFields({
  costPln,
  acceptedPaymentMethods, setAcceptedPaymentMethods,
  blikPhone, setBlikPhone,
  fieldErrors, setFieldErrors,
  cardDiscountEnabled, setCardDiscountEnabled,
  cardDiscountPln, setCardDiscountPln,
  acceptedSportsCards, setAcceptedSportsCards,
  sportsCardOtherName, setSportsCardOtherName,
  inputCls,
}: {
  costPln: string;
  acceptedPaymentMethods: PaymentMethod[];
  setAcceptedPaymentMethods: Dispatch<SetStateAction<PaymentMethod[]>>;
  blikPhone: string;
  setBlikPhone: (v: string) => void;
  fieldErrors: Record<string, string>;
  setFieldErrors: Dispatch<SetStateAction<Record<string, string>>>;
  cardDiscountEnabled: boolean;
  setCardDiscountEnabled: (v: boolean) => void;
  cardDiscountPln: string;
  setCardDiscountPln: (v: string) => void;
  acceptedSportsCards: SportsCardProvider[];
  setAcceptedSportsCards: Dispatch<SetStateAction<SportsCardProvider[]>>;
  sportsCardOtherName: string;
  setSportsCardOtherName: (v: string) => void;
  inputCls: string;
}) {
  if (!(parseFloat(costPln || '0') > 0)) return null;

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 p-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Jak można zapłacić?
        </label>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setAcceptedPaymentMethods((cur) =>
                cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m])}
              className={[
                'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                acceptedPaymentMethods.includes(m)
                  ? 'border-primary-600 bg-primary-50 text-primary-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50',
              ].join(' ')}
            >
              {PAYMENT_METHOD_LABELS[m]}
            </button>
          ))}
        </div>
        {/* Ostrzeżenie, nie blokada — organizator może świadomie ustalić
            płatność poza aplikacją. */}
        {acceptedPaymentMethods.length === 0 && (
          <p className="mt-2 text-xs text-amber-700">
            Bez wybranej metody gracze zobaczą cenę, ale nie dowiedzą się, jak Ci zapłacić.
          </p>
        )}
      </div>

      {acceptedPaymentMethods.includes('blik') && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Numer telefonu do BLIKA
          </label>
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={11}
            value={blikPhone}
            onChange={(e) => { setBlikPhone(formatBlikPhone(e.target.value)); setFieldErrors((f) => ({ ...f, blikPhone: '' })); }}
            placeholder="600 123 456"
            className={[inputCls, fieldErrors.blikPhone ? 'border-red-400 ring-1 ring-red-400' : ''].join(' ')}
          />
          {fieldErrors.blikPhone ? (
            <p data-field-error className="mt-1 text-xs font-medium text-red-600 flex items-center gap-1">
              <span aria-hidden>⚠</span> {fieldErrors.blikPhone}
            </p>
          ) : (
            // Fakt z `canSeeBlikPhone()` — organizator oddaje tu swój
            // prywatny numer i zasługuje, żeby wiedzieć, komu i kiedy się
            // pokaże.
            <p className="mt-1 text-xs text-slate-500">
              Numer zobaczą tylko zapisani gracze i dopiero godzinę przed meczem.
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <div>
          <p className="text-sm font-medium text-slate-900">Zniżka z kartą sportową</p>
          <p className="text-xs text-slate-500">Multisport, FitProfit, Medicover Sport…</p>
        </div>
        <button
          type="button"
          onClick={() => setCardDiscountEnabled(!cardDiscountEnabled)}
          className={['relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors', cardDiscountEnabled ? 'bg-primary-600' : 'bg-slate-200'].join(' ')}
          role="switch"
          aria-checked={cardDiscountEnabled}
        >
          <span className={['pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform', cardDiscountEnabled ? 'translate-x-5' : 'translate-x-0'].join(' ')} />
        </button>
      </div>

      {cardDiscountEnabled && (
        <div className="space-y-3 pl-1">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Zniżka (zł) <span className="text-slate-400 font-normal">(opcjonalnie)</span>
            </label>
            <input
              type="number"
              min={0}
              step={0.5}
              max={costPln || undefined}
              value={cardDiscountPln}
              onChange={(e) => { setCardDiscountPln(e.target.value); setFieldErrors((f) => ({ ...f, cardDiscount: '' })); }}
              placeholder="np. 20"
              className={[`${inputCls} max-w-[140px]`, fieldErrors.cardDiscount ? 'border-red-400 ring-1 ring-red-400' : ''].join(' ')}
            />
            {fieldErrors.cardDiscount ? (
              <p data-field-error className="mt-1 text-xs font-medium text-red-600 flex items-center gap-1">
                <span aria-hidden>⚠</span> {fieldErrors.cardDiscount}
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">
                Zostaw puste, jeśli zniżka zależy od dnia, limitu wejść itp. — gracze zobaczą,
                że karta daje zniżkę, i dopytają Cię o szczegóły.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Które karty akceptujesz?
            </label>
            <div className="flex flex-wrap gap-2">
              {SPORTS_CARD_PROVIDERS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAcceptedSportsCards((cur) =>
                    cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c])}
                  className={[
                    'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                    acceptedSportsCards.includes(c)
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {SPORTS_CARD_LABELS[c]}
                </button>
              ))}
            </div>
            {acceptedSportsCards.includes('inne') && (
              <div className="mt-2">
                <input
                  type="text"
                  value={sportsCardOtherName}
                  onChange={(e) => setSportsCardOtherName(e.target.value)}
                  placeholder="Jaka karta? np. OK System"
                  maxLength={40}
                  className={inputCls}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
