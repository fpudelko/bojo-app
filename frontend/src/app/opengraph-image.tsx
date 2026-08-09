import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Bojo — zbierz ekipę, zagraj dziś';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
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
        {/* Decorative sport emojis — top right */}
        <div
          style={{
            position: 'absolute',
            top: '40px',
            right: '60px',
            display: 'flex',
            gap: '18px',
            fontSize: '72px',
            opacity: 0.12,
            transform: 'rotate(8deg)',
          }}
        >
          <span>⚽</span>
          <span>🏀</span>
          <span>🏐</span>
          <span>🎾</span>
          <span>🤾</span>
        </div>

        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div
            style={{
              background: '#fff',
              borderRadius: '18px',
              width: '72px',
              height: '72px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '44px',
              fontWeight: '800',
              color: '#15663E',
              letterSpacing: '-2px',
            }}
          >
            B
          </div>
          <span
            style={{
              fontSize: '52px',
              fontWeight: '800',
              color: '#fff',
              letterSpacing: '-1px',
            }}
          >
            bojo
          </span>
        </div>

        {/* Main headline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p
            style={{
              fontSize: '64px',
              fontWeight: '800',
              color: '#fff',
              margin: 0,
              lineHeight: 1.1,
              letterSpacing: '-1.5px',
            }}
          >
            Zbierz ekipę,
            <br />
            zagraj dziś.
          </p>
          <p
            style={{
              fontSize: '26px',
              color: 'rgba(255,255,255,0.65)',
              margin: 0,
              fontWeight: '500',
            }}
          >
            Boiska i mecze w całej Polsce
          </p>
        </div>

        {/* CTA pills */}
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <div
            style={{
              background: '#F5A623',
              borderRadius: '100px',
              padding: '14px 32px',
              fontSize: '22px',
              fontWeight: '700',
              color: '#1A1D21',
            }}
          >
            Znajdź grę →
          </div>
          <div
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: '1.5px solid rgba(255,255,255,0.25)',
              borderRadius: '100px',
              padding: '14px 32px',
              fontSize: '22px',
              fontWeight: '600',
              color: '#fff',
            }}
          >
            Stwórz mecz
          </div>
          <span
            style={{
              marginLeft: 'auto',
              fontSize: '18px',
              color: 'rgba(255,255,255,0.4)',
              fontWeight: '500',
            }}
          >
            bojo-app.vercel.app
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
