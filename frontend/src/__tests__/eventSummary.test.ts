import { describe, it, expect } from 'vitest';
import { zbudujPodsumowanie, type DanePodsumowania } from '@/lib/eventSummary';

const bazowe: DanePodsumowania = {
  sport: 'piłka nożna',
  title: '',
  miejsceNazwa: 'Orlik Sołacz',
  miejsceAdres: 'ul. Niestachowska 8',
  date: '2026-08-12',      // środa
  time: '18:00',
  durationMin: 90,
  maxPlayers: 14,
  goalkeepersEnabled: false,
  maxGoalkeepers: 2,
  organizerParticipates: true,
  costPln: '',
  acceptedPaymentMethods: [],
  cardDiscountEnabled: false,
  cardDiscountPln: '',
  acceptedSportsCards: [],
  visibility: 'public',
  requireApproval: false,
};

/** Skrót do jednego wiersza po kluczu. */
function w(dane: Partial<DanePodsumowania>, klucz: string) {
  const wiersz = zbudujPodsumowanie({ ...bazowe, ...dane }).find((x) => x.klucz === klucz);
  if (!wiersz) throw new Error(`brak wiersza ${klucz}`);
  return wiersz;
}

describe('zbudujPodsumowanie — kształt', () => {
  it('zwraca sześć wierszy w ustalonej kolejności', () => {
    expect(zbudujPodsumowanie(bazowe).map((x) => x.klucz))
      .toEqual(['co', 'kiedy', 'gdzie', 'sklad', 'koszt', 'widocznosc']);
  });

  it('każdy wiersz wskazuje krok, na który cofa „Zmień"', () => {
    const kroki = Object.fromEntries(zbudujPodsumowanie(bazowe).map((x) => [x.klucz, x.krok]));
    expect(kroki).toEqual({ co: 3, kiedy: 2, gdzie: 1, sklad: 2, koszt: 2, widocznosc: 3 });
  });
});

describe('wiersz „Co"', () => {
  it('bez tytułu pokazuje nazwę domyślną — tę samą, którą dostanie mecz', () => {
    expect(w({}, 'co').wartosc).toBe('Piłka nożna 7v7');
  });

  it('z tytułem pokazuje tytuł', () => {
    expect(w({ title: 'Środowa gierka' }, 'co').wartosc).toBe('Środowa gierka');
  });

  it('sam biały znak to nadal brak tytułu', () => {
    expect(w({ title: '   ' }, 'co').wartosc).toBe('Piłka nożna 7v7');
  });
});

describe('wiersz „Kiedy"', () => {
  it('pokazuje dzień tygodnia, datę i zakres godzin', () => {
    expect(w({}, 'kiedy').wartosc).toBe('środa, 12 sierpnia · 18:00–19:30');
  });

  it('bez godziny końca (mecz przez północ) pokazuje samą godzinę startu', () => {
    expect(w({ time: '23:30', durationMin: 90 }, 'kiedy').wartosc)
      .toBe('środa, 12 sierpnia · 23:30');
  });

  it('ostrzega, gdy mecz jest dzisiaj', () => {
    const dzis = new Date();
    const iso = `${dzis.getFullYear()}-${String(dzis.getMonth() + 1).padStart(2, '0')}-${String(dzis.getDate()).padStart(2, '0')}`;
    expect(w({ date: iso }, 'kiedy').ostrzezenie).toContain('dziś');
  });

  it('nie ostrzega dla daty w przyszłości', () => {
    expect(w({}, 'kiedy').ostrzezenie).toBeUndefined();
  });
});

describe('wiersz „Gdzie"', () => {
  it('łączy nazwę z adresem', () => {
    expect(w({}, 'gdzie').wartosc).toBe('Orlik Sołacz, ul. Niestachowska 8');
  });

  it('nie dubluje, gdy nazwa i adres są tym samym', () => {
    expect(w({ miejsceAdres: 'Orlik Sołacz' }, 'gdzie').wartosc).toBe('Orlik Sołacz');
  });

  it('ostrzega, gdy zostały same współrzędne', () => {
    const wiersz = w({ miejsceNazwa: null, miejsceAdres: '52.40123, 16.91234' }, 'gdzie');
    expect(wiersz.wartosc).toBe('52.40123, 16.91234');
    expect(wiersz.ostrzezenie).toContain('współrzędne');
  });

  it('nie ostrzega przy zwykłym adresie bez nazwy', () => {
    expect(w({ miejsceNazwa: null, miejsceAdres: 'ul. Polna 3' }, 'gdzie').ostrzezenie)
      .toBeUndefined();
  });
});

describe('wiersz „Skład"', () => {
  it('liczba miejsc i udział organizatora', () => {
    expect(w({}, 'sklad').wartosc).toBe('14 miejsc · grasz');
  });

  it('organizator, który nie gra', () => {
    expect(w({ organizerParticipates: false }, 'sklad').wartosc).toBe('14 miejsc · nie grasz');
  });

  it('dopisuje limit bramkarzy, gdy rozróżnienie jest włączone', () => {
    expect(w({ goalkeepersEnabled: true }, 'sklad').wartosc)
      .toBe('14 miejsc · w tym 2 bramkarzy · grasz');
  });
});

describe('wiersz „Koszt"', () => {
  it('mecz darmowy', () => {
    expect(w({}, 'koszt').wartosc).toBe('Za darmo');
    expect(w({ costPln: '0' }, 'koszt').wartosc).toBe('Za darmo');
  });

  it('cena od osoby z przecinkiem dziesiętnym i metodami', () => {
    expect(w({ costPln: '20', acceptedPaymentMethods: ['blik', 'gotowka'] }, 'koszt').wartosc)
      .toBe('20,00 zł od osoby · BLIK, Gotówka');
  });

  it('ostrzega, gdy jest cena, a nie ma metody płatności', () => {
    const wiersz = w({ costPln: '20' }, 'koszt');
    expect(wiersz.wartosc).toBe('20,00 zł od osoby');
    expect(wiersz.ostrzezenie).toContain('metody płatności');
  });

  it('zniżka z podaną kwotą', () => {
    expect(w({
      costPln: '30', acceptedPaymentMethods: ['gotowka'],
      cardDiscountEnabled: true, cardDiscountPln: '10', acceptedSportsCards: ['multisport'],
    }, 'koszt').wartosc).toContain('zniżka 10,00 zł (Multisport)');
  });

  it('pusta kwota zniżki znaczy „zapytaj organizatora", nie „brak zniżki"', () => {
    expect(w({
      costPln: '30', acceptedPaymentMethods: ['gotowka'],
      cardDiscountEnabled: true, cardDiscountPln: '', acceptedSportsCards: ['multisport'],
    }, 'koszt').wartosc).toContain('do ustalenia');
  });
});

describe('wiersz „Kto widzi"', () => {
  it('publiczny mówi, że trafi na listę', () => {
    expect(w({}, 'widocznosc').wartosc).toBe('Publiczny — trafi na listę otwartych gier');
  });

  it('prywatny mówi, że wejdą tylko osoby z linkiem', () => {
    expect(w({ visibility: 'private' }, 'widocznosc').wartosc)
      .toBe('Prywatny — wejdą tylko osoby z linkiem');
  });

  it('dopisuje akceptację zapisów', () => {
    expect(w({ requireApproval: true }, 'widocznosc').wartosc)
      .toContain('zatwierdzasz każdy zapis');
  });
});
