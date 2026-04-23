/**
 * Testosterone Commandments
 *
 * Daily tracker for the Ten Testosterone Commandments. Each commandment
 * gets a 1–10 slider representing how well the user adhered to it that
 * day. A radar chart visualises recent performance and a leaderboard
 * ranks users by daily or weekly adherence score.
 */

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  COMMANDMENTS,
  TIER_META,
  averagePerCommandment,
  averageScore,
  getCurrentWeekStart,
  getDailyTestosteroneLeaderboard,
  getRecentDates,
  getScoresForDate,
  getScoresInRange,
  getWeeklyTestosteroneLeaderboard,
  upsertScore,
} from '@/lib/testosterone'
import type {
  Commandment,
  CommandmentKey,
  ScoreMap,
  TestosteroneLeaderboardRow,
} from '@/lib/testosterone'
import { getCurrentTaskDate } from '@/lib/tasks'
import { getDisplayName } from '@/lib/supabase'
import { getAvatarImage } from '@/lib/utils'

type Tab = 'today' | 'week' | 'leaderboard'

type Props = {
  userId: string
}

export default function Testosterone({ userId }: Props) {
  const [tab, setTab] = useState<Tab>('today')
  const [todayScores, setTodayScores] = useState<ScoreMap>({})
  const [weekAverages, setWeekAverages] = useState<ScoreMap>({})
  const [daysLogged, setDaysLogged] = useState(0)
  const [dailyBoard, setDailyBoard] = useState<TestosteroneLeaderboardRow[]>([])
  const [weeklyBoard, setWeeklyBoard] = useState<TestosteroneLeaderboardRow[]>([])
  const [boardTab, setBoardTab] = useState<'daily' | 'weekly'>('daily')
  const [loading, setLoading] = useState(true)
  const [selectedRow, setSelectedRow] = useState<TestosteroneLeaderboardRow | null>(null)
  const [selectedTodayScores, setSelectedTodayScores] = useState<ScoreMap>({})
  const [selectedWeekAverages, setSelectedWeekAverages] = useState<ScoreMap>({})
  const [selectedDaysLogged, setSelectedDaysLogged] = useState(0)
  const [selectedLoading, setSelectedLoading] = useState(false)
  const savingRef = useRef<Set<string>>(new Set())
  const mountedRef = useRef(true)

  const overallToday = useMemo(() => averageScore(todayScores), [todayScores])
  const overallWeek = useMemo(() => averageScore(weekAverages), [weekAverages])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const today = getCurrentTaskDate()
      const weekStart = getCurrentWeekStart()
      const [todayMap, weekRows, daily, weekly] = await Promise.all([
        getScoresForDate(userId, today),
        getScoresInRange(userId, weekStart, today),
        getDailyTestosteroneLeaderboard(),
        getWeeklyTestosteroneLeaderboard(),
      ])
      if (!mountedRef.current) return
      setTodayScores(todayMap)
      setWeekAverages(averagePerCommandment(weekRows))
      setDaysLogged(new Set(weekRows.map((r) => r.score_date)).size)
      setDailyBoard(daily)
      setWeeklyBoard(weekly)
    } catch (err) {
      console.error('Error loading testosterone data:', err)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    mountedRef.current = true
    load()
    return () => {
      mountedRef.current = false
    }
  }, [load])

  const handleSelectUser = useCallback(async (row: TestosteroneLeaderboardRow) => {
    setSelectedRow(row)
    setSelectedLoading(true)
    setSelectedTodayScores({})
    setSelectedWeekAverages({})
    setSelectedDaysLogged(0)
    try {
      const today = getCurrentTaskDate()
      const weekStart = getCurrentWeekStart()
      const [todayMap, weekRows] = await Promise.all([
        getScoresForDate(row.profile.id, today),
        getScoresInRange(row.profile.id, weekStart, today),
      ])
      if (!mountedRef.current) return
      setSelectedTodayScores(todayMap)
      setSelectedWeekAverages(averagePerCommandment(weekRows))
      setSelectedDaysLogged(new Set(weekRows.map((r) => r.score_date)).size)
    } catch (err) {
      console.error('Error loading user scores:', err)
    } finally {
      if (mountedRef.current) setSelectedLoading(false)
    }
  }, [])

  const handleBackToBoard = useCallback(() => {
    setSelectedRow(null)
  }, [])

  const handleScoreChange = useCallback(
    async (key: CommandmentKey, value: number) => {
      setTodayScores((prev) => ({ ...prev, [key]: value }))
      const saveKey = `${key}:${value}`
      if (savingRef.current.has(saveKey)) return
      savingRef.current.add(saveKey)
      try {
        await upsertScore(userId, key, value)
      } catch (err) {
        console.error('Error saving score:', err)
      } finally {
        savingRef.current.delete(saveKey)
      }
    },
    [userId]
  )

  return (
    <div>
      <div style={{ marginBottom: '30px' }}>
        <h2
          style={{
            fontSize: 'clamp(22px, 5vw, 32px)',
            fontWeight: 800,
            margin: '0 0 8px 0',
            background: 'linear-gradient(135deg, #ffffff 0%, #ff6b35 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-1px',
          }}
        >
          TEN TESTOSTERONE COMMANDMENTS
        </h2>
        <p style={{ color: '#888', fontSize: 'clamp(12px, 3vw, 14px)', fontWeight: 500 }}>
          Rate your daily adherence • Build the lifestyle that builds you
        </p>
      </div>

      <TabBar
        tab={tab}
        setTab={(t) => {
          setTab(t)
          setSelectedRow(null)
        }}
      />

      {loading ? (
        <LoadingSpinner />
      ) : tab === 'today' ? (
        <TodayTab scores={todayScores} onChange={handleScoreChange} overall={overallToday} />
      ) : tab === 'week' ? (
        <WeekTab scores={weekAverages} overall={overallWeek} daysLogged={daysLogged} />
      ) : (
        <LeaderboardTab
          boardTab={boardTab}
          setBoardTab={(t) => {
            setBoardTab(t)
            setSelectedRow(null)
          }}
          daily={dailyBoard}
          weekly={weeklyBoard}
          currentUserId={userId}
          selectedRow={selectedRow}
          selectedTodayScores={selectedTodayScores}
          selectedWeekAverages={selectedWeekAverages}
          selectedDaysLogged={selectedDaysLogged}
          selectedLoading={selectedLoading}
          onSelectUser={handleSelectUser}
          onBack={handleBackToBoard}
        />
      )}
    </div>
  )
}

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'today', label: '📊 TODAY' },
    { id: 'week', label: '📈 WEEKLY' },
    { id: 'leaderboard', label: '🏆 LEADERBOARD' },
  ]
  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '30px',
        background: '#0a0a0a',
        padding: '6px',
        borderRadius: '12px',
        border: '1px solid #3a3a3a',
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          style={{
            flex: 1,
            padding: '12px 8px',
            background:
              tab === t.id
                ? 'linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)'
                : 'transparent',
            color: tab === t.id ? '#fff' : '#888',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: 'clamp(11px, 2.5vw, 15px)',
            transition: 'all 0.3s ease',
            boxShadow: tab === t.id ? '0 4px 15px rgba(255, 107, 53, 0.4)' : 'none',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function LoadingSpinner() {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div
        style={{
          width: '50px',
          height: '50px',
          border: '4px solid #2a2a2a',
          borderTop: '4px solid #ff6b35',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 20px',
        }}
      />
      <p style={{ color: '#888', fontSize: '16px', fontWeight: 500 }}>Loading...</p>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function TodayTab({
  scores,
  onChange,
  overall,
}: {
  scores: ScoreMap
  onChange: (key: CommandmentKey, value: number) => void
  overall: number
}) {
  return (
    <div>
      <OverallScoreCard label="Today's Overall Score" value={overall} sublabel="Average of today's slider values" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
        {COMMANDMENTS.map((c) => (
          <CommandmentSlider
            key={c.key}
            commandment={c}
            value={scores[c.key] ?? 5}
            hasValue={typeof scores[c.key] === 'number'}
            onChange={(v) => onChange(c.key, v)}
          />
        ))}
      </div>
    </div>
  )
}

function CommandmentSlider({
  commandment,
  value,
  hasValue,
  onChange,
}: {
  commandment: Commandment
  value: number
  hasValue: boolean
  onChange: (v: number) => void
}) {
  const tier = TIER_META[commandment.tier]
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
        border: `1px solid ${tier.border}55`,
        borderLeft: `4px solid ${tier.color}`,
        borderRadius: '14px',
        padding: 'clamp(14px, 3vw, 20px)',
        boxShadow: `0 4px 18px ${tier.color}15`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '8px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <span
            style={{
              display: 'inline-block',
              padding: '3px 10px',
              background: tier.color,
              color: '#000',
              fontWeight: 800,
              fontSize: '10px',
              borderRadius: '999px',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
          >
            {tier.label}
          </span>
          <h3
            style={{
              margin: 0,
              fontSize: 'clamp(16px, 3.5vw, 20px)',
              fontWeight: 800,
              color: '#fff',
              letterSpacing: '-0.3px',
            }}
          >
            {commandment.label}
          </h3>
        </div>
        <div
          style={{
            minWidth: '64px',
            textAlign: 'center',
            padding: '6px 14px',
            background: hasValue
              ? 'linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)'
              : 'rgba(255, 255, 255, 0.05)',
            color: hasValue ? '#fff' : '#888',
            borderRadius: '10px',
            fontSize: '18px',
            fontWeight: 800,
            border: hasValue ? 'none' : '1px dashed #3a3a3a',
          }}
        >
          {hasValue ? value : '—'}
        </div>
      </div>
      <p
        style={{
          margin: '0 0 14px 0',
          color: '#999',
          fontSize: 'clamp(12px, 2.8vw, 13px)',
          lineHeight: 1.5,
        }}
      >
        {commandment.description}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ color: '#666', fontSize: '11px', fontWeight: 700 }}>1</span>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          style={{
            flex: 1,
            accentColor: tier.color,
            cursor: 'pointer',
          }}
        />
        <span style={{ color: '#666', fontSize: '11px', fontWeight: 700 }}>10</span>
      </div>
    </div>
  )
}

function OverallScoreCard({
  label,
  value,
  sublabel,
}: {
  label: string
  value: number
  sublabel: string
}) {
  const pct = Math.max(0, Math.min(100, (value / 10) * 100))
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
        border: '1px solid #3a3a3a',
        borderRadius: '14px',
        padding: 'clamp(18px, 4vw, 26px)',
      }}
    >
      <div style={{ color: '#ccc', fontSize: '14px', fontWeight: 600, marginBottom: '10px' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '14px' }}>
        <div
          style={{
            fontSize: 'clamp(40px, 10vw, 56px)',
            fontWeight: 800,
            color: '#4a9eff',
            letterSpacing: '-2px',
            lineHeight: 1,
          }}
        >
          {value.toFixed(1)}
        </div>
        <div style={{ color: '#888', fontSize: '14px', fontWeight: 500 }}>/ 10</div>
      </div>
      <div
        style={{
          width: '100%',
          height: '10px',
          background: '#0a0a0a',
          borderRadius: '999px',
          overflow: 'hidden',
          border: '1px solid #3a3a3a',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background:
              'linear-gradient(90deg, #ff4444 0%, #ffcc00 45%, #ffcc00 55%, #22cc77 100%)',
            transition: 'width 0.4s ease',
          }}
        />
      </div>
      <p style={{ color: '#888', fontSize: '12px', fontWeight: 500, margin: '10px 0 0 0' }}>
        {sublabel}
      </p>
    </div>
  )
}

