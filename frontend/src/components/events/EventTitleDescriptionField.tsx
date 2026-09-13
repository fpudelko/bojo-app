'use client';

/** Limity ZNAKÓW, nie ozdoby — dokładnie te, które przy zapisie wymusza
 *  `sanityzujPolaMeczu()` w `lib/events.ts` (`sanitizeDescription()` obcina opis
 *  do 1000, tytuł dodatkowo `.slice(0, 80)`). Rozjazd którejkolwiek z tych
 *  liczb kończy się CICHYM obcięciem tekstu przy zapisie: organizator pisze
 *  akapit, zapisuje i nigdy się nie dowiaduje, że połowa nie doszła. */
const LIMIT_TYTULU = 80;
const LIMIT_OPISU = 1000;

/** Licznik „63/80”. Liczba pojawia się dopiero blisko limitu, bo wcześniej
 *  odpowiada na pytanie, którego nikt nie zadaje. Sam `maxLength` wystarcza,
 *  żeby limitu nie przekroczyć — nie wystarcza, żeby zatrzymanie się pola nie
 *  wyglądało na zepsutą klawiaturę.
 *
 *  WIERSZ STOI ZAWSZE, ZMIENIA SIĘ TYLKO TREŚĆ — poprawka z 2026-09-13.
 *  Wcześniej cały `<div>` znikał poniżej progu, więc przy 56. znaku tytułu
 *  wskakiwał z niczego i spychał w dół wszystko pod spodem: przełącznik
 *  „Dodaj opis" odjeżdżał spod palca w trakcie pisania. Stary komentarz bronił
 *  tego argumentem, że pusty wiersz „zostawia odstęp, który urośnie" — ale
 *  odstęp rośnie tylko wtedy, gdy wysokości nie zarezerwować. `min-h-5` to
 *  dokładnie wysokość linii `text-xs`, więc wiersz ma tę samą wysokość pusty
 *  i pełny, a układ nie drgnie ani razu.
 *
 *  `aria-live="polite"` czyta liczbę dopiero, gdy naprawdę zaczyna być
 *  istotna — czytnik ekranu nie odlicza każdego znaku od zera. */
function LicznikZnakow({ ile, limit }: { ile: number; limit: number }) {
  const widoczny = ile >= limit * 0.7;
  return (
    <div className="mt-1 flex min-h-5 items-center justify-end" aria-live="polite">
      {widoczny && (
        <span className={`shrink-0 text-xs tabular-nums ${ile >= limit ? 'font-semibold text-amber-600' : 'text-slate-400'}`}>
          {ile}/{limit}
        </span>
      )}
    </div>
  );
}

/**
 * Tytuł + opis. Wspólne dla kreatora (`wydarzenia/nowe`) i edycji wydarzenia.
 *
 * OPIS NIE MA JUŻ PRZEŁĄCZNIKA (2026-09-13, zgłoszone wprost). Przełącznik
 * powstał przeciwko pustej textarei, która czytała się jak pole do
 * wypełnienia — ale odpowiedzią na „to nie jest wymagane" jest dopisek
 * „(opcjonalnie)" w etykiecie, a nie przełącznik NAD polem tekstowym.
 * Rozstrzyga o tym pole tuż wyżej: „Tytuł" jest tak samo opcjonalny i stoi
 * gołe, z takim samym dopiskiem. Dwa opcjonalne pola obok siebie, jedno za
 * przełącznikiem, drugie nie, to nie była zasada — to był przypadek.
 */
export default function EventTitleDescriptionField({
  title, setTitle, placeholderTitle,
  description, setDescription,
  inputCls,
}: {
  title: string;
  setTitle: (v: string) => void;
  placeholderTitle: string;
  description: string;
  setDescription: (v: string) => void;
  inputCls: string;
}) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Tytuł <span className="text-slate-400 font-normal">(opcjonalnie)</span>
        </label>
        <input
          type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder={placeholderTitle} className={inputCls} maxLength={LIMIT_TYTULU}
        />
        {/* Podpowiedzi „zostaw puste, a mecz nazwie się…" tu nie ma: dokładnie
            tę nazwę pokazuje placeholder pola, a „(opcjonalnie)" stoi w etykiecie. */}
        <LicznikZnakow ile={title.length} limit={LIMIT_TYTULU} />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Opis <span className="text-slate-400 font-normal">(opcjonalnie)</span>
        </label>
        <textarea
          value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="Np. gramy do 10 bramek, weź jasną koszulkę" rows={3} className={inputCls}
          maxLength={LIMIT_OPISU}
        />
        <LicznikZnakow ile={description.length} limit={LIMIT_OPISU} />
      </div>
    </>
  );
}
