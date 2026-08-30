import { redirect } from 'next/navigation';

// Gołe `/boiska` (bez sportu) dawało 404 — trasa istnieje tylko jako
// `/boiska/[sport]`. Zgłoszone wprost z sesji QA: „«Mapa boisk» w stopce/
// nagłówku sugeruje taki adres" — w rzeczywistości te linki prowadzą na
// `/mapa?gry=0`, ale ktoś, kto trafił na `/boiska/pilka-nozna` i skrócił
// adres w pasku przeglądarki, oczekuje strony pod nim. Ten sam wzorzec co
// `/gracze` → `/wydarzenia`.
export default function BoiskaRedirect() {
  redirect('/mapa?gry=0');
}