function WeekTab({
  scores,
  overall,
  daysLogged,
}: {
  scores: ScoreMap
  overall: number
  daysLogged: number
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 'clamp(15px, 3vw, 24px)',
      }}
    >
      <OverallScoreCard
        label={`${daysLogged}-day Overall Score`}
        value={overall}
        sublabel={`Based on the average of each habit over the last ${daysLogged} day${daysLogged === 1 ? '' : 's'}.`}
      />
      <RadarChartCard scores={scores} />
    </div>
  )
}

function RadarChartCard({ scores }: { scores: ScoreMap }) {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
        border: '1px solid #3a3a3a',
        borderRadius: '14px',
        padding: 'clamp(14px, 3vw, 22px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <RadarChart scores={scores} />
    </div>
  )
}

function RadarChart({ scores }: { scores: ScoreMap }) {
  const size = 480
  const cx = size / 2
  const cy = size / 2
  const radius = size * 0.28
  const labelRadius = radius + 28
  const levels = 5
  const n = COMMANDMENTS.length

  const pointFor = (i: number, r: number) => {
    const angle = (-Math.PI / 2) + (i * 2 * Math.PI) / n
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r }
  }

  const gridPolygons: string[] = []
  for (let lvl = 1; lvl <= levels; lvl++) {
    const r = (radius * lvl) / levels
    const pts = COMMANDMENTS.map((_, i) => {
      const p = pointFor(i, r)
      return `${p.x},${p.y}`
    }).join(' ')
    gridPolygons.push(pts)
  }

  const dataPoints = COMMANDMENTS.map((c, i) => {
    const v = scores[c.key] ?? 0
    const r = (radius * v) / 10
    return pointFor(i, r)
  })
  const dataPolygon = dataPoints.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      style={{ width: '100%', maxWidth: '520px', height: 'auto' }}
      role="img"
      aria-label="Testosterone commandments radar chart"
    >
      {gridPolygons.map((pts, idx) => (
        <polygon
          key={idx}
          points={pts}
          fill="none"
          stroke="#3a3a3a"
          strokeWidth={1}
          opacity={0.5 + (idx / levels) * 0.3}
        />
      ))}

      {COMMANDMENTS.map((_, i) => {
        const outer = pointFor(i, radius)
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={outer.x}
            y2={outer.y}
            stroke="#3a3a3a"
            strokeWidth={1}
            opacity={0.6}
          />
        )
      })}

      <polygon
        points={dataPolygon}
        fill="rgba(74, 158, 255, 0.35)"
        stroke="#4a9eff"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#4a9eff" />
      ))}

      {COMMANDMENTS.map((c, i) => {
        const angle = (-Math.PI / 2) + (i * 2 * Math.PI) / n
        const lx = cx + Math.cos(angle) * labelRadius
        const ly = cy + Math.sin(angle) * labelRadius
        const v = scores[c.key]
        const textAnchor =
          Math.abs(Math.cos(angle)) < 0.2
            ? 'middle'
            : Math.cos(angle) > 0
            ? 'start'
            : 'end'
        const tier = TIER_META[c.tier]
        return (
          <g key={c.key}>
            <text
              x={lx}
              y={ly}
              fill="#fff"
              fontSize={13}
              fontWeight={600}
              textAnchor={textAnchor}
              dominantBaseline="middle"
            >
              {c.label}
              <tspan fill={tier.color} fontWeight={800}>
                {v != null ? ` (${v.toFixed(1)})` : ''}
              </tspan>
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function LeaderboardTab({
  boardTab,
  setBoardTab,
  daily,
  weekly,
  currentUserId,
  selectedRow,
  selectedTodayScores,
  selectedWeekAverages,
  selectedDaysLogged,
  selectedLoading,
  onSelectUser,
  onBack,
}: {
  boardTab: 'daily' | 'weekly'
  setBoardTab: (t: 'daily' | 'weekly') => void
  daily: TestosteroneLeaderboardRow[]
  weekly: TestosteroneLeaderboardRow[]
  currentUserId: string
  selectedRow: TestosteroneLeaderboardRow | null
  selectedTodayScores: ScoreMap
  selectedWeekAverages: ScoreMap
  selectedDaysLogged: number
  selectedLoading: boolean
  onSelectUser: (row: TestosteroneLeaderboardRow) => void
  onBack: () => void
}) {
  const rows = boardTab === 'daily' ? daily : weekly

  if (selectedRow) {
    return (
      <UserScoreProfile
        row={selectedRow}
        todayScores={selectedTodayScores}
        weekAverages={selectedWeekAverages}
        daysLogged={selectedDaysLogged}
        loading={selectedLoading}
        onBack={onBack}
      />
    )
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          background: '#0a0a0a',
          padding: '6px',
          borderRadius: '12px',
          border: '1px solid #3a3a3a',
        }}
      >
        {(['daily', 'weekly'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setBoardTab(t)}
            style={{
              flex: 1,
              padding: '10px 8px',
              background:
                boardTab === t
                  ? 'linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)'
                  : 'transparent',
              color: boardTab === t ? '#fff' : '#888',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 'clamp(11px, 2.5vw, 14px)',
              whiteSpace: 'nowrap',
            }}
          >
            {t === 'daily' ? 'DAILY' : 'THIS WEEK'}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: '#0a0a0a',
            borderRadius: '16px',
            border: '1px solid #3a3a3a',
          }}
        >
          <div style={{ fontSize: '60px', marginBottom: '20px' }}>🏆</div>
          <p style={{ color: '#888', fontSize: '16px', fontWeight: 500 }}>
            No scores submitted yet. Be the first to log your commandments!
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {rows.map((row, idx) => (
            <LeaderboardRow
              key={row.profile.id}
              row={row}
              rank={idx}
              isCurrentUser={row.profile.id === currentUserId}
              countLabel={boardTab === 'daily' ? 'logged' : 'entries'}
              onClick={() => onSelectUser(row)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function UserScoreProfile({
  row,
  todayScores,
  weekAverages,
  daysLogged,
  loading,
  onBack,
}: {
  row: TestosteroneLeaderboardRow
  todayScores: ScoreMap
  weekAverages: ScoreMap
  daysLogged: number
  loading: boolean
  onBack: () => void
}) {
  const todayOverall = useMemo(() => averageScore(todayScores), [todayScores])
  const weekOverall = useMemo(() => averageScore(weekAverages), [weekAverages])
  const hasTodayScores = Object.keys(todayScores).length > 0

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          marginBottom: '20px',
          padding: '12px 20px',
          background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
          color: '#fff',
          border: '1px solid #3a3a3a',
          borderRadius: '10px',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '14px',
        }}
      >
        ← BACK TO LEADERBOARD
      </button>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: 'clamp(14px, 3vw, 22px)',
          background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
          border: '1px solid #3a3a3a',
          borderRadius: '14px',
          marginBottom: '20px',
          flexWrap: 'wrap',
        }}
      >
        <img
          src={getAvatarImage(row.profile.avatar_level)}
          alt={`${getDisplayName(row.profile)} avatar`}
          style={{
            width: 'clamp(60px, 14vw, 80px)',
            height: 'clamp(60px, 14vw, 80px)',
            objectFit: 'cover',
            borderRadius: '14px',
            border: '2px solid rgba(255, 107, 53, 0.5)',
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 'clamp(18px, 4vw, 26px)',
              fontWeight: 800,
              color: '#fff',
              letterSpacing: '-0.5px',
              wordBreak: 'break-word',
            }}
          >
            {getDisplayName(row.profile).toUpperCase()}
          </h3>
          <p style={{ margin: '4px 0 0 0', color: '#888', fontSize: '13px', fontWeight: 500 }}>
            Leaderboard score: <span style={{ color: '#ff6b35', fontWeight: 800 }}>{row.score.toFixed(1)}</span> / 10
          </p>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'clamp(15px, 3vw, 24px)',
            marginBottom: '24px',
          }}
        >
          <OverallScoreCard
            label="Today's Overall Score"
            value={todayOverall}
            sublabel={hasTodayScores ? "Average of today's logged values." : 'No scores logged today yet.'}
          />
          <OverallScoreCard
            label={`${daysLogged}-day Overall Score`}
            value={weekOverall}
            sublabel={`Based on the average of each habit over the last ${daysLogged} day${daysLogged === 1 ? '' : 's'}.`}
          />
          <div style={{ gridColumn: '1 / -1' }}>
            <RadarChartCard scores={weekAverages} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <CommandmentBreakdown todayScores={todayScores} weekAverages={weekAverages} />
          </div>
        </div>
      )}
    </div>
  )
}

