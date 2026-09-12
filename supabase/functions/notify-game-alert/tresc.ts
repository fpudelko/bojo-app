/**
 * Treść alertu o nowej grze w okolicy — czysty TypeScript (bez `Deno`,
 * bez sieci), więc testowany Vitestem razem z resztą repo
 * (`frontend/src/__tests__/alertGry.test.ts`), tym samym wzorcem
 * co `powiadom-goscia/tresc.ts`.
 *
 * PO CO POWSTAŁ. Do 2026-09-12 mail niósł wyłącznie datę i godzinę: `label`
 * liczył się jako `${sport} — ${field_name}`, a `field_name` bywa ogólną
 * nazwą typu boiska („Boisko piłkarskie”), nie adresem. Nie było ceny ani
 * liczby miejsc — dokładnie tego, co człowiek sprawdza, zanim zdecyduje, czy
 * w ogóle kliknąć. Reszta aplikacji ma na to jeden wzorzec —
 * `eventShareText()` w `frontend/src/lib/eventShare.ts` — ten plik powiela
 * ten sam kształt (nazwa+adres, miejsca, cena), bo Deno nie zaimportuje
 * kodu z `frontend/src` (inny runtime, inny bundler).
 */

const ZIELEN = '#15663E';
const ATRAMENT = '#1A1D21';
const PLOTNO = '#FAF9F6';
const SZARY = '#5b6470';
const OBWODKA = '#e3e6e3';

// Tylko emoji — reszta `SPORT_CONFIG` (kolor, etykieta) nie jest tu
// potrzebna, a `sport` z bazy jest już czytelnym polskim słowem
// („piłka nożna”), więc etykieta to po prostu ta sama nazwa z wielkiej litery.
const EMOJI: Record<string, string> = {
  'piłka nożna': '⚽', 'futsal': '⚽', 'siatkówka': '🏐',
  'siatkówka plażowa': '🏖️', 'koszykówka': '🏀', 'piłka ręczna': '🤾',
};

export interface DaneAlertu {
  sport: string;
  title: string | null;
  maxPlayers: number;
  costGrosz: number | null;
  fieldName: string | null;
  fieldAddress: string | null;
  customLocationName: string | null;
  customAddress: string | null;
  /** ISO `YYYY-MM-DD`, jak zwraca PostgREST dla kolumny `DATE`. */
  eventDate: string;
  /** `HH:MM` albo `HH:MM:SS`, jak zwraca PostgREST dla kolumny `TIME`. */
  eventTime: string;
}

/** Polska odmiana przez liczbę — port `frontend/src/lib/plural.ts`. Nastolatki
 *  (11-14) biorą formę mnogą dopełniaczową mimo końcówki 2-4; 14 jest przy tym
 *  domyślnym składem piłkarskim w kreatorze, czyli najczęstszą liczbą w apce —
 *  reguła `n < 5` psuje się właśnie na niej. */
export function withCount(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(Math.trunc(n));
  const forma = abs === 1 ? one
    : (abs % 100 >= 12 && abs % 100 <= 14) ? many
    : (abs % 10 >= 2 && abs % 10 <= 4) ? few
    : many;
  return `${n} ${forma}`;
}

/** Nazwa i adres miejsca — port `eventLocation()` z `frontend/src/lib/utils.ts`,
 *  bez `district` (kolumny nie ma na `events`; drugorzędna i tak). */
export function miejsce(e: {
  fieldName: string | null; fieldAddress: string | null;
  customLocationName: string | null; customAddress: string | null;
}): { primary: string; secondary: string | null } {
  const isBareNumber = (s: string | null) => !!s && /^\d+$/.test(s.trim());
  const name = !isBareNumber(e.fieldName) ? e.fieldName?.trim() || null : null;
  const custom = e.customLocationName?.trim() || null;
  const addr = e.fieldAddress?.trim() || e.customAddress?.trim() || null;
  const cleanAddr = addr && !isBareNumber(addr) ? addr : null;
  const primary = name || custom || cleanAddr || 'Lokalizacja na mapie';
  let secondary: string | null = null;
  if (cleanAddr && cleanAddr !== primary) {
    const prefiks = `${primary}, `;
    secondary = cleanAddr.toLowerCase().startsWith(prefiks.toLowerCase())
      ? cleanAddr.slice(prefiks.length).trim() || null
      : cleanAddr;
  }
  return { primary, secondary };
}

function tytul(d: DaneAlertu): { emoji: string; label: string } {
  const emoji = EMOJI[d.sport] ?? '🏟️';
  const sportLabel = d.sport ? d.sport[0].toUpperCase() + d.sport.slice(1) : 'Sport';
  const squadSuffix = d.maxPlayers > 0
    ? (d.maxPlayers % 2 === 0 ? ` ${d.maxPlayers / 2}v${d.maxPlayers / 2}` : ` · ${d.maxPlayers} os.`)
    : '';
  return { emoji, label: d.title?.trim() || `${sportLabel}${squadSuffix}` };
}

