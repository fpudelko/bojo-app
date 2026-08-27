import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Lista rezerwowa przestała być stałą regułą (migracja 124). Reguła ma DWIE
// strony — interfejs i bazę — i to baza jest tą prawdziwą: Bojo nie ma
// własnego backendu, a klucz `anon` siedzi jawnie w paczce JS, więc schowanie
// przycisku niczego nie pilnuje. Ten plik sprawdza, czy obie strony mówią to
// samo; samo zachowanie bazy sprawdza `supabase/test/rls.sql` i wyzwalacz.
const migracja = readFileSync(
  resolve(__dirname, '../../../supabase/migrations/124_lista_rezerwowa_opcjonalna.sql'), 'utf8');
const stronaMeczu = readFileSync(
  resolve(__dirname, '../app/wydarzenia/[id]/EventDetailClient.tsx'), 'utf8');
const kreator = readFileSync(
  resolve(__dirname, '../components/events/EventCapacityFields.tsx'), 'utf8');
const stronaKreatora = readFileSync(
  resolve(__dirname, '../app/wydarzenia/nowe/page.tsx'), 'utf8');
const stronaEdycji = readFileSync(
  resolve(__dirname, '../app/wydarzenia/[id]/edytuj/page.tsx'), 'utf8');
const mapper = readFileSync(resolve(__dirname, '../lib/events.ts'), 'utf8');

describe('lista rezerwowa jako wybór organizatora', () => {
  it('kolumna wchodzi z DEFAULT true — migracja nikomu niczego nie wyłącza', () => {
    expect(migracja).toMatch(/reserve_enabled\s+BOOLEAN\s+NOT NULL\s+DEFAULT true/i);
  });

  it('bramka stoi w BAZIE, nie tylko w interfejsie', () => {
    expect(migracja).toMatch(/CREATE TRIGGER trg_pilnuj_wylaczonej_rezerwy/);
    expect(migracja).toMatch(/BEFORE INSERT OR UPDATE OF is_reserve ON event_participants/);
  });

  it('OBSERWUJĄCY nie jest rezerwowym i wyzwalacz go przepuszcza', () => {
    // `rsvp = 'maybe'` siedzi w bazie z `is_reserve = true` — to sztuczka na
    // nieblokowanie miejsca w składzie, nie zapis na listę. Bez tego wyjątku
    // wyłączenie rezerwy wyłączałoby przy okazji obserwowanie meczu.
    expect(migracja).toMatch(/WHEN \(NEW\.is_reserve AND NEW\.rsvp <> 'maybe'\)/);
  });

  it('wyłączenie NIE kasuje kolejki, która już powstała', () => {
    // Wyzwalacz działa wyłącznie na wierszach, które rezerwowe SIĘ STAJĄ —
    // w migracji nie ma ani jednego DELETE na uczestnikach.
    expect(migracja).not.toMatch(/DELETE\s+FROM\s+event_participants/i);
  });

  it('strona meczu nie obiecuje rezerwy, której baza nie przyjmie', () => {
    // Gdyby ten warunek zniknął, przy komplecie stałby przycisk „Komplet —
    // na rezerwę", a kliknięcie kończyłoby się błędem z wyzwalacza.
    expect(stronaMeczu).toMatch(/user && isFull && !event\.reserveEnabled/);
    expect(stronaMeczu).toContain('Komplet — zapisy zamknięte');
  });

  it('kreator chowa czas na decyzję razem z rezerwą', () => {
    // Pytanie „ile czasu na przyjęcie zwolnionego miejsca" przy wyłączonej
    // rezerwie jest pytaniem bez treści.
    expect(kreator).toMatch(/\{reserveEnabled && \(/);
  });

  it('KREATOR startuje z rezerwą WŁĄCZONĄ — tak jak reszta systemu', () => {
    // Kreator był jedynym miejscem, które startowało z `false`, więc KAŻDY nowy
    // mecz powstawał bez rezerwy wbrew kolumnie z `DEFAULT true`, stronie
    // edycji i mapperowi. Rezerwa jest zachowaniem domyślnym; przełącznik
    // służy do jej WYŁĄCZENIA, nie do włączenia.
    expect(stronaKreatora).toMatch(/const \[reserveEnabled, setReserveEnabled\] = useState\(true\)/);
    // Szkic sprzed tej zmiany też ma wejść jako włączony — inaczej stary
    // localStorage przywracałby porzucone „wyłączone" bez wiedzy autora.
    expect(stronaKreatora).toMatch(/setReserveEnabled\(v\.reserveEnabled \?\? true\)/);
  });

  it('wszystkie cztery miejsca mówią to samo o domyślnej rezerwie', () => {
    expect(migracja).toMatch(/reserve_enabled\s+BOOLEAN\s+NOT NULL\s+DEFAULT true/i);
    expect(stronaKreatora).toMatch(/useState\(true\)/);
    expect(stronaEdycji).toMatch(/setReserveEnabled\(ev\.reserveEnabled \?\? true\)/);
    expect(mapper).toMatch(/reserveEnabled: row\.reserve_enabled \?\? true/);
  });

  it('napis pod licznikiem miejsc mówi, co się NAPRAWDĘ stanie', () => {
    expect(kreator).toContain('Kolejni chętni trafią na listę rezerwową.');
    expect(kreator).toContain('Przy komplecie zapisy będą zamknięte.');
  });
});
