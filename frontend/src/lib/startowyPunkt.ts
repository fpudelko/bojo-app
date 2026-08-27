/**
 * Punkt, od którego zaczyna lista obiektów, gdy nie wiemy, gdzie stoi gracz.
 *
 * DLACZEGO POZNAŃ, a nie środek Polski: środek geograficzny to pole pod Łodzią,
 * czyli miejsce, w którym katalog nie ma nic ciekawego. Poznań jest miastem,
 * w którym Bojo startuje — pusta lista pokazuje więc żywe Bojo, a nie pustkę
 * z podpisem „to jest środek kraju".
 *
 * DLACZEGO WSPÓŁRZĘDNE, a nie `city = 'Poznań'`: zrzut z produkcji (2026-08-27)
 * pokazał, że `fields.city` jest wypełnione w jakichś DWÓCH PROCENTACH —
 * katalog ma 38 314 obiektów, a wszystkie największe miasta razem ~900, w tym
 * Poznań 54. Backfill lokalizacji (`scraper/backfill_lokalizacja.py`) prawie
 * nie przeszedł. `lat`/`lng` ma natomiast KAŻDY obiekt, więc dobór po kadrze
 * jest jedynym, który mówi prawdę o tym, co w katalogu naprawdę jest.
 */
export const POZNAN = { lat: 52.4064, lng: 16.9252 } as const;

/**
 * Promień listy „w okolicy", w kilometrach.
 *
 * 15 km: tyle, ile realnie da się przejechać po boisko. Mniej daje pustkę poza
 * dużym miastem, więcej przestaje być „w okolicy" i lista traci sens jako
 * odpowiedź na „gdzie mogę zagrać".
 */
export const PROMIEN_LISTY_KM = 15;
