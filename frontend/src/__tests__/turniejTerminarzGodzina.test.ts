import { describe, it, expect } from 'vitest';
import { ulozHarmonogram, meczeKazdyZKazdym } from '@/lib/turniejFormat';

// NAJWAŻNIEJSZY TEST W TYM PLIKU dotyczy błędu, przez który układanie
// terminarza NIE DZIAŁAŁO NIGDY przez interfejs. `godzina_startu` to
// w Postgresie kolumna `time`, więc wraca jako „10:00:00". Panel sklejał
// `${dataStartu}T${godzinaStartu}:00`, co dawało „2026-10-24T10:00:00:00”,
// czyli nieprawidłową datę. `toISOString()` rzucał RangeError wewnątrz
// obsługi kliknięcia i organizator widział ciszę: ani terminarza, ani błędu.
// Seedowe turnieje mają mecze, bo wstawia je SQL, więc nic tego nie zgłaszało.
const mecze = meczeKazdyZKazdym(['a', 'b'], { startNumer: 1, noweId: () => 'm1' });
const opcje = { arenyId: ['arena-1'], czasMeczuMin: 15, przerwaMin: 5 };

describe('ulozHarmonogram — godzina startu', () => {
  it('układa terminarz dla poprawnej godziny w formacie HH:MM', () => {
    const wynik = ulozHarmonogram(mecze, { ...opcje, startAt: '2026-10-24T10:00:00' });
    expect(wynik).toHaveLength(1);
    expect(wynik[0].zaplanowanyAt).toBeTruthy();
  });

  it('nieprawidłowa data rzuca CZYTELNY błąd, nie gołe RangeError', () => {
    // Dokładnie ten ciąg powstawał przed poprawką.
    expect(() => ulozHarmonogram(mecze, { ...opcje, startAt: '2026-10-24T10:00:00:00' }))
      .toThrowError(/godzin/i);
  });

  it('komunikat niesie wartość, która nie zadziałała', () => {
    expect(() => ulozHarmonogram(mecze, { ...opcje, startAt: 'bzdura' }))
      .toThrowError(/bzdura/);
  });

  it('brak areny nie jest błędem: mecze planują się bez przypisanego boiska', () => {
    const wynik = ulozHarmonogram(mecze, { ...opcje, arenyId: [], startAt: '2026-10-24T10:00:00' });
    expect(wynik).toHaveLength(1);
    expect(wynik[0].arenaId).toBeUndefined();
  });
});
