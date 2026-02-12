import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = "Mark's AI 3.0 - Automated Gold AI Trading"
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0a0f 0%, #12121a 40%, #0a0a0f 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background glow effects */}
        <div style={{ position: 'absolute', top: '-100px', left: '-100px', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)', display: 'flex' }} />
        <div style={{ position: 'absolute', bottom: '-100px', right: '-100px', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.15) 0%, transparent 70%)', display: 'flex' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(234,179,8,0.08) 0%, transparent 70%)', display: 'flex' }} />

        {/* Top accent line */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #06b6d4, #eab308, #a855f7, #06b6d4)', display: 'flex' }} />

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', zIndex: 10 }}>
          {/* Logo badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '80px',
            height: '80px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(168,85,247,0.2))',
            border: '2px solid rgba(6,182,212,0.4)',
            fontSize: '40px',
          }}>
            🤖
          </div>

          {/* Title */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
          }}>
            <div style={{
              fontSize: '52px',
              fontWeight: 900,
              color: 'white',
              letterSpacing: '-1px',
              display: 'flex',
            }}>
              MARK&apos;S AI 3.0
            </div>
            <div style={{
              fontSize: '22px',
              fontWeight: 600,
              background: 'linear-gradient(90deg, #06b6d4, #eab308)',
              backgroundClip: 'text',
              color: 'transparent',
              display: 'flex',
            }}>
              ADVANCED AI GOLD SCALPER
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: '40px', marginTop: '20px' }}>
            {[
              { value: '24/5', label: 'Auto Trading' },
              { value: '70-250%', label: 'Expected Profit' },
              { value: '$10', label: 'Min Investment' },
            ].map((stat) => (
              <div key={stat.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#06b6d4', display: 'flex' }}>{stat.value}</div>
                <div style={{ fontSize: '13px', color: '#9ca3af', display: 'flex' }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{
            marginTop: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'linear-gradient(90deg, #22c55e, #06b6d4)',
            padding: '12px 32px',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: 700,
            color: 'black',
          }}>
            START EARNING NOW — No Trading Experience Needed
          </div>

          {/* URL */}
          <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px', display: 'flex' }}>
            markstrades.com
          </div>
        </div>

        {/* Bottom accent */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #a855f7, #eab308, #06b6d4, #a855f7)', display: 'flex' }} />
      </div>
    ),
    { ...size }
  )
}
