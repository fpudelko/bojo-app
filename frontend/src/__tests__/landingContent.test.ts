import { describe, it, expect } from 'vitest';
import {
  LANDING_CTA,
  LANDING_HERO,
  LANDING_STEPS,
  LANDING_VALUES,
  LANDING_FAQ,
  LANDING_FINAL_CTA,
} from '@/components/home/landing/content';
import { faqJsonLd } from '@/lib/structuredData';

// Every phrase here maps to a feature that is flag-gated or absent — see
// docs/llm-context.md, section "Czego Bojo NIE robi". If one of these words
// legitimately needs to appear (e.g. a feature ships and a flag flips to
// true), update this list in the same commit as a deliberate decision.
const FORBIDDEN_PHRASES = [
  'cykliczn', // SHOW_RECURRING = false
  'stał[ae] gierk', // same feature, marketing name
  'turniej', // SHOW_CUP = false
  'sms', // SHOW_SMS_FEATURES = false
  'przypomnien', // no scheduler exists
  'powiadom', // no event triggers notifications today
  'alert', // SHOW_GAME_ALERTS = false
  'rezerwacj[aeę] boisk', // FEATURE_RESERVATIONS = false
  'blik', // no payment integration
  'zapłać przez', // no payment integration
  'automatyczn[iy].*(awans|wskocz)', // no reserve auto-promotion, by design
  'ranking', // does not exist
  'poziom(u|ie)? zaawansowania', // does not exist
  'warszaw', // Poznań only
  'krak[oó]w', // Poznań only
] as const;

function allLandingText(): string {
  return [
    ...LANDING_HERO.h1,
    LANDING_HERO.lead,
    LANDING_HERO.eyebrowFallback,
    ...LANDING_HERO.trust,
    ...LANDING_STEPS.flatMap((s) => [s.title, s.body]),
    ...LANDING_VALUES.flatMap((v) => [v.title, v.body]),
    ...LANDING_FAQ.flatMap((f) => [f.q, f.a]),
    LANDING_FINAL_CTA.h2,
    LANDING_FINAL_CTA.lead,
    LANDING_CTA.primary.label,
    LANDING_CTA.secondary.label,
  ].join(' \n ').toLowerCase();
}

describe('landing copy — brak obietnic bez pokrycia w kodzie', () => {
  const text = allLandingText();

  for (const phrase of FORBIDDEN_PHRASES) {
    it(`nie zawiera frazy pasującej do /${phrase}/`, () => {
      expect(new RegExp(phrase, 'i').test(text)).toBe(false);
    });
  }
});

describe('landing CTA — jedno główne, jedno poboczne', () => {
  it('prowadzą do różnych, poprawnych tras', () => {
    expect(LANDING_CTA.primary.href).toBe('/wydarzenia/nowe');
    expect(LANDING_CTA.secondary.href).toBe('/wydarzenia');
    expect(LANDING_CTA.primary.href).not.toBe(LANDING_CTA.secondary.href);
  });
});

describe('FAQ ↔ JSON-LD — zero rozjazdu', () => {
  const jsonLd = faqJsonLd(LANDING_FAQ);

  it('ma tyle samo pozycji co widoczna treść', () => {
    expect(jsonLd.mainEntity).toHaveLength(LANDING_FAQ.length);
  });

  it('każde pytanie/odpowiedź w schemacie odpowiada źródłu', () => {
    jsonLd.mainEntity.forEach((entry, i) => {
      expect(entry.name).toBe(LANDING_FAQ[i].q);
      expect(entry.acceptedAnswer.text).toBe(LANDING_FAQ[i].a);
    });
  });

  it('każda odpowiedź jest wystarczająco treściwa dla schema (≥40 znaków)', () => {
    for (const { a } of LANDING_FAQ) {
      expect(a.length).toBeGreaterThanOrEqual(40);
    }
  });
});
