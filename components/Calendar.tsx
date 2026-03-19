'use client'

import { useState, useEffect, useCallback } from 'react'
import { getAvailableDates, getTaskSnapshot, getLeaderboardSnapshot } from '@/lib/calendar'
import type { DailyTaskSnapshot, DailyLeaderboardSnapshot } from '@/lib/supabase'

interface CalendarProps {
  userId: string
}

export default function Calendar({ userId }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [tasks, setTasks] = useState<DailyTaskSnapshot[]>([])
  const [leaderboard, setLeaderboard] = useState<DailyLeaderboardSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)

  // Load available dates
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const dates = await getAvailableDates(userId)
        if (!cancelled) {
          setAvailableDates(new Set(dates))
        }
      } catch (err) {
        console.error('Error loading calendar dates:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [userId])

  // Load details when a date is selected
  const selectDate = useCallback(async (date: string) => {
    setSelectedDate(date)
    setDetailLoading(true)
    try {
      const [taskData, lbData] = await Promise.all([
        getTaskSnapshot(userId, date),
        getLeaderboardSnapshot(date),
      ])
      setTasks(taskData)
      setLeaderboard(lbData)
    } catch (err) {
      console.error('Error loading day details:', err)
    } finally {
      setDetailLoading(false)
    }
  }, [userId])

  // Calendar grid helpers
  const daysInMonth = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate()
  const firstDayOfWeek = new Date(currentMonth.year, currentMonth.month, 1).getDay()
  const monthName = new Date(currentMonth.year, currentMonth.month).toLocaleString('en-US', { month: 'long', year: 'numeric' })

  const prevMonth = () => {
    setCurrentMonth(prev => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 }
      return { year: prev.year, month: prev.month - 1 }
    })
  }

  const nextMonth = () => {
    setCurrentMonth(prev => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 }
      return { year: prev.year, month: prev.month + 1 }
    })
  }

  const formatDate = (day: number) => {
    const m = String(currentMonth.month + 1).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    return `${currentMonth.year}-${m}-${d}`
  }

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  const completedCount = tasks.filter(t => t.is_done).length
  const totalCount = tasks.length

  // Find current user's rank in the leaderboard snapshot
  const userRankEntry = leaderboard.find(e => e.user_id === userId)

  return (
    <div>
      <h2 style={{
        fontSize: 'clamp(20px, 4vw, 28px)',
        fontWeight: 800,
        margin: '0 0 6px 0',
        background: 'linear-gradient(135deg, #ffffff 0%, #ff6b35 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        letterSpacing: '-0.5px'
      }}>CALENDAR</h2>
      <p style={{ color: '#888', fontSize: '14px', marginBottom: '25px', fontWeight: 500 }}>
        View your past daily tasks and leaderboard results
      </p>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>Loading calendar...</div>
      ) : (
        <>
          {/* Calendar Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <button onClick={prevMonth} style={navBtnStyle}>&#8592;</button>
            <span style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '-0.3px'
            }}>{monthName}</span>
            <button onClick={nextMonth} style={navBtnStyle}>&#8594;</button>
          </div>

          {/* Weekday labels */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '4px',
            marginBottom: '4px'
          }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} style={{
                textAlign: 'center',
                fontSize: '12px',
                fontWeight: 600,
                color: '#666',
                padding: '6px 0',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>{d}</div>
            ))}
          </div>

          {/* Calendar Days Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '4px',
            marginBottom: '25px'
          }}>
            {/* Empty cells for days before the 1st */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = formatDate(day)
              const hasData = availableDates.has(dateStr)
              const isSelected = selectedDate === dateStr
              const isToday = dateStr === todayStr
              const isFuture = dateStr > todayStr

              return (
                <button
                  key={day}
                  onClick={() => hasData ? selectDate(dateStr) : null}
                  disabled={!hasData}
                  style={{
                    aspectRatio: '1',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '10px',
                    border: isSelected
                      ? '2px solid #ff6b35'
                      : isToday
                        ? '2px solid #555'
                        : '1px solid #2a2a2a',
                    background: isSelected
                      ? 'linear-gradient(135deg, rgba(255, 107, 53, 0.2) 0%, rgba(255, 69, 0, 0.1) 100%)'
                      : hasData
                        ? '#1a1a1a'
                        : 'transparent',
                    color: isFuture ? '#333' : hasData ? '#fff' : '#555',
                    cursor: hasData ? 'pointer' : 'default',
                    fontSize: '14px',
                    fontWeight: isSelected ? 700 : 500,
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    padding: '4px'
                  }}
                  onMouseEnter={(e) => {
                    if (hasData && !isSelected) {
                      e.currentTarget.style.borderColor = '#ff6b35'
                      e.currentTarget.style.background = 'rgba(255, 107, 53, 0.08)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (hasData && !isSelected) {
                      e.currentTarget.style.borderColor = '#2a2a2a'
                      e.currentTarget.style.background = '#1a1a1a'
                    }
                  }}
                >
                  <span>{day}</span>
                  {hasData && (
                    <div style={{
                      width: '5px',
                      height: '5px',
                      borderRadius: '50%',
                      background: '#ff6b35',
                      marginTop: '2px'
                    }} />
                  )}
                </button>
              )
            })}
          </div>

          {/* Selected Day Details */}
          {selectedDate && (
            <div>
              <h3 style={{
                fontSize: '18px',
                fontWeight: 700,
                color: '#fff',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <span style={{ color: '#ff6b35' }}>
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
              </h3>

              {detailLoading ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#888' }}>Loading...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Tasks Section */}
                  <div style={{
                    background: '#0a0a0a',
                    borderRadius: '12px',
                    border: '1px solid #3a3a3a',
                    padding: '20px',
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '16px'
                    }}>
                      <h4 style={{
                        fontSize: '16px',
                        fontWeight: 700,
                        color: '#fff',
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{ fontSize: '18px' }}>&#128170;</span>
                        Your Tasks
                      </h4>
                      <div style={{
                        padding: '4px 12px',
                        borderRadius: '20px',
                        background: completedCount === totalCount && totalCount > 0
                          ? 'rgba(76, 175, 80, 0.15)'
                          : 'rgba(255, 107, 53, 0.15)',
                        border: `1px solid ${completedCount === totalCount && totalCount > 0 ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 107, 53, 0.3)'}`,
                        fontSize: '13px',
                        fontWeight: 600,
                        color: completedCount === totalCount && totalCount > 0 ? '#4caf50' : '#ff6b35'
                      }}>
                        {completedCount}/{totalCount} completed
                      </div>
                    </div>

                    {totalCount === 0 ? (
                      <p style={{ color: '#666', fontSize: '14px', margin: 0, fontStyle: 'italic' }}>
                        No tasks were set for this day.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {tasks.map((task) => (
                          <div
                            key={task.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              padding: '12px 16px',
                              background: task.is_done
                                ? 'rgba(76, 175, 80, 0.06)'
                                : 'rgba(255, 255, 255, 0.02)',
                              borderRadius: '8px',
                              border: `1px solid ${task.is_done ? 'rgba(76, 175, 80, 0.15)' : '#2a2a2a'}`
                            }}
                          >
                            <div style={{
                              width: '22px',
                              height: '22px',
                              borderRadius: '6px',
                              border: task.is_done ? '2px solid #4caf50' : '2px solid #555',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              background: task.is_done ? 'rgba(76, 175, 80, 0.15)' : 'transparent'
                            }}>
                              {task.is_done && (
                                <span style={{ color: '#4caf50', fontSize: '13px', fontWeight: 700 }}>&#10003;</span>
                              )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{
                                color: task.is_done ? '#888' : '#fff',
                                fontSize: '14px',
                                fontWeight: 500,
                                textDecoration: task.is_done ? 'line-through' : 'none',
                                opacity: task.is_done ? 0.7 : 1
                              }}>
                                {task.description}
                              </span>
                              {task.reward && (
                                <span style={{
                                  display: 'block',
                                  fontSize: '12px',
                                  color: '#ffd700',
                                  marginTop: '2px',
                                  fontWeight: 500
                                }}>
                                  Reward: {task.reward}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Leaderboard Section */}
                  <div style={{
                    background: '#0a0a0a',
                    borderRadius: '12px',
                    border: '1px solid #3a3a3a',
                    padding: '20px',
                  }}>
                    <h4 style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      color: '#fff',
                      margin: '0 0 16px 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span style={{ fontSize: '18px' }}>&#127942;</span>
                      Daily Leaderboard
                      {userRankEntry && (
                        <span style={{
                          marginLeft: 'auto',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#ff6b35',
                          padding: '2px 10px',
                          background: 'rgba(255, 107, 53, 0.1)',
                          borderRadius: '12px',
                          border: '1px solid rgba(255, 107, 53, 0.2)'
                        }}>
                          Your rank: #{userRankEntry.rank}
                        </span>
                      )}
                    </h4>

                    {leaderboard.length === 0 ? (
                      <p style={{ color: '#666', fontSize: '14px', margin: 0, fontStyle: 'italic' }}>
                        No leaderboard data for this day.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {leaderboard.map((entry) => {
                          const medal = entry.rank === 1 ? '&#129351;' : entry.rank === 2 ? '&#129352;' : entry.rank === 3 ? '&#129353;' : null
                          const isCurrentUser = entry.user_id === userId

                          return (
                            <div
                              key={entry.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '10px 14px',
                                background: isCurrentUser
                                  ? 'rgba(255, 107, 53, 0.08)'
                                  : 'transparent',
                                borderRadius: '8px',
                                border: isCurrentUser
                                  ? '1px solid rgba(255, 107, 53, 0.2)'
                                  : '1px solid transparent',
                              }}
                            >
                              {/* Rank */}
                              <div style={{
                                width: '32px',
                                textAlign: 'center',
                                fontSize: medal ? '18px' : '14px',
                                fontWeight: 700,
                                color: medal ? undefined : '#888',
                                flexShrink: 0
                              }}>
                                {medal ? (
                                  <span dangerouslySetInnerHTML={{ __html: medal }} />
                                ) : (
                                  `#${entry.rank}`
                                )}
                              </div>

                              {/* Name */}
                              <div style={{
                                flex: 1,
                                minWidth: 0,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                <span style={{
                                  color: isCurrentUser ? '#ff6b35' : '#fff',
                                  fontSize: '14px',
                                  fontWeight: isCurrentUser ? 700 : 500
                                }}>
                                  {entry.display_name || entry.username}
                                </span>
                              </div>

                              {/* Tasks completed */}
                              <div style={{
                                fontSize: '13px',
                                fontWeight: 600,
                                color: entry.tasks_completed_today === 10 ? '#4caf50' : '#888',
                                flexShrink: 0
                              }}>
                                {entry.tasks_completed_today}/10
                              </div>

                              {/* Level */}
                              <div style={{
                                fontSize: '12px',
                                fontWeight: 600,
                                color: '#ffd700',
                                padding: '2px 8px',
                                background: 'rgba(255, 215, 0, 0.1)',
                                borderRadius: '6px',
                                flexShrink: 0
                              }}>
                                Lv.{entry.avatar_level}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
  color: '#fff',
  border: '1px solid #3a3a3a',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '16px',
  transition: 'all 0.2s ease',
}
