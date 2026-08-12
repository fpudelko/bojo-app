// ---------------------------------------------------------------------------
// Input validation & sanitization — applied before every Supabase write.
// ---------------------------------------------------------------------------

/** Strip HTML tags and dangerous control characters, then trim and clamp length. */
export function sanitizeText(raw: string, maxLength = 500): string {
  return raw
    .replace(/<[^>]*>/g, '')                        // strip HTML tags
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // strip ASCII control chars
    .trim()
    .slice(0, maxLength);
}

/**
 * Validate and sanitize a required name field (person, venue, event title…).
 * Returns the sanitized value or throws a user-friendly Error.
 */
export function validateName(raw: string, label = 'Nazwa', maxLen = 100): string {
  const s = sanitizeText(raw, maxLen);
  if (!s) throw new Error(`${label} jest wymagana.`);
  if (s.length > maxLen) throw new Error(`${label} może mieć maksymalnie ${maxLen} znaków.`);
  return s;
}

/** Sanitize optional description / notes. Never throws. */
export function sanitizeDescription(raw: string): string {
  return sanitizeText(raw, 1000);
}

/** Sanitize an address string. Never throws. */
export function sanitizeAddress(raw: string): string {
  return sanitizeText(raw, 300);
}

/**
 * Validate a Polish mobile phone number.
 * Accepts: 9 digits, or +48 followed by 9 digits (spaces/dashes ignored).
 */
export function validatePhone(raw: string): boolean {
  const cleaned = raw.replace(/[\s\-]/g, '');
  return /^(\+48)?[0-9]{9}$/.test(cleaned);
}

/** Normalize phone to +48XXXXXXXXX format. */
export function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[\s\-]/g, '');
  if (cleaned.startsWith('+48')) return cleaned;
  return `+48${cleaned}`;
}

/**
 * Validate and normalize an email address.
 * Checks for basic format (contains @ and .), but full validation happens
 * on the server (Supabase Auth). Throws a user-friendly error.
 */
export function validateEmail(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('Podaj adres e-mail.');
  if (!trimmed.includes('@')) throw new Error('Adres musi zawierać @.');
  if (!trimmed.includes('.')) throw new Error('Adres musi zawierać kropkę.');
  if (trimmed.length > 100) throw new Error('Adres e-mail jest za długi.');
  return trimmed;
}