function CommandmentBreakdown({
  todayScores,
  weekAverages,
}: {
  todayScores: ScoreMap
  weekAverages: ScoreMap
}) {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
        border: '1px solid #3a3a3a',
        borderRadius: '14px',
        padding: 'clamp(14px, 3vw, 22px)',
      }}
    >
      <h4 style={{ margin: '0 0 14px 0', fontSize: '15px', fontWeight: 700, color: '#fff' }}>
        COMMANDMENT BREAKDOWN
      </h4>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '10px',
        }}
      >
        {COMMANDMENTS.map((c) => {
          const tier = TIER_META[c.tier]
          const today = todayScores[c.key]
          const week = weekAverages[c.key]
          return (
            <div
              key={c.key}
              style={{
                background: '#0a0a0a',
                borderLeft: `4px solid ${tier.color}`,
                border: '1px solid #3a3a3a',
                borderRadius: '10px',
                padding: '12px 14px',
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#fff',
                  marginBottom: '6px',
                }}
              >
                {c.label}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '10px', color: '#888', fontWeight: 600 }}>TODAY</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: today != null ? tier.color : '#555' }}>
                    {today != null ? today.toFixed(0) : '—'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '10px', color: '#888', fontWeight: 600 }}>WEEK AVG</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: week != null ? '#4a9eff' : '#555' }}>
                    {week != null ? week.toFixed(1) : '—'}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LeaderboardRow({
  row,
  rank,
  isCurrentUser,
  countLabel,
  onClick,
}: {
  row: TestosteroneLeaderboardRow
  rank: number
  isCurrentUser: boolean
  countLabel: string
  onClick?: () => void
}) {
  const medal = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : null
  const topThree = rank < 3
  const rankBackground = topThree
    ? rank === 0
      ? 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)'
      : rank === 1
      ? 'linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 100%)'
      : 'linear-gradient(135deg, #cd7f32 0%, #e6a857 100%)'
    : 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)'
  const textColor = topThree ? '#000' : '#fff'
  const subTextColor = topThree ? '#333' : '#888'

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: 'clamp(12px, 3vw, 18px)',
        background: rankBackground,
        border: isCurrentUser
          ? '2px solid #4a9eff'
          : topThree
          ? '2px solid #ff6b35'
          : '1px solid #3a3a3a',
        borderRadius: '14px',
        gap: 'clamp(8px, 2vw, 18px)',
        boxShadow: topThree ? '0 6px 20px rgba(255, 107, 53, 0.25)' : '0 4px 12px rgba(0,0,0,0.2)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      }}
      onMouseEnter={
        onClick
          ? (e) => {
              e.currentTarget.style.transform = 'translateY(-3px)'
              e.currentTarget.style.boxShadow = '0 10px 28px rgba(255, 107, 53, 0.35)'
            }
          : undefined
      }
      onMouseLeave={
        onClick
          ? (e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = topThree
                ? '0 6px 20px rgba(255, 107, 53, 0.25)'
                : '0 4px 12px rgba(0,0,0,0.2)'
            }
          : undefined
      }
    >
      <div
        style={{
          minWidth: 'clamp(36px, 7vw, 54px)',
          textAlign: 'center',
          fontSize: 'clamp(18px, 4vw, 24px)',
          fontWeight: 800,
          color: topThree ? '#000' : '#ff6b35',
          flexShrink: 0,
        }}
      >
        {medal || `#${rank + 1}`}
      </div>
      <img
        src={getAvatarImage(row.profile.avatar_level)}
        alt={`${getDisplayName(row.profile)} avatar`}
        style={{
          width: 'clamp(42px, 10vw, 60px)',
          height: 'clamp(42px, 10vw, 60px)',
          objectFit: 'cover',
          borderRadius: '12px',
          border: '2px solid rgba(255, 107, 53, 0.5)',
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 'clamp(13px, 3vw, 18px)',
            fontWeight: 700,
            color: textColor,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {getDisplayName(row.profile).toUpperCase()}
          {isCurrentUser && (
            <span style={{ marginLeft: '8px', color: '#4a9eff', fontSize: '11px', fontWeight: 700 }}>
              (YOU)
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 'clamp(10px, 2.5vw, 12px)',
            fontWeight: 600,
            color: subTextColor,
            marginTop: '4px',
          }}
        >
          {row.completed_count} {countLabel}
        </div>
      </div>
      <div
        style={{
          minWidth: 'clamp(70px, 15vw, 100px)',
          flexShrink: 0,
          textAlign: 'center',
          padding: 'clamp(8px, 2vw, 12px)',
          background: topThree ? 'rgba(0, 0, 0, 0.2)' : 'linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)',
          borderRadius: '12px',
        }}
      >
        <div
          style={{
            fontSize: 'clamp(20px, 5vw, 28px)',
            fontWeight: 800,
            color: topThree ? '#000' : '#fff',
            lineHeight: 1,
          }}
        >
          {row.score.toFixed(1)}
        </div>
        <div
          style={{
            fontSize: 'clamp(9px, 2vw, 11px)',
            fontWeight: 700,
            color: topThree ? '#333' : '#fff',
            opacity: 0.85,
            marginTop: '4px',
          }}
        >
          / 10
        </div>
      </div>
    </div>
  )
}
