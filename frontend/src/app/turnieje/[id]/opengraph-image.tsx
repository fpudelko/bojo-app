import { ImageResponse } from 'next/og';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { createClient } from '@supabase/supabase-js';
import { sportEmoji } from '@/lib/sports';

// Ten sam wzorzec co `wydarzenia/[id]/opengraph-image.tsx`: podgląd linku na
// WhatsAppie/Messengerze wygenerowany per turniej — sport, termin, miejsce,
// liczba drużyn, wpisowe — dokładnie to, co widać na karcie turnieju.

export const runtime = 'edge';
export const alt = 'Bojo: szczegóły turnieju';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export default async function Image({ params }: { params: { id: string } }) {
  const { data: t } = await supabasePublic
    .from('turnieje')
    .select('nazwa, sport, data_startu, godzina_startu, miejsce_nazwa, miasto, max_druzyn, wpisowe_grosz')
    .eq('id', params.id)
    .maybeSingle();

  if (!t) {
    return new ImageResponse(<KartaOgolna />, { ...size });
  }

  let dzien = t.data_startu;
  try {
    dzien = format(parseISO(t.data_startu), 'EEEE d MMMM', { locale: pl });
  } catch { /* zostaje surowa data */ }
  const godzina = t.godzina_startu ? String(t.godzina_startu).slice(0, 5) : '';

  const { count } = await supabasePublic
    .from('turniej_druzyny')
    .select('*', { count: 'exact', head: true })
    .eq('turniej_id', params.id)
    .in('status', ['zgloszona', 'przyjeta']);
  const druzynTekst = `${count ?? 0}/${t.max_druzyn} drużyn`;

  const miejsce = t.miejsce_nazwa || t.miasto || '';
  const wpisoweTekst = t.wpisowe_grosz > 0 ? `${(t.wpisowe_grosz / 100).toFixed(0)} zł wpisowe` : 'bez wpisowego';

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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <span style={{ fontSize: '84px', lineHeight: 1 }}>🏆</span>
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
              {t.nazwa}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <p style={{ fontSize: '30px', color: 'rgba(255,255,255,0.9)', margin: 0, fontWeight: 600 }}>
              {sportEmoji(t.sport)} {dzien}{godzina ? ` · ${godzina}` : ''}
            </p>
            {miejsce && (
              <p style={{ fontSize: '26px', color: 'rgba(255,255,255,0.65)', margin: 0, fontWeight: 500 }}>
                📍 {miejsce}
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <div
            style={{
              background: '#F5A623',
              borderRadius: '100px',
              padding: '14px 32px',
              fontSize: '24px',
              fontWeight: 700,
              color: '#1A1D21',
            }}
          >
            {druzynTekst}
          </div>
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
            {wpisoweTekst}
          </div>
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
    </div>
  );
}
