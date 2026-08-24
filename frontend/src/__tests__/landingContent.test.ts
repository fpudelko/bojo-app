import { describe, it, expect } from 'vitest';
import {
  LANDING_CTA,
  LANDING_HERO,
  LANDING_STEPS,
  LANDING_VALUES,
  LANDING_FAQ,
  LANDING_STATS,
  LANDING_DIRECT_ANSWER,
} from '@/components/home/landing/content';
import { faqJsonLd } from '@/lib/structuredData';
import { ZAKAZANE_NA_LANDINGU as FORBIDDEN_PHRASES } from '@/content/zakazaneFrazy';

// Lista fraz przeniesiona do `src/content/zakazaneFrazy.ts` (współdzielona ze
// stronami treści — `/faq`, `/jak-dziala-bojo`, `/dlaczego-bojo`), sam test
// zostaje tutaj bez zmian. Każda fraza mapuje na funkcję, która jest
// flagowana albo nie istnieje — see docs/llm-context.md, sekcja
// "Czego Bojo NIE robi".

function allLandingText(): string {
  return [
    LANDING_DIRECT_ANSWER,
    ...LANDING_HERO.badges,
    ...LANDING_HERO.h1,
    LANDING_HERO.lead,
    ...LANDING_HERO.trust,
    ...LANDING_STEPS.flatMap((s) => [s.title, s.body]),
    ...LANDING_VALUES.flatMap((v) => [v.title, v.body]),
    ...LANDING_FAQ.flatMap((f) => [f.q, f.a]),
    LANDING_CTA.primary.label,
    LANDING_CTA.secondary.label,
    LANDING_STATS.sportsValue,
    LANDING_STATS.sportsLabel,
    LANDING_STATS.timeValue,
    LANDING_STATS.timeLabel,
    LANDING_STATS.priceValue,
    LANDING_STATS.priceLabel,
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

describe('landing „Jak to działa" — pierwszy krok jest wejściem do kreatora', () => {
  // Sekcja straciła własny przycisk „Zorganizuj mecz" (był czwartym takim
  // na stronie). Zamiast niego klikalny jest pierwszy krok — jeśli ktoś
  // usunie `href`, sekcja zostanie bez żadnej drogi dalej.
  it('krok „Stwórz mecz" prowadzi do /wydarzenia/nowe', () => {
    const first = LANDING_STEPS[0];
    expect(first.title).toBe('Stwórz mecz');
    expect('href' in first && first.href).toBe('/wydarzenia/nowe');
  });

  it('pozostałe kroki są opisem, nie odnośnikiem', () => {
    for (const step of LANDING_STEPS.slice(1)) {
      expect('href' in step).toBe(false);
    }
  });
});

describe('landing H1 — obiecuje tylko to, co dowieziemy', () => {
  it('mówi o organizowaniu meczu, nie o zbieraniu 14 osób w 2 minuty', () => {
    expect(LANDING_HERO.h1[0]).toBe('Zorganizuj mecz');
  });
});

// Geography rule: the SALES copy (hero, steps, values, stats) speaks about
// capability and stays city-agnostic, because "stwórz mecz gdziekolwiek"
// already works today regardless of how dense the venue catalogue is in any
// one place. The venue catalogue's actual density is a separate, honest fact
// — it belongs only in FAQ, disclosed plainly, not folded into the pitch.
describe('zasięg — katalog jest ogólnopolski, więc nazwa miasta nie pada nigdzie', () => {
  const salesCopy = [
    ...LANDING_HERO.badges,
    ...LANDING_HERO.h1,
    LANDING_HERO.lead,
    ...LANDING_HERO.trust,
    ...LANDING_STEPS.flatMap((s) => [s.title, s.body]),
    ...LANDING_VALUES.flatMap((v) => [v.title, v.body]),
    LANDING_STATS.sportsValue,
    LANDING_STATS.sportsLabel,
    LANDING_STATS.timeLabel,
    LANDING_STATS.priceLabel,
  ].join(' \n ').toLowerCase();

  it('oferta (hero/kroki/wartości/statystyki) nie wymienia Poznania', () => {
    expect(salesCopy).not.toMatch(/poznań|poznania|poznaniu/);
  });

  // Do 2026-08 FAQ ujawniało, że katalog jest najgęstszy w Poznaniu — i było to
  // uczciwe, dopóki prawdziwe. Po imporcie z OSM katalog obejmuje cały kraj,
  // więc ta sama informacja stała się nieaktualna i zawężała ofertę bez powodu.
  it('FAQ o zasięgu mówi o całej Polsce, bez nazwy miasta', () => {
    const geoAnswer = LANDING_FAQ.find((f) => /gdzie działa bojo/i.test(f.q));
    expect(geoAnswer).toBeDefined();
    expect(geoAnswer!.a.toLowerCase()).toMatch(/całej polsce/);
    expect(geoAnswer!.a.toLowerCase()).not.toMatch(/poznani/);
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
