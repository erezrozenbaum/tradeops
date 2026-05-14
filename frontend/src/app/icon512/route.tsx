import { ImageResponse } from 'next/og'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0f172a',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '76px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
          }}
        >
          <div
            style={{
              color: '#38bdf8',
              fontSize: '256px',
              fontWeight: 800,
              fontFamily: 'sans-serif',
              letterSpacing: '-10px',
              lineHeight: 1,
            }}
          >
            T
          </div>
          <div
            style={{
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-end',
            }}
          >
            {[60, 90, 70, 110, 80].map((h, i) => (
              <div
                key={i}
                style={{
                  width: '30px',
                  height: `${h}px`,
                  background: i === 3 ? '#38bdf8' : '#1e3a5f',
                  borderRadius: '8px',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    ),
    { width: 512, height: 512 }
  )
}
