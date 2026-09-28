import { ImageResponse } from 'next/og';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { sportEmoji } from '@/lib/sports';
import { defaultEventTitle } from '@/lib/eventTitle';
import { getEventMeta, policzZajeteMiejsca, stanPodgladu } from './eventMeta';

// Podgląd linku na WhatsAppie/Messengerze był zawsze generyczny (baner strony
// głównej) — `openGraph.images` w page.tsx ustawiał się wyłącznie przy
// `cover_image_url`, a nic w UI nigdy tego pola nie zapisuje. Ten plik
// (konwencja Next.js `opengraph-image.tsx`) generuje kartę per mecz: sport,
// termin, miejsce, wolne miejsca, cena — dokładnie to, co widać na karcie
// meczu w aplikacji. Sam podgląd linku robi połowę roboty konwersji, kiedy
// organizator wkleja go na grupę.

export const runtime = 'edge';
export const alt = 'Bojo: szczegóły meczu';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: { id: string } }) {
  const ev = await getEventMeta(params.id);

  // Dwa przypadki, jedna odpowiedź. (1) Mecz, który zniknął — nigdy 500,
  // generyczna karta zamiast crasha edge functiona. (2) Mecz NIEPUBLICZNY:
  // ten adres jest publiczny i nie wymaga kodu dołączenia, więc karta z nazwą
  // obiektu, terminem, ceną i liczbą wolnych miejsc oddawałaby dokładnie to,
  // czego strzeże link dołączenia. Ten sam próg co w `metadataDlaMeczu()`
  // (./eventMeta.ts) i w `eventJsonLd()` (lib/structuredData.ts).
  if (!ev || ev.visibility !== 'public') {
    return new ImageResponse(<KartaOgolna />, { ...size });
  }

  // Zdjęcie meczu bije wygenerowaną kartę, jeśli kiedyś powstanie UI do
  // jego ustawienia (`cover_image_url` istnieje w bazie od dawna, dziś
  // zapisywane wyłącznie dla grup — patrz `lib/groups.ts`).
  if (ev.cover) {
    return new ImageResponse(
      // eslint-disable-next-line @next/next/no-img-element
      <img src={ev.cover} alt="" width={size.width} height={size.height} style={{ objectFit: 'cover' }} />,
      { ...size },
    );
  }

  let dzien = ev.date;
  try {
    dzien = format(parseISO(ev.date), 'EEEE d MMMM', { locale: pl });
  } catch { /* zostaje surowa data */ }
  const godzina = ev.time ? ev.time.slice(0, 5) : '';

  const nazwa = ev.title || defaultEventTitle(ev.sport, ev.max_players ?? 0);
  const miejsce = ev.field_name || ev.custom_location_name || 'Boisko';

  // Stan podglądu — jedna prawda ze `stanPodgladu()` (Z-3,
  // docs/faza1-runda10-plan.md): odmiana liczby, stan meczu (odwołany,
  // rozegrany, zapisy zamknięte, komplet z rezerwą vs bez) i argument „zapis
  // bez konta". Wcześniej ten sam obrazek mówił „N wolnych miejsc" nawet dla
  // odwołanego czy rozegranego meczu, z odmianą na sztywno.
  const zajete = (await policzZajeteMiejsca(params.id)) ?? 0;
  const stan = stanPodgladu(ev, zajete);

  const cenaTekst = ev.cost_grosz && ev.cost_grosz > 0
    ? `${(ev.cost_grosz / 100).toFixed(2).replace('.', ',')} zł/os.`
    : 'za darmo';

  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(145deg, #15663E 0%, #0c4227 60%, #08311e 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
        }}
      >
        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div
            style={{
              background: '#fff',
              borderRadius: '18px',
              width: '64px',
              height: '64px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '40px',
              fontWeight: 800,
              color: '#15663E',
              letterSpacing: '-2px',
            }}
          >
            B
          </div>
          <span style={{ fontSize: '40px', fontWeight: 800, color: '#fff', letterSpacing: '-1px' }}>
            bojo
          </span>
        </div>

        {/* Sport + nazwa meczu */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <span style={{ fontSize: '84px', lineHeight: 1 }}>{sportEmoji(ev.sport)}</span>
            <p
              style={{
                fontSize: '58px',
                fontWeight: 800,
                color: '#fff',
                margin: 0,
                lineHeight: 1.1,
                letterSpacing: '-1.5px',
                maxWidth: '820px',
              }}
            >
              {nazwa}
            </p>
          </div>

          {/* Termin + miejsce */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <p style={{ fontSize: '30px', color: 'rgba(255,255,255,0.9)', margin: 0, fontWeight: 600 }}>
              {dzien}{godzina ? ` · ${godzina}` : ''}
            </p>
            <p style={{ fontSize: '26px', color: 'rgba(255,255,255,0.65)', margin: 0, fontWeight: 500 }}>
              📍 {miejsce}
            </p>
          </div>
        </div>

        {/* Pigułki: skład + cena, plus argument „bez konta" pod nimi (Z-3,
            D-13: na samym obrazku, nie wyłącznie w opisie tekstowym — ten
            drugi bywa niewidoczny w zależności od komunikatora). */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            {stan.pigulka && (
              <div
                style={{
                  background: stan.wyroznij ? '#F5A623' : 'rgba(255,255,255,0.12)',
                  border: stan.wyroznij ? 'none' : '1.5px solid rgba(255,255,255,0.25)',
                  borderRadius: '100px',
                  padding: '14px 32px',
                  fontSize: '24px',
                  fontWeight: 700,
                  color: stan.wyroznij ? '#1A1D21' : '#fff',
                }}
              >
                {stan.pigulka}
              </div>
            )}
            <div
              style={{
                background: 'rgba(255,255,255,0.12)',
                border: '1.5px solid rgba(255,255,255,0.25)',
                borderRadius: '100px',
                padding: '14px 32px',
                fontSize: '24px',
                fontWeight: 600,
                color: '#fff',
              }}
            >
              {cenaTekst}
            </div>
          </div>
          {stan.bezKonta && (
            <p style={{ fontSize: '26px', color: 'rgba(255,255,255,0.8)', margin: 0, fontWeight: 500 }}>
              Zapis bez zakładania konta
            </p>
          )}
        </div>
      </div>
    ),
    { ...size },
  );
}

function KartaOgolna() {
  return (
    <div
      style={{
        background: 'linear-gradient(145deg, #15663E 0%, #0c4227 60%, #08311e 100%)',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '18px',
          width: '80px',
          height: '80px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '48px',
          fontWeight: 800,
          color: '#15663E',
        }}
      >
        B
      </div>
      <p style={{ fontSize: '44px', fontWeight: 800, color: '#fff', margin: 0 }}>bojo</p>
      {/* Mecz prywatny albo nieistniejący — ŻADNYCH danych meczu (Z-3): ten
          adres jest publiczny, więc karta nie może zdradzić nic z tego, co
          chroni kod dołączenia. */}
      <p style={{ fontSize: '32px', color: 'rgba(255,255,255,0.8)', margin: 0, fontWeight: 500 }}>
        Otwórz link, żeby zobaczyć szczegóły meczu
      </p>
    </div>
  );
}
