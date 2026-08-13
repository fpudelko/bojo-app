import { describe, it, expect } from 'vitest';
import {
  sanitizeText,
  validateName,
  sanitizeDescription,
  sanitizeAddress,
  validatePhone,
  normalizePhone,
  validateEmail,
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

describe('validateEmail', () => {
  it('akceptuje poprawny adres i przycina otaczające spacje', () => {
    expect(validateEmail('  jan@example.com  ')).toBe('jan@example.com');
  });

  it('odrzuca puste pole', () => {
    expect(() => validateEmail('')).toThrow('Podaj adres e-mail.');
    expect(() => validateEmail('   ')).toThrow('Podaj adres e-mail.');
  });

  it('odrzuca adres bez @', () => {
    expect(() => validateEmail('jan.kowalski.com')).toThrow(/poprawny adres/);
  });

  // Sedno poprawki: domena bez kropki (bez TLD-u) nie jest adresem, nawet gdy
  // gdzieś w stringu jest kropka — poprzednia wersja sprawdzała `@` i `.`
  // NIEZALEŻNIE od kolejności, więc "jan.kowalski@d" przechodziło.
  it('odrzuca domenę bez kropki, mimo kropki w części lokalnej', () => {
    expect(() => validateEmail('jan.kowalski@d')).toThrow(/poprawny adres/);
    expect(() => validateEmail('ssssd@d')).toThrow(/poprawny adres/);
  });

  it('odrzuca adres z samą kropką na końcu domeny, bez TLD-u', () => {
    expect(() => validateEmail('jan@example.')).toThrow(/poprawny adres/);
  });

  it('odrzuca spacje wewnątrz adresu', () => {
    expect(() => validateEmail('jan kowalski@example.com')).toThrow(/poprawny adres/);
  });

  it('odrzuca zbyt długi adres', () => {
    const dlugi = `${'a'.repeat(95)}@example.com`;
    expect(() => validateEmail(dlugi)).toThrow('Adres e-mail jest za długi.');
  });

  it('akceptuje domenę wielopoziomową i plusowe aliasy', () => {
    expect(validateEmail('jan+test@mail.example.co.uk')).toBe('jan+test@mail.example.co.uk');
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
