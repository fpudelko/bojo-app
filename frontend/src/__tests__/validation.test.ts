import { describe, it, expect } from 'vitest';
import {
  sanitizeText,
  validateName,
  sanitizeDescription,
  sanitizeAddress,
  validatePhone,
  normalizePhone,
} from '@/lib/validation';

describe('sanitizeText', () => {
  it('strips HTML tags', () => {
    expect(sanitizeText('<b>Orlik</b>')).toBe('Orlik');
    expect(sanitizeText('<script>alert(1)</script>Boisko')).toBe('alert(1)Boisko');
    expect(sanitizeText('<img src=x onerror=hack>')).toBe('');
  });

  it('strips ASCII control characters', () => {
    expect(sanitizeText('Orlik\x00\x07Rataje')).toBe('OrlikRataje');
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeText('   Boisko   ')).toBe('Boisko');
  });

  it('clamps to the given max length', () => {
    expect(sanitizeText('abcdefghij', 5)).toBe('abcde');
  });

  it('keeps Polish diacritics intact', () => {
    expect(sanitizeText('Piłka nożna ążśćź')).toBe('Piłka nożna ążśćź');
  });

  it('returns empty string for tag-only input', () => {
    expect(sanitizeText('<div></div>')).toBe('');
  });
});

describe('validateName', () => {
  it('returns the sanitized name for valid input', () => {
    expect(validateName('  Orlik Rataje  ')).toBe('Orlik Rataje');
    expect(validateName('<i>Hala</i>')).toBe('Hala');
  });

  it('throws when the name is empty or whitespace only', () => {
    expect(() => validateName('')).toThrow('Nazwa jest wymagana.');
    expect(() => validateName('   ')).toThrow('Nazwa jest wymagana.');
  });

  it('throws when only HTML tags are supplied', () => {
    expect(() => validateName('<br>')).toThrow(/wymagana/);
  });

  it('uses a custom label in the error message', () => {
    expect(() => validateName('', 'Tytuł')).toThrow('Tytuł jest wymagana.');
  });

  it('truncates to the max length rather than throwing', () => {
    const longName = 'a'.repeat(200);
    expect(validateName(longName, 'Nazwa', 100)).toHaveLength(100);
  });
});

describe('sanitizeDescription', () => {
  it('allows up to 1000 characters', () => {
    expect(sanitizeDescription('x'.repeat(1500))).toHaveLength(1000);
  });

  it('never throws on empty input', () => {
    expect(sanitizeDescription('')).toBe('');
  });
});

describe('sanitizeAddress', () => {
  it('allows up to 300 characters', () => {
    expect(sanitizeAddress('x'.repeat(400))).toHaveLength(300);
  });

  it('strips tags from an address', () => {
    expect(sanitizeAddress('ul. <b>Dąbrowskiego</b> 79')).toBe('ul. Dąbrowskiego 79');
  });
});

describe('validatePhone', () => {
  it('accepts 9 bare digits', () => {
    expect(validatePhone('501234567')).toBe(true);
  });

  it('accepts +48 prefix', () => {
    expect(validatePhone('+48501234567')).toBe(true);
  });

  it('ignores spaces and dashes', () => {
    expect(validatePhone('501 234 567')).toBe(true);
    expect(validatePhone('501-234-567')).toBe(true);
    expect(validatePhone('+48 501-234-567')).toBe(true);
  });

  it('rejects too short / too long numbers', () => {
    expect(validatePhone('12345')).toBe(false);
    expect(validatePhone('5012345678')).toBe(false);
  });

  it('rejects non-digit content', () => {
    expect(validatePhone('abcdefghi')).toBe(false);
    expect(validatePhone('')).toBe(false);
  });
});

describe('normalizePhone', () => {
  it('adds +48 to a bare 9-digit number', () => {
    expect(normalizePhone('501234567')).toBe('+48501234567');
  });

  it('keeps an existing +48 prefix', () => {
    expect(normalizePhone('+48501234567')).toBe('+48501234567');
  });

  it('strips spaces and dashes before normalizing', () => {
    expect(normalizePhone('501 234 567')).toBe('+48501234567');
    expect(normalizePhone('+48 501-234-567')).toBe('+48501234567');
  });
});
