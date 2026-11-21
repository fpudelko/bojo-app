// Kod QR jako macierz modułów (true = ciemny). Rysowanie zostaje po stronie
// komponentu (`components/ui/KodQr.tsx`), który składa z niej jeden <path>
// SVG: bez `dangerouslySetInnerHTML` i bez obrazka z zewnętrznego serwisu,
// więc ekran na halę działa też przy słabym internecie w hali.
import qrcode from 'qrcode-generator';

export function macierzQr(tekst: string): boolean[][] {
  // Typ 0 = najmniejszy, który pomieści tekst; poziom M (15% korekty): kod
  // na rzutniku bywa częściowo prześwietlony albo zasłonięty głową kibica.
  const qr = qrcode(0, 'M');
  qr.addData(tekst);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/** Ścieżka SVG (jednostka = jeden moduł) dla ciemnych modułów. */
export function sciezkaQr(macierz: readonly (readonly boolean[])[]): string {
  let d = '';
  macierz.forEach((wiersz, r) => wiersz.forEach((ciemny, c) => { if (ciemny) d += `M${c} ${r}h1v1h-1z`; }));
  return d;
}
