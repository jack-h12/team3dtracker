import { NextRequest, NextResponse } from 'next/server'
import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // DST guard: scheduled at both 20:55 and 21:55 UTC so one hits 4:55 PM Eastern.
  const easternParts = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  })
  const [hStr, mStr] = easternParts.split(/[:\s]/).filter(Boolean)
  const easternHour = parseInt(hStr, 10)
  const easternMinute = parseInt(mStr, 10)
  if (easternHour !== 16) {
    return NextResponse.json({
      skipped: true,
      message: `Current Eastern time is ${easternHour}:${easternMinute}, not 16:xx. Skipping.`,
    })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (!supabaseUrl || !supabaseServiceKey || !webhookUrl) {
    return NextResponse.json(
      { error: 'Missing env vars (SUPABASE_URL / SERVICE_ROLE_KEY / DISCORD_WEBHOOK_URL)' },
      { status: 500 }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Pull current daily standings (same sort the live leaderboard uses).
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_level, tasks_completed_today, completed_all_tasks_at')
    .order('avatar_level', { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: 'Failed to load leaderboard', details: error.message }, { status: 500 })
  }

  const sorted = [...(profiles || [])].sort((a: any, b: any) => {
    const aDone = a.completed_all_tasks_at != null
    const bDone = b.completed_all_tasks_at != null
    if (aDone && bDone) {
      return new Date(a.completed_all_tasks_at).getTime() - new Date(b.completed_all_tasks_at).getTime()
    }
    if (aDone && !bDone) return -1
    if (!aDone && bDone) return 1
    return (b.avatar_level || 0) - (a.avatar_level || 0)
  })

  const top = sorted.slice(0, 10)
  if (top.length === 0) {
    return NextResponse.json({ skipped: true, message: 'No users to rank.' })
  }

  const winner = top[0]
  const winnerName = winner.display_name || winner.username || 'Unknown'
  const dateLabel = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  // Build the leaderboard card image with next/og.
  const image = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#0a0a0a',
          padding: '50px 60px',
          fontFamily: 'sans-serif',
          color: '#fff',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '24px' }}>
          <div style={{ fontSize: 48, fontWeight: 800, color: '#ff6b35', letterSpacing: '-1px' }}>
            DAILY LEADERBOARD
          </div>
          <div style={{ fontSize: 22, color: '#888', marginTop: 6 }}>{dateLabel}</div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            background: '#141414',
            border: '1px solid #2a2a2a',
            borderRadius: 16,
            padding: '20px 24px',
            gap: 6,
          }}
        >
          {top.map((p: any, i: number) => {
            const rank = i + 1
            const name = p.display_name || p.username || 'Unknown'
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
            const isWinner = rank === 1
            return (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: isWinner ? 'rgba(255, 107, 53, 0.12)' : 'transparent',
                  border: isWinner ? '1px solid rgba(255, 107, 53, 0.35)' : '1px solid transparent',
                }}
              >
                <div style={{ width: 56, fontSize: 28, fontWeight: 700, color: '#888' }}>
                  {medal || `#${rank}`}
                </div>
                <div
                  style={{
                    flex: 1,
                    fontSize: 26,
                    fontWeight: isWinner ? 800 : 600,
                    color: isWinner ? '#ff6b35' : '#fff',
                  }}
                >
                  {name}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#4caf50' }}>
                  {p.tasks_completed_today || 0}/10
                </div>
                <div
                  style={{
                    marginLeft: 18,
                    fontSize: 20,
                    fontWeight: 700,
                    color: '#ffd700',
                    padding: '4px 12px',
                    background: 'rgba(255, 215, 0, 0.1)',
                    borderRadius: 8,
                  }}
                >
                  Lv.{p.avatar_level || 0}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: 'auto', fontSize: 16, color: '#555', display: 'flex' }}>
          team3d · standings captured at 4:55 PM EST
        </div>
      </div>
    ),
    { width: 1100, height: 700 }
  )

  const imageBuffer = await image.arrayBuffer()

  const form = new FormData()
  form.append(
    'payload_json',
    JSON.stringify({
      content: `🏆 Congratulations to **${winnerName}**! Today's daily leaderboard winner.`,
    })
  )
  form.append('files[0]', new Blob([imageBuffer], { type: 'image/png' }), 'leaderboard.png')

  const discordRes = await fetch(webhookUrl, { method: 'POST', body: form })
  if (!discordRes.ok) {
    const text = await discordRes.text()
    return NextResponse.json(
      { error: 'Discord post failed', status: discordRes.status, details: text },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, winner: winnerName, ranked: top.length })
}
