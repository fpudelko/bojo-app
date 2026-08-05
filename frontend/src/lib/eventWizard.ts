// Validation for the match-creation wizard (app/wydarzenia/nowe/page.tsx).
// Pulled out of the page so the step-gating logic is testable and shared
// between the "Dalej" buttons and clicking a step number directly.

export type FieldErrors = Record<string, string>;

/** True when the given date (YYYY-MM-DD) + time (HH:MM) is at or before now. */
export function isPast(date: string, time: string): boolean {
  try {
    const [y, m, d] = date.split('-').map(Number);
    const [h, min] = (time || '00:00').split(':').map(Number);
    return new Date(y, m - 1, d, h, min).getTime() <= Date.now();
  } catch { return false; }
}

export function validateStep1(location: { venue?: unknown; lat: number | null }): FieldErrors {
  return (!location.venue && location.lat === null)
    ? { location: 'Wskaż lokalizację na mapie lub wpisz adres.' }
    : {};
}

export function validateStep2(date: string, time: string): FieldErrors {
  if (!date) return { date: 'Podaj datę meczu.' };
  if (isPast(date, time)) return { date: 'Mecz nie może zaczynać się w przeszłości.' };
  return {};
}

/** Step 3 (Opcje) has no required fields. */
export function validateStep3(): FieldErrors {
  return {};
}

/** Validator for step `n` (1-indexed), given the wizard's current form values. */
export function validateStep(
  n: number,
  v: { location: { venue?: unknown; lat: number | null }; date: string; time: string },
): FieldErrors {
  if (n === 1) return validateStep1(v.location);
  if (n === 2) return validateStep2(v.date, v.time);
  return validateStep3();
}
