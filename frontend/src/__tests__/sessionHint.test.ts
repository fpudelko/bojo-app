import { describe, it, expect } from 'vitest';
import { SESSION_HINT_COOKIE, setHintCookie, clearHintCookie } from '@/lib/sessionHint';

describe('setHintCookie', () => {
  const cookie = setHintCookie(false);

  it('ustawia wartość na literalne "1" — bez tokenu', () => {
    expect(cookie).toContain(`${SESSION_HINT_COOKIE}=1`);
  });

  it('nie zawiera niczego, co wygląda na token JWT albo UUID', () => {
    // JWTs are dot-separated base64url segments; UUIDs have dashes in a fixed
    // pattern. Neither should appear anywhere in the cookie string.
    expect(cookie).not.toMatch(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/);
    expect(cookie).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });

  it('ma Path=/, SameSite=Lax i dodatni Max-Age', () => {
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('SameSite=Lax');
    const maxAge = Number(cookie.match(/Max-Age=(\d+)/)?.[1]);
    expect(maxAge).toBeGreaterThan(0);
  });

  it('dokłada Secure tylko gdy poproszono', () => {
    expect(setHintCookie(true)).toContain('Secure');
    expect(setHintCookie(false)).not.toContain('Secure');
  });
});

describe('clearHintCookie', () => {
  it('ma Max-Age=0', () => {
    expect(clearHintCookie(false)).toContain('Max-Age=0');
  });

  it('czyści wartość ciasteczka', () => {
    expect(clearHintCookie(false)).toContain(`${SESSION_HINT_COOKIE}=;`);
  });

  it('dokłada Secure tylko gdy poproszono', () => {
    expect(clearHintCookie(true)).toContain('Secure');
    expect(clearHintCookie(false)).not.toContain('Secure');
  });
});
