/**
 * Chmurka wiadomości jako wskaźnik przy ikonie — nie ikona z biblioteki.
 *
 * `MessageCircle` z lucide w rozmiarze 12 px zlewał się w plamę: to okrąg
 * z detalami w środku, a wypełniony traci wszystko poza obrysem (zgłoszone
 * wprost). Tu jest kształt rysowany pod ten jeden rozmiar: prostokąt
 * z zaokrąglonymi rogami i ogonkiem w lewym dolnym rogu, bez żadnych detali
 * w środku — czytelny przy 12 pikselach.
 *
 * Biała obwódka jest częścią kształtu (`paint-order: stroke` rysuje obrys POD
 * wypełnieniem, więc nie zjada kształtu), nie ringiem z Tailwinda — ring
 * rysuje prostokąt wokół pola ikony, a chmurka prostokątem nie jest. Obwódka
 * odcina ją od kreski ikony pod spodem.
 *
 * `viewBox` ma zapas 2 px z każdej strony, bo obrys wychodzi poza kształt
 * i bez zapasu zostałby przycięty.
 */
export default function IkonaWiadomosci({ className }: { className?: string }) {
  return (
    <svg
      viewBox="-2 -2 18 18"
      className={className}
      fill="currentColor"
      stroke="white"
      strokeWidth={2}
      strokeLinejoin="round"
      style={{ paintOrder: 'stroke' }}
      aria-hidden="true"
    >
      <path d="M3 0.5H11A2.5 2.5 0 0 1 13.5 3V7.5A2.5 2.5 0 0 1 11 10H6.5L3 13V10A2.5 2.5 0 0 1 0.5 7.5V3A2.5 2.5 0 0 1 3 0.5Z" />
    </svg>
  );
}
