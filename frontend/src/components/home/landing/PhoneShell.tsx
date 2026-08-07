/** Rama telefonu wokół makiety ekranu.
 *
 *  Kluczowa jest tu klasa `aspect-[9/19]` na obszarze ekranu. Poprzednia
 *  makieta (PhoneMock) nie miała zadanej ani wysokości, ani proporcji — ramka
 *  brała wysokość ze swojej treści, a treści była jedna karta. Stąd brało się
 *  wrażenie „ścinka ekranu": to nie było przycięcie, tylko za mało zawartości
 *  w pojemniku bez wymiarów. Proporcja wymusza pełny ekran telefonu i sprawia,
 *  że wszystkie trzy makiety w karuzeli mają identyczną wysokość — bez tego
 *  przewijanie w bok skakałoby po pionie.
 */
export default function PhoneShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[2.8rem] border-[7px] border-slate-800 bg-white shadow-[0_24px_56px_rgba(0,0,0,0.32)]">
      {/* notch */}
      <div className="flex items-center justify-center bg-slate-800 py-2">
        <div className="h-4 w-20 rounded-full bg-slate-700" />
      </div>

      <div className="relative aspect-[9/19] overflow-hidden bg-canvas text-left">
        {children}
      </div>

      {/* pasek gestów */}
      <div className="flex justify-center bg-white py-2.5">
        <div className="h-1 w-20 rounded-full bg-slate-200" />
      </div>
    </div>
  );
}