/** `DD.MM.YYYY` z `event_date` — ten sam zapis co `to_char(..., 'DD.MM.YYYY')`
 *  w migracji `133`, tylko liczony po stronie JS, bo ta funkcja czyta bazę
 *  bezpośrednio (nie dostaje gotowego tekstu z wyzwalacza SQL). */
function dataPl(iso: string): string {
  const [rok, miesiac, dzien] = iso.split('-');
  return `${dzien}.${miesiac}.${rok}`;
}

function godzinaPl(t: string): string {
  return t.slice(0, 5);
}

function zl(grosze: number | null): string {
  if (!grosze || grosze <= 0) return 'za darmo';
  return `${(grosze / 100).toFixed(2).replace('.', ',')} zł od osoby`;
}

/** Jedna linijka: kiedy · gdzie · ile miejsc · za ile. */
export function szczegoly(d: DaneAlertu): string {
  const { primary, secondary } = miejsce(d);
  const gdzie = secondary ? `${primary}, ${secondary}` : primary;
  const miejscaOsob = withCount(d.maxPlayers, 'miejsce', 'miejsca', 'miejsc');
  return `${dataPl(d.eventDate)}, godz. ${godzinaPl(d.eventTime)} · ${gdzie} · ${miejscaOsob} · ${zl(d.costGrosz)}`;
}

export interface Mail {
  temat: string;
  label: string;
  emoji: string;
  szczegoly: string;
}

export function tresc(d: DaneAlertu, dataDlaTematu: string): Mail {
  const { emoji, label } = tytul(d);
  return { temat: `Alert: ${label} — ${dataDlaTematu}`, label, emoji, szczegoly: szczegoly(d) };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export interface Kontakt {
  strona: string;
  eventUrl: string;
  odpowiedzNa: string;
}

export function doHtml(m: Mail, k: Kontakt): string {
  const domena = k.strona.replace(/^https?:\/\//, '');
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(m.label)}</title></head>
<body style="margin:0;padding:0;background:${PLOTNO};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PLOTNO};padding:20px 12px;"><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:#ffffff;border:1px solid ${OBWODKA};border-radius:14px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td style="background:${ZIELEN};padding:18px 24px;">
  <a href="${esc(k.strona)}" style="font-size:20px;font-weight:700;color:#ffffff;text-decoration:none;">⚽ Bojo</a>
</td></tr>
<tr><td style="padding:24px;">
  <p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:${ATRAMENT};">Cześć!</p>
  <p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:${ATRAMENT};">Pojawiła się nowa gra pasująca do Twojego alertu:</p>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px;border-collapse:separate;"><tr><td
    style="background:${PLOTNO};border:1px solid ${OBWODKA};border-left:4px solid ${ZIELEN};border-radius:10px;padding:14px 16px;">
    <div style="font-size:17px;font-weight:700;color:${ATRAMENT};line-height:1.35;">${m.emoji} ${esc(m.label)}</div>
    <div style="margin-top:5px;font-size:15px;color:${SZARY};line-height:1.45;">${esc(m.szczegoly)}</div>
  </td></tr></table>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px 0 4px;"><tr><td align="center" style="background:${ZIELEN};border-radius:10px;">
    <a href="${esc(k.eventUrl)}" style="display:block;padding:14px 20px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">Zobacz mecz →</a>
  </td></tr></table>
</td></tr>
<tr><td style="background:${PLOTNO};border-top:1px solid ${OBWODKA};padding:16px 24px;">
  <p style="margin:0;font-size:13px;line-height:1.5;color:${SZARY};">
    Zarządzaj alertami na <a href="${esc(k.strona)}" style="color:${ZIELEN};text-decoration:none;">${esc(domena)}</a><br>
    Coś nie gra? Napisz na <a href="mailto:${esc(k.odpowiedzNa)}" style="color:${ZIELEN};text-decoration:none;">${esc(k.odpowiedzNa)}</a> — czytamy każdą wiadomość.
  </p>
</td></tr>
</table></td></tr></table></body></html>`;
}

export function doTekstu(m: Mail, k: Kontakt): string {
  return `Cześć!\n\nPojawiła się nowa gra pasująca do Twojego alertu:\n\n`
    + `${m.label}\n${m.szczegoly}\n\nZobacz mecz:\n${k.eventUrl}\n\n`
    + `Zarządzaj alertami na ${k.strona}\n`
    + `Coś nie gra? Napisz na ${k.odpowiedzNa} — czytamy każdą wiadomość.\n`;
}
