// Ostatnio użyte boisko — propozycja przy tworzeniu kolejnego meczu.
//
// Organizator gra zwykle wciąż w tym samym miejscu, a szkic kreatora
// (`lib/eventDraft.ts`) tego nie pokrywa: żyje 12 h i jest kasowany zaraz po
// publikacji, czyli dokładnie wtedy, gdy „to samo boisko co ostatnio" zaczyna
// mieć sens.
//
// Świadomie PROPOZYCJA, nie automatyczne wstawienie. Miejsce meczu wybrane po
// cichu za organizatora to najgorsza pomyłka do przeoczenia — widać ją dopiero
// wtedy, gdy ekipa stoi pod złym boiskiem.

const KLUCZ = 'bojo_ostatnie_boisko_v1';

/** 60 dni. Boisko sprzed kwartału to już nie „ostatnio", tylko zgadywanie. */
const TTL_MS = 60 * 24 * 60 * 60 * 1000;

export interface OstatnieBoisko {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  ts: number;
}

/** Zapis po udanej publikacji. Tylko dla boisk z katalogu — pinezka postawiona
 *  ręcznie nie ma `id`, więc nie da się jej później rzetelnie odtworzyć. */
export function zapiszOstatnieBoisko(v: Omit<OstatnieBoisko, 'ts'>): void {
  try {
    localStorage.setItem(KLUCZ, JSON.stringify({ ...v, ts: Date.now() }));
  } catch {
    /* tryb prywatny potrafi rzucić — brak propozycji nikomu nie szkodzi */
  }
}

export function wczytajOstatnieBoisko(): OstatnieBoisko | null {
  try {
    const raw = localStorage.getItem(KLUCZ);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OstatnieBoisko>;
    if (!parsed.id || !parsed.name || parsed.lat == null || parsed.lng == null || !parsed.ts) return null;
    if (Date.now() - parsed.ts > TTL_MS) return null;
    return parsed as OstatnieBoisko;
  } catch {
    return null;
  }
}
