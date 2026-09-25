import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    // `src/lib` też trzyma nazwy klas: skalę warstw (`lib/warstwy.ts`) i toasty
    // (`lib/toast.tsx`). Bez tej ścieżki Tailwind ich nie widzi i po prostu NIE
    // GENERUJE — komponent dostaje nazwę klasy, której nie ma w CSS, więc
    // element zostaje bez z-indexu. Tak zniknęły wszystkie modale pod paskiem
    // „Dołącz" (`z-30`), a toast `z-[9999]` nie działał już wcześniej.
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],

  // Warstwy trzymamy dodatkowo tutaj. Skanowanie plików to heurystyka po
  // tekście — wystarczy, że ktoś złoży nazwę klasy ze zmiennej albo zawęzi
  // `content`, i cała kolejność nakładania znika bez jednego błędu w konsoli.
  // Te cztery klasy są zbyt tanie i zbyt krytyczne, żeby na tym polegać.
  safelist: ['z-[1100]', 'z-[1200]', 'z-[1250]', 'z-[1300]', 'z-[1301]', 'z-[9999]'],
  theme: {
    extend: {
      colors: {
        // NEUTRAL — nadpisuje domyślny `slate` Tailwinda (redesign 2026-09).
        // Szarość `slate` (chłodna, niebieskawa) była najbardziej rozpoznawalnym
        // śladem interfejsu z generatora; ta jest lekko podbarwiona zielenią marki.
        // Nazwa zostaje `slate`, bo używa jej ~4000 klas w repo i reguły trybu
        // ciemnego w globals.css — zmienia się odcień, nie znaczenie (szary
        // nadal niesie wyłącznie „zapisy zamknięte", patrz AGENTS.md).
        slate: {
          50:  '#F6F7F5',
          100: '#EEF0EE',
          200: '#E3E6E3',
          300: '#D5DAD6',
          400: '#8B958F',
          500: '#5B6660',
          600: '#4A544F',
          700: '#3B4540',
          800: '#252D29',
          900: '#0E1411',
          950: '#070A08',
        },
        // Working brand palette — finalną zatwierdzi grafik.
        primary: {
          50:  '#f0fdf5',
          100: '#d8f5e4',
          200: '#b2ebca',
          300: '#7dd8a8',
          400: '#44be80',
          500: '#22a361',
          600: '#15803d',   // legacy compat
          700: '#15663E',   // brand green — main
          800: '#104d2e',
          900: '#0b3420',
          950: '#061d12',
        },
        secondary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        // Amber accent #F5A623 — CTA główny, highlights
        accent: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#F5A623',   // brand amber
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        ink:    'var(--color-ink)',
        canvas: 'var(--color-canvas)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          raised:  'var(--color-surface-raised)',
          overlay: 'var(--color-surface-overlay)',
        },
      },
      fontFamily: {
        // Jedna rodzina (Geist) — hierarchia z rozmiaru i wagi, nie z drugiego
        // kroju. `display` zostaje jako alias, żeby nie ruszać ~80 miejsc.
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
      },
      // KANCIASTO — redesign 2026-09. Zaokrąglenia `xl`/`2xl` (12–16 px) na
      // każdej karcie były drugim głównym śladem generatora i zjadały miejsce
      // na telefonie. Skala zostaje (nie ruszamy ~650 klas), ale każdy stopień
      // schodzi do 2–4 px. `full` zostaje okrągłe: kropki, przełączniki,
      // awatary, spinnery.
      borderRadius: {
        sm: '2px',
        DEFAULT: '2px',
        md: '2px',
        lg: '3px',
        xl: '3px',
        '2xl': '4px',
        '3xl': '4px',
      },
      boxShadow: {
        // Karty są płaskie: hierarchię budują linie i odstępy, nie cienie.
        // `sm` i domyślny cień (121 + 23 użycia, prawie wyłącznie karty
        // i przyciski) gaszą się tutaj; `md` i wyżej zostają dla warstw,
        // które naprawdę leżą NAD treścią (menu, okna, toasty).
        sm: '0 0 #0000',
        DEFAULT: '0 0 #0000',
        card: '0 0 #0000',
        'card-hover': '0 0 0 1px rgb(14 20 17 / 0.10)',
        'glow-accent': '0 0 0 1px rgb(132 204 22 / 0.25), 0 8px 24px -8px rgb(132 204 22 / 0.45)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.9s ease-out both',
        'slide-up': 'slide-up 0.2s ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
