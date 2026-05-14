import { ImageResponse } from 'next/og'

export const size = { width: 192, height: 192 }
export const contentType = 'image/png'

export default function Icon() {
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
          borderRadius: '28px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <div
            style={{
              color: '#38bdf8',
              fontSize: '96px',
              fontWeight: 800,
              fontFamily: 'sans-serif',
              letterSpacing: '-4px',
              lineHeight: 1,
            }}
          >
            T
          </div>
          <div
            style={{
              display: 'flex',
              gap: '4px',
              alignItems: 'flex-end',
            }}
          >
            {[24, 36, 28, 44, 32].map((h, i) => (
              <div
                key={i}
                style={{
                  width: '12px',
                  height: `${h}px`,
                  background: i === 3 ? '#38bdf8' : '#1e3a5f',
                  borderRadius: '3px',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    ),
    size
  )
}
