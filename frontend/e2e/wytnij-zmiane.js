// Wycina z pary zrzutów sam fragment, który się zmienił.
//
// PO CO: obrazek „różnica" od Playwrighta to czerwona nakładka obu wersji
// na siebie — przy zmianie tekstu wychodzi z tego nieczytelna plątanina.
// A obok leżą pełne zrzuty całej strony, więc na telefonie zmiana o 20 pikseli
// gubi się w widoku wysokim na pięć ekranów.
//
// Ten skrypt czyta obrazek różnicy, znajduje prostokąt obejmujący wszystkie
// podświetlone piksele, dokłada margines i wycina TEN SAM prostokąt ze
// wszystkich trzech obrazków. Efekt: patrzysz na zmieniony fragment w skali,
// w której widać litery, a nie na całą stronę pomniejszoną do szerokości ekranu.
//
// Wywołanie: node wytnij-zmiane.js <katalog> <klucz>
// Oczekuje plików `roznica__<klucz>__{expected,actual,diff}.png`,
// zapisuje `wycinek__<klucz>__{expected,actual}.png`.
//
// `pngjs` jest zależnością Playwrighta, więc nie dokładamy niczego do package.json.

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const MARGINES = 24;
// Playwright maluje różnice na czerwono. Piksel uznajemy za „ruszony", gdy
// kanał czerwony wyraźnie góruje nad pozostałymi — samo „jasnoczerwony" nie
// wystarcza, bo tło strony też bywa ciepłe.
function czyPodswietlony(r, g, b) {
  return r > 150 && g < 120 && b < 120;
}

function wczytaj(sciezka) {
  return PNG.sync.read(fs.readFileSync(sciezka));
}

function ramkaZmiany(png) {
  let minX = png.width, minY = png.height, maxX = -1, maxY = -1;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = (png.width * y + x) << 2;
      if (czyPodswietlony(png.data[i], png.data[i + 1], png.data[i + 2])) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY };
}

function wytnij(png, r) {
  const szer = Math.min(png.width, r.maxX + MARGINES) - Math.max(0, r.minX - MARGINES);
  const wys = Math.min(png.height, r.maxY + MARGINES) - Math.max(0, r.minY - MARGINES);
  const x0 = Math.max(0, r.minX - MARGINES);
  const y0 = Math.max(0, r.minY - MARGINES);
  const wynik = new PNG({ width: szer, height: wys });
  PNG.bitblt(png, wynik, x0, y0, szer, wys, 0, 0);
  return wynik;
}

const [katalog, klucz] = process.argv.slice(2);
if (!katalog || !klucz) {
  console.error('użycie: node wytnij-zmiane.js <katalog> <klucz>');
  process.exit(1);
}

const plik = (rodzaj) => path.join(katalog, `roznica__${klucz}__${rodzaj}.png`);

try {
  const diff = wczytaj(plik('diff'));
  const ramka = ramkaZmiany(diff);
  if (!ramka) {
    // Różnica bez podświetleń zdarza się, gdy zmieniła się sama WYSOKOŚĆ
    // strony — Playwright zgłasza wtedy niezgodność rozmiaru i nie maluje
    // nic. Wycinek nie ma wtedy sensu, pełne zrzuty zostają.
    console.log('brak podświetleń — pomijam wycinek');
    process.exit(0);
  }

  for (const rodzaj of ['expected', 'actual']) {
    const sciezka = plik(rodzaj);
    if (!fs.existsSync(sciezka)) continue;
    const png = wczytaj(sciezka);
    // Zrzuty „przed" i „po" bywają różnej wysokości; prostokąt liczony
    // na obrazku różnicy przycinamy do granic każdego z nich osobno.
    const dopasowana = {
      minX: Math.min(ramka.minX, png.width - 1),
      minY: Math.min(ramka.minY, png.height - 1),
      maxX: Math.min(ramka.maxX, png.width - 1),
      maxY: Math.min(ramka.maxY, png.height - 1),
    };
    const wycinek = wytnij(png, dopasowana);
    fs.writeFileSync(
      path.join(katalog, `wycinek__${klucz}__${rodzaj}.png`),
      PNG.sync.write(wycinek),
    );
  }
  console.log(`wycinek ${klucz}: ${ramka.maxX - ramka.minX + 1}×${ramka.maxY - ramka.minY + 1} px`);
} catch (e) {
  // Wycinek to udogodnienie. Gdy się nie uda, raport ma nadal pokazać
  // pełne zrzuty — więc nie przewracamy całego kroku.
  console.log(`nie udało się wyciąć zmiany dla ${klucz}: ${e.message}`);
}
