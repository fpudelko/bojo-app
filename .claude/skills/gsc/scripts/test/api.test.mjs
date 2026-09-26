// Offline test of the service-account JWT: structure, claims and a signature
// that verifies with the matching public key. The live exchange was checked
// against Google on 2026-09-26 with a throwaway key: `invalid_grant: account
// not found`, i.e. the request itself was well-formed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { podpisanyJwt, wczytajKlucz, ZAKRES_GSC } from '../lib/google-auth.mjs';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const klucz = {
  client_email: 'bojo-gsc@projekt.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  private_key_id: 'kid-1',
};

test('JWT ma poprawne pola i podpis RS256', () => {
  const jwt = podpisanyJwt(klucz, ZAKRES_GSC, 1_800_000_000);
  const [h, l, podpis] = jwt.split('.');
  const naglowek = JSON.parse(Buffer.from(h, 'base64url'));
  const ladunek = JSON.parse(Buffer.from(l, 'base64url'));
  assert.deepEqual(naglowek, { alg: 'RS256', typ: 'JWT', kid: 'kid-1' });
  assert.equal(ladunek.iss, klucz.client_email);
  assert.equal(ladunek.scope, 'https://www.googleapis.com/auth/webmasters.readonly');
  assert.equal(ladunek.aud, 'https://oauth2.googleapis.com/token');
  assert.equal(ladunek.exp - ladunek.iat, 3600);
  assert.ok(createVerify('RSA-SHA256').update(`${h}.${l}`).verify(publicKey, Buffer.from(podpis, 'base64url')));
});

test('brak klucza daje instrukcję, nie stos wywołań', () => {
  assert.throws(() => wczytajKlucz({}), /GSC_KLUCZ_JSON/);
  assert.throws(() => wczytajKlucz({ GSC_KLUCZ_JSON: '{"a":1}' }), /konta serwisowego/);
});
