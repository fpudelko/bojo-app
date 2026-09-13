'use client';

import ToggleRow from '@/components/ui/ToggleRow';

/** Limity ZNAKÓW, nie ozdoby — dokładnie te, które przy zapisie wymusza
 *  `sanityzujPolaMeczu()` w `lib/events.ts` (`sanitizeDescription()` obcina opis
 *  do 1000, tytuł dodatkowo `.slice(0, 80)`). Rozjazd którejkolwiek z tych
 *  liczb kończy się CICHYM obcięciem tekstu przy zapisie: organizator pisze
 *  akapit, zapisuje i nigdy się nie dowiaduje, że połowa nie doszła. */
const LIMIT_TYTULU = 80;
const LIMIT_OPISU = 1000;

/** Licznik „63/80”. Pojawia się dopiero blisko limitu, bo wcześniej odpowiada
 *  na pytanie, którego nikt nie zadaje, a zabiera linijkę pod polem. Sam
 *  `maxLength` wystarcza, żeby limitu nie przekroczyć — nie wystarcza, żeby
 *  zatrzymanie się pola nie wyglądało na zepsutą klawiaturę.
 *
 *  WIERSZ JEST CZĘŚCIĄ LICZNIKA, nie wywołującego: pusty `<div>` z `mt-1`
 *  czekający na licznik zostawia pod polem odstęp, który w chwili pojawienia
 *  się liczby urośnie i podbije układ. Skoro licznika nie ma — nie ma i wiersza. */
function LicznikZnakow({ ile, limit }: { ile: number; limit: number }) {
  if (ile < limit * 0.7) return null;
  return (
    <div className="mt-1 flex justify-end">
      <span className={`shrink-0 text-xs tabular-nums ${ile >= limit ? 'font-semibold text-amber-600' : 'text-slate-400'}`}>
        {ile}/{limit}
      </span>
    </div>
  );
}

/**
 * Tytuł + opis za przełącznikiem „Dodaj opis” (pusta textarea sama w sobie
 * sugerowała, że trzeba ją wypełnić). Wspólne dla kreatora (`wydarzenia/nowe`)
 * i edycji wydarzenia — edycja miała dotąd zawsze widoczną textarea opisu.
 */
export default function EventTitleDescriptionField({
  title, setTitle, placeholderTitle,
  description, setDescription,
  descriptionEnabled, setDescriptionEnabled,
  inputCls,
}: {
  title: string;
  setTitle: (v: string) => void;
  placeholderTitle: string;
  description: string;
  setDescription: (v: string) => void;
  descriptionEnabled: boolean;
  setDescriptionEnabled: (v: boolean) => void;
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

      {/* Description — behind a toggle: the empty textarea itself read
          like something to fill in, when most matches don't need it. */}
      <div className="rounded-lg border border-slate-200 px-4">
        <ToggleRow
          label="Dodaj opis"
          desc="Poziom, zasady, co zabrać"
          checked={descriptionEnabled}
          onChange={setDescriptionEnabled}
        />
        {descriptionEnabled && (
          <div className="pb-3">
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Np. gramy do 10 bramek, weź jasną koszulkę" rows={3} className={inputCls}
              maxLength={LIMIT_OPISU}
            />
            <LicznikZnakow ile={description.length} limit={LIMIT_OPISU} />
          </div>
        )}
      </div>
    </>
  );
}
