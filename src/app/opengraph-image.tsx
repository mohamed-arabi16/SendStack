import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'SendStack — Bulk Email & WhatsApp Messaging Platform';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '60px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              color: 'white',
              fontWeight: 'bold',
            }}
          >
            S
          </div>
          <span
            style={{
              fontSize: '48px',
              fontWeight: 'bold',
              color: 'white',
              letterSpacing: '-1px',
            }}
          >
            SendStack
          </span>
        </div>

        <div
          style={{
            fontSize: '28px',
            color: '#a5b4fc',
            textAlign: 'center',
            maxWidth: '800px',
            lineHeight: 1.4,
            marginBottom: '24px',
          }}
        >
          Bulk Email & WhatsApp Messaging Platform
        </div>

        <div
          style={{
            fontSize: '18px',
            color: '#94a3b8',
            textAlign: 'center',
            maxWidth: '700px',
            lineHeight: 1.5,
            marginBottom: '40px',
          }}
        >
          Upload a CSV, personalize with template variables, and send at scale.
          Free, open-source, fully offline.
        </div>

        <div
          style={{
            display: 'flex',
            gap: '16px',
          }}
        >
          {['SMTP Email', 'WhatsApp', 'Spin Syntax', 'Anti-Ban', 'Multilingual'].map(
            (tag) => (
              <div
                key={tag}
                style={{
                  background: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: '20px',
                  padding: '8px 20px',
                  color: '#a5b4fc',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                {tag}
              </div>
            )
          )}
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: '30px',
            right: '40px',
            fontSize: '14px',
            color: '#64748b',
          }}
        >
          by Qobouli AI & Dev
        </div>
      </div>
    ),
    { ...size }
  );
}
