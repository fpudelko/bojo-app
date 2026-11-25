// Miniatury układów ekranu na halę do wyboru w panelu (WyborEkranu.tsx).
// Prawdziwe zrzuty `/turnieje/<id>/ekran` na przykładowym turnieju, w obu
// motywach, jako lekkie JPG w `public/ekran-podglad/`. Uruchamiane ręcznie,
// gdy zmieni się wygląd ekranu:
//
//   ./scripts/stos-bez-dockera.sh start --wszystkie-seedy   (z katalogu głównego)
//   (przygotuj przykładowy turniej: ogłoszenie, link, mecz w toku)
//   npx next dev -p 3005 &
//   node scripts/podglady-ekranu.mjs <id-turnieju> [http://localhost:3005]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const [id, baza = 'http://localhost:3005'] = process.argv.slice(2);
if (!id) { console.error('Podaj id turnieju.'); process.exit(1); }
// Wybrane układy: EKRAN_UKLADY=mecz,wynik node scripts/podglady-ekranu.mjs <id>
const WSZYSTKIE = ['wszystko', 'mecz', 'wynik', 'tabele', 'mecze', 'terminarz', 'ogloszenie'];
const UKLADY = process.env.EKRAN_UKLADY ? process.env.EKRAN_UKLADY.split(',') : WSZYSTKIE;
mkdirSync('public/ekran-podglad', { recursive: true });

// Strona otwiera się pod adresem bojo.pl skierowanym na lokalny serwer, żeby
// podpis i kod QR na miniaturze mówiły „bojo.pl/…”, a nie „localhost:3005/…”.
const port = new URL(baza).port || '80';
const przegladarka = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
  args: [`--host-resolver-rules=MAP bojo.pl:80 127.0.0.1:${port}`],
});
const strona = await przegladarka.newPage({ viewport: { width: 960, height: 540 }, timezoneId: 'Europe/Warsaw' });
for (const motyw of ['ciemny', 'jasny']) {
  for (const uklad of UKLADY) {
    const q = new URLSearchParams({ uklad, ...(motyw === 'jasny' ? { motyw } : {}) });
    await strona.goto(`http://bojo.pl/turnieje/${id}/ekran?${q}`, { waitUntil: 'networkidle', timeout: 240_000 });
    await strona.waitForTimeout(2500);
    await strona.screenshot({ path: `public/ekran-podglad/${uklad}-${motyw}.jpg`, type: 'jpeg', quality: 70 });
    console.log(`✓ ${uklad}-${motyw}`);
  }
}
await przegladarka.close();
