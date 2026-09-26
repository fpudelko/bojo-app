// Google service-account auth (OAuth 2.0 JWT bearer), zero dependencies.
//
// The key never touches the repo or the chat: it is read from the environment
// (GSC_KLUCZ_JSON = the whole JSON, or GSC_KLUCZ_PLIK / GOOGLE_APPLICATION_CREDENTIALS
// = a path). In Claude Code on the web it is set in the environment's settings.

import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const ZAKRES_GSC = 'https://www.googleapis.com/auth/webmasters.readonly';

const b64url = (x) => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url');

/** Load the service-account key from the environment, or explain what is missing. */
export function wczytajKlucz(env = process.env) {
  let surowy = env.GSC_KLUCZ_JSON;
  const plik = env.GSC_KLUCZ_PLIK || env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!surowy && plik) surowy = readFileSync(plik, 'utf8');
  if (!surowy) {
    throw new Error(
      'Brak klucza konta serwisowego. Ustaw GSC_KLUCZ_JSON (cały plik JSON) albo GSC_KLUCZ_PLIK (ścieżka) ' +
      'w ustawieniach środowiska. Instrukcja: .claude/skills/gsc/references/dane-i-dostep.md, „Dostęp przez API”.',
    );
  }
  const klucz = JSON.parse(surowy);
  if (!klucz.client_email || !klucz.private_key) throw new Error('Klucz nie wygląda na klucz konta serwisowego (brak client_email / private_key).');
  return klucz;
}

/** Signed JWT assertion for the token endpoint. Exported for tests. */
export function podpisanyJwt(klucz, zakres = ZAKRES_GSC, teraz = Math.floor(Date.now() / 1000)) {
  const naglowek = { alg: 'RS256', typ: 'JWT', ...(klucz.private_key_id ? { kid: klucz.private_key_id } : {}) };
  const ladunek = {
    iss: klucz.client_email,
    scope: zakres,
    aud: klucz.token_uri || 'https://oauth2.googleapis.com/token',
    iat: teraz,
    exp: teraz + 3600,
  };
  const niepodpisany = `${b64url(naglowek)}.${b64url(ladunek)}`;
  const podpis = createSign('RSA-SHA256').update(niepodpisany).sign(klucz.private_key).toString('base64url');
  return `${niepodpisany}.${podpis}`;
}

/** Exchange the JWT for an access token. */
export async function tokenDostepu(klucz, zakres = ZAKRES_GSC) {
  const odp = await fetch(klucz.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: podpisanyJwt(klucz, zakres),
    }),
  });
  const dane = await odp.json().catch(() => ({}));
  if (!odp.ok || !dane.access_token) {
    throw new Error(`Google odrzucił klucz (${odp.status}): ${dane.error ?? '?'} ${dane.error_description ?? ''}`.trim());
  }
  return dane.access_token;
}
