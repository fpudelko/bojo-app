// Skala warstw (z-index) — jedno miejsce, w którym wiadomo, co jest nad czym.
//
// Powód istnienia: liczby były wklepywane wprost w `className` kilkunastu
// komponentów i nikt nie widział ich obok siebie. Dolna nawigacja poszła
// z `z-[1000]` na `z-[1200]`, żeby karty na mapie przestały ją przykrywać —
// i tym samym wjechała NAD wszystkie modale, które stały na `z-[1100]`.
// Objaw: pasek „Znajdź grę / Mapa / Nowy…" na wierzchu okna „Wypisać się
// z meczu?". Do tego jedno okno w widoku meczu miało `z-50`, czyli chowało
// się pod nagłówkiem.
//
// Zasada: modal zawsze nad nawigacją, toast zawsze nad modalem. Zmieniasz
// kolejność — zmieniasz ją tutaj, nie w komponencie.

export const WARSTWA = {
  /** Pływające elementy wewnątrz mapy (karty obiektów, pigułki filtrów). */
  nakladkaMapy: 'z-[1100]',
  /** Dolna nawigacja na telefonie. */
  nawigacjaDolna: 'z-[1200]',
  /** Tło modala — przykrywa wszystko łącznie z nawigacją. */
  modal: 'z-[1300]',
  /** Panel modala, gdy tło i treść są osobnymi elementami (np. FilterSheet). */
  modalPanel: 'z-[1301]',
  /** Toasty — komunikat o wyniku akcji musi być widoczny także nad modalem. */
  toast: 'z-[9999]',
} as const;
