import { describe, it, expect } from 'vitest';
import {
  nazwaZEmaila, brakNazwy, isPelneImie, displayName, firstName, avatarUrl,
} from '@/lib/profileName';
import type { User } from '@supabase/supabase-js';

/** Minimalny obiekt użytkownika — testujemy wyłącznie czyste selektory. */
function user(meta: Record<string, unknown>, email?: string): User {
  return { id: 'u1', email, user_metadata: meta } as unknown as User;
}

describe('nazwaZEmaila', () => {
  it('zwraca lokalną część adresu', () => {
    expect(nazwaZEmaila('jan.kowalski@gmail.com')).toBe('jan.kowalski');
  });

  it('nigdy nie przepuszcza domeny — to cała racja bytu tej funkcji', () => {
    expect(nazwaZEmaila('ktos@example.com')).not.toContain('@');
    expect(nazwaZEmaila('ktos@example.com')).not.toContain('example');
  });

  it('radzi sobie z brakiem adresu', () => {
    expect(nazwaZEmaila(null)).toBe('');
    expect(nazwaZEmaila(undefined)).toBe('');
    expect(nazwaZEmaila('')).toBe('');
  });

  it('nie wywraca się na wejściu bez małpy', () => {
    expect(nazwaZEmaila('bezmalpy')).toBe('bezmalpy');
  });
});

describe('brakNazwy', () => {
  it('wykrywa brak metadanych w ogóle', () => {
    expect(brakNazwy(null)).toBe(true);
    expect(brakNazwy(undefined)).toBe(true);
    expect(brakNazwy({})).toBe(true);
  });

  it('same spacje to nadal brak nazwy', () => {
    expect(brakNazwy({ display_name: '   ' })).toBe(true);
    expect(brakNazwy({ full_name: '' })).toBe(true);
  });

  it('dowolne z trzech pól wystarczy', () => {
    expect(brakNazwy({ display_name: 'Jan' })).toBe(false);
    expect(brakNazwy({ full_name: 'Jan Kowalski' })).toBe(false);
    expect(brakNazwy({ name: 'Janek' })).toBe(false);
  });

  it('ignoruje wartości, które nie są tekstem', () => {
    expect(brakNazwy({ display_name: 42 })).toBe(true);
    expect(brakNazwy({ full_name: {} })).toBe(true);
  });
});

describe('isPelneImie', () => {
  it('przyjmuje imię i nazwisko', () => {
    expect(isPelneImie('Jan Kowalski')).toBe(true);
  });

  it('przyjmuje polskie znaki, myślnik i apostrof', () => {
    expect(isPelneImie('Łukasz Żółć')).toBe(true);
    expect(isPelneImie('Anna Nowak-Kowalska')).toBe(true);
    expect(isPelneImie("Conor O'Brien")).toBe(true);
  });

  it('przyjmuje trzy człony', () => {
    expect(isPelneImie('Jan Maria Rokita')).toBe(true);
  });

  it('odrzuca jeden człon', () => {
    expect(isPelneImie('Jan')).toBe(false);
  });

  it('odrzuca inicjały — człon musi mieć co najmniej dwa znaki', () => {
    expect(isPelneImie('J Kowalski')).toBe(false);
    expect(isPelneImie('J K')).toBe(false);
  });

  it('odrzuca cyfry i znaki specjalne', () => {
    expect(isPelneImie('Jan 2000')).toBe(false);
    expect(isPelneImie('Jan Kowalski!')).toBe(false);
  });

  it('odrzuca pustkę i same spacje', () => {
    expect(isPelneImie('')).toBe(false);
    expect(isPelneImie('   ')).toBe(false);
    expect(isPelneImie(null)).toBe(false);
    expect(isPelneImie(undefined)).toBe(false);
  });

  it('nadmiarowe spacje nie psują wyniku', () => {
    expect(isPelneImie('  Jan   Kowalski  ')).toBe(true);
  });
});

describe('displayName', () => {
  it('woli nazwę własną nad wszystkim innym', () => {
    expect(displayName(user({ display_name: 'Kapitan', full_name: 'Jan Kowalski' }, 'j@x.pl')))
      .toBe('Kapitan');
  });

  it('spada na nazwę z Google', () => {
    expect(displayName(user({ full_name: 'Jan Kowalski' }, 'j@x.pl'))).toBe('Jan Kowalski');
    expect(displayName(user({ name: 'Janek' }, 'j@x.pl'))).toBe('Janek');
  });

  it('NIGDY nie zwraca pełnego adresu e-mail', () => {
    // Ta nazwa trafia do organizer_name i na publiczną, indeksowaną stronę
    // meczu — wyciek całego adresu był tu realnym błędem, nie kosmetyką.
    const nazwa = displayName(user({}, 'jan.kowalski@gmail.com'));
    expect(nazwa).toBe('jan.kowalski');
    expect(nazwa).not.toContain('@');
    expect(nazwa).not.toContain('gmail');
  });

  it('spada na „Gracz", gdy nie ma ani nazwy, ani adresu', () => {
    expect(displayName(user({}))).toBe('Gracz');
  });

  it('zwraca pusty ciąg dla braku użytkownika', () => {
    expect(displayName(null)).toBe('');
  });
});

describe('firstName', () => {
  it('bierze pierwszy człon nazwy', () => {
    expect(firstName(user({ full_name: 'jan kowalski' }))).toBe('Jan');
  });

  it('nie wita użytkownika jego adresem', () => {
    expect(firstName(user({}, 'jan.kowalski@gmail.com'))).toBe('Jan.kowalski');
  });

  it('zwraca pusty ciąg dla braku użytkownika', () => {
    expect(firstName(null)).toBe('');
  });
});

describe('avatarUrl', () => {
  it('czyta adres z metadanych, inaczej null', () => {
    expect(avatarUrl(user({ avatar_url: 'https://x/a.png' }))).toBe('https://x/a.png');
    expect(avatarUrl(user({}))).toBeNull();
    expect(avatarUrl(null)).toBeNull();
  });
});
