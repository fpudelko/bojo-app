import { defineConfig, devices } from '@playwright/test';

// Testy przeglądarkowe — świadomie WĄSKI zakres.
//
// Nie sprawdzają logiki (od tego jest Vitest) ani wyglądu. Sprawdzają jedną
// rzecz, której nie widzi żadne inne narzędzie w tym repo: **czy da się kliknąć**.
// Błąd, który wyłożył produkcję (modale bez z-indexu, przycisk „Dołącz"
// przykryty paskiem nawigacji), był niewidoczny dla `tsc`, ESLinta i testów
// jednostkowych — a Playwright zgłasza go wprost: „element intercepts pointer
// events".
//
// Dlatego bez logowania i bez bazy: uruchamiamy build produkcyjny na atrapach
// kluczy i chodzimy po widokach dostępnych bez konta.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'on-first-retry',
    // Chromium jest w obrazie (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`),
    // ale wersja @playwright/test bywa inna niż ta, dla której go pobrano —
    // wtedy Playwright szuka własnego katalogu i prosi o `playwright install`.
    // Wskazanie binarki wprost omija ten rozjazd. W CI, gdzie przeglądarki
    // instaluje `playwright install --with-deps`, zmiennej nie ma i wybór
    // zostaje domyślny.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM }
      : undefined,
  },

  // Wzorce zrzutów leżą obok testów i idą do repo — dzięki temu zmiana widoku
  // pokazuje się w PR-ze jako różnica obrazków, z suwakiem „przed/po".
  snapshotPathTemplate: '{testDir}/wzorce/{projectName}/{arg}{ext}',
  expect: {
    toHaveScreenshot: {
      // Kompresja PNG i podpikselowe różnice renderowania czcionek potrafią
      // ruszyć pojedyncze piksele bez żadnej zmiany w kodzie. Próg dobrany
      // tak, żeby przepuszczał szum, a łapał zmianę układu albo koloru.
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },

  projects: [
    // Klikalność: bez bazy, bez wzorców — najtańsza bramka, wchodzi do CI.
    { name: 'telefon', use: { ...devices['Pixel 7'] }, testMatch: /klikalnosc\.spec\.ts/ },
    { name: 'komputer', use: { ...devices['Desktop Chrome'] }, testMatch: /klikalnosc\.spec\.ts/ },
    // Zrzuty osobno: tylko one potrzebują wzorców i tylko one mają sens
    // w dwóch stałych rozmiarach okna.
    {
      name: 'zrzuty-telefon',
      use: { ...devices['Pixel 7'] },
      testMatch: /wizualne\.spec\.ts/,
    },
    {
      name: 'zrzuty-komputer',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
      testMatch: /wizualne\.spec\.ts/,
    },
    // Scenariusze za logowaniem — wymagają lokalnego stosu Supabase, więc
    // uruchamiane osobno (`npm run scenariusze`, workflow `wizualne.yml`).
    {
      name: 'scenariusze-telefon',
      use: { ...devices['Pixel 7'] },
      testMatch: /scenariusze\.spec\.ts/,
    },
    {
      name: 'scenariusze-komputer',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
      testMatch: /scenariusze\.spec\.ts/,
    },
  ],

  webServer: {
    command: 'npm run start -- --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder-anon-key',
    },
  },
});
