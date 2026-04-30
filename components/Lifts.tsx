'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  listLeaderboards,
  getSubmissions,
  hasCreatedLeaderboardRecently,
  createLeaderboard,
  uploadProofVideo,
  submitEntry,
  deleteSubmission,
  deleteLeaderboard,
  finalizeEnded,
  formatTimeRemaining,
} from '@/lib/lifts'
import type { LiftLeaderboardWithCreator, LiftSubmissionWithUser } from '@/lib/lifts'
import { isAdmin } from '@/lib/admin'
import { showModal, showConfirm } from '@/lib/modal'

interface LiftsProps {
  userId: string
}

const UNIT_OPTIONS = ['lbs', 'kg', 'reps', 'seconds', 'inches', 'meters']

export default function Lifts({ userId }: LiftsProps) {
  const [boards, setBoards] = useState<LiftLeaderboardWithCreator[]>([])
  const [loading, setLoading] = useState(true)
  const [userIsAdmin, setUserIsAdmin] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [submissions, setSubmissions] = useState<LiftSubmissionWithUser[]>([])
  const [submissionsLoading, setSubmissionsLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [createBlocked, setCreateBlocked] = useState<{ blocked: boolean; nextAllowedAt: string | null }>({ blocked: false, nextAllowedAt: null })
  const [showSubmit, setShowSubmit] = useState(false)

  const refresh = useCallback(async () => {
    try {
      await finalizeEnded()
      const [lb, admin, blocked] = await Promise.all([
        listLeaderboards(),
        isAdmin(userId),
        hasCreatedLeaderboardRecently(userId),
      ])
      setBoards(lb)
      setUserIsAdmin(admin)
      setCreateBlocked(blocked)
    } catch (err) {
      console.error('Error loading lift leaderboards:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { refresh() }, [refresh])

  const loadSubmissions = useCallback(async (lbId: string) => {
    setSubmissionsLoading(true)
    try {
      const subs = await getSubmissions(lbId)
      setSubmissions(subs)
    } catch (err) {
      console.error('Error loading submissions:', err)
    } finally {
      setSubmissionsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId) loadSubmissions(selectedId)
    else setSubmissions([])
  }, [selectedId, loadSubmissions])

  const selected = boards.find((b) => b.id === selectedId) || null
  const userSubmissions = submissions.filter((s) => s.user_id === userId)
  const lastUserSubmissionAt = userSubmissions.length > 0
    ? userSubmissions.reduce((max, s) => (s.created_at > max ? s.created_at : max), userSubmissions[0].created_at)
    : null
  const cooldownUntil = lastUserSubmissionAt
    ? new Date(new Date(lastUserSubmissionAt).getTime() + 24 * 60 * 60 * 1000).toISOString()
    : null
  const onCooldown = !!cooldownUntil && new Date(cooldownUntil).getTime() > Date.now()

  const handleAdminDelete = async (submissionId: string) => {
    const ok = await showConfirm('Remove submission', 'Remove this submission? The video and entry will be deleted.')
    if (!ok) return
    try {
      await deleteSubmission(submissionId)
      if (selectedId) await loadSubmissions(selectedId)
    } catch (err: any) {
      showModal('Error', err.message || 'Failed to delete submission', 'error')
    }
  }

  const handleDeleteLeaderboard = async (lbId: string) => {
    const ok = await showConfirm('Delete leaderboard', 'Delete this leaderboard and all its submissions? This cannot be undone.')
    if (!ok) return
    try {
      await deleteLeaderboard(lbId)
      setSelectedId(null)
      await refresh()
    } catch (err: any) {
      showModal('Error', err.message || 'Failed to delete leaderboard', 'error')
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>Loading lift leaderboards...</div>
  }

  if (selected) {
    return (
      <LeaderboardDetail
        userId={userId}
        userIsAdmin={userIsAdmin}
        leaderboard={selected}
        submissions={submissions}
        submissionsLoading={submissionsLoading}
        cooldownUntil={cooldownUntil}
        onCooldown={onCooldown}
        onBack={() => setSelectedId(null)}
        onSubmit={() => setShowSubmit(true)}
        onAdminDelete={handleAdminDelete}
        onDeleteLeaderboard={() => handleDeleteLeaderboard(selected.id)}
        showSubmit={showSubmit}
        onCloseSubmit={() => setShowSubmit(false)}
        onSubmitDone={async () => {
          setShowSubmit(false)
          await loadSubmissions(selected.id)
        }}
      />
    )
  }

  const active = boards.filter((b) => b.status === 'active')
  const completed = boards.filter((b) => b.status === 'completed')

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
      }}>LIFT LEADERBOARDS</h2>
      <p style={{ color: '#888', fontSize: '14px', marginBottom: '20px', fontWeight: 500 }}>
        Create a weekly lift competition or join one. Winner gets <span style={{ color: '#ffd700', fontWeight: 700 }}>+250 EXP</span> and <span style={{ color: '#ffd700', fontWeight: 700 }}>+500 gold</span>.
      </p>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setShowCreate(true)}
          disabled={createBlocked.blocked}
          style={{
            padding: '12px 20px',
            background: createBlocked.blocked
              ? 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)'
              : 'linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            cursor: createBlocked.blocked ? 'not-allowed' : 'pointer',
            fontWeight: 700,
            fontSize: '14px',
            boxShadow: createBlocked.blocked ? 'none' : '0 4px 15px rgba(255, 107, 53, 0.4)',
          }}
        >
          + Create Leaderboard
        </button>
        {createBlocked.blocked && createBlocked.nextAllowedAt && (
          <div style={{
            padding: '10px 14px',
            background: 'rgba(255, 107, 53, 0.08)',
            border: '1px solid rgba(255, 107, 53, 0.2)',
            borderRadius: '10px',
            color: '#ff9469',
            fontSize: '13px',
            fontWeight: 500,
          }}>
            Next available {new Date(createBlocked.nextAllowedAt).toLocaleString()}
          </div>
        )}
      </div>

      <Section title="Active" emptyText="No active competitions. Create one!" boards={active} onSelect={setSelectedId} userId={userId} />
      <Section title="Completed" emptyText="No completed competitions yet." boards={completed} onSelect={setSelectedId} userId={userId} />

      {showCreate && (
        <CreateModal
          userId={userId}
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false)
            await refresh()
          }}
        />
      )}
    </div>
  )
}

function Section({
  title, emptyText, boards, onSelect, userId,
}: {
  title: string
  emptyText: string
  boards: LiftLeaderboardWithCreator[]
  onSelect: (id: string) => void
  userId: string
}) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</h3>
      {boards.length === 0 ? (
        <p style={{ color: '#666', fontSize: '14px', fontStyle: 'italic', margin: 0 }}>{emptyText}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {boards.map((b) => (
            <button
              key={b.id}
              onClick={() => onSelect(b.id)}
              style={{
                background: '#0a0a0a',
                borderRadius: '12px',
                border: '1px solid #3a3a3a',
                padding: '16px 18px',
                textAlign: 'left',
                cursor: 'pointer',
                color: '#fff',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#ff6b35' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#3a3a3a' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>{b.title}</div>
                  <div style={{ fontSize: '12px', color: '#888' }}>
                    by {b.creator_display_name || b.creator_username} · {b.submission_count} {b.submission_count === 1 ? 'entry' : 'entries'} · unit: {b.unit}
                  </div>
                </div>
                {b.status === 'active' ? (
                  <div style={{
                    padding: '4px 10px',
                    borderRadius: '12px',
                    background: 'rgba(76, 175, 80, 0.15)',
                    border: '1px solid rgba(76, 175, 80, 0.3)',
                    color: '#4caf50',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}>
                    {formatTimeRemaining(b.ends_at)} left
                  </div>
                ) : b.winner_id ? (
                  <div style={{
                    padding: '4px 10px',
                    borderRadius: '12px',
                    background: 'rgba(255, 215, 0, 0.1)',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    color: '#ffd700',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}>
                    👑 {b.winner_id === userId ? 'You won' : (b.winner_display_name || b.winner_username)}
                  </div>
                ) : (
                  <div style={{
                    padding: '4px 10px',
                    borderRadius: '12px',
                    background: '#1a1a1a',
                    border: '1px solid #3a3a3a',
                    color: '#888',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}>
                    No entries
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function LeaderboardDetail({
  userId, userIsAdmin, leaderboard, submissions, submissionsLoading, cooldownUntil, onCooldown,
  onBack, onSubmit, onAdminDelete, onDeleteLeaderboard, showSubmit, onCloseSubmit, onSubmitDone,
}: {
  userId: string
  userIsAdmin: boolean
  leaderboard: LiftLeaderboardWithCreator
  submissions: LiftSubmissionWithUser[]
  submissionsLoading: boolean
  cooldownUntil: string | null
  onCooldown: boolean
  onBack: () => void
  onSubmit: () => void
  onAdminDelete: (id: string) => void
  onDeleteLeaderboard: () => void
  showSubmit: boolean
  onCloseSubmit: () => void
  onSubmitDone: () => void
}) {
  const isActive = leaderboard.status === 'active'
  const canDelete = userIsAdmin || leaderboard.creator_id === userId

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          padding: '8px 14px',
          background: 'transparent',
          color: '#888',
          border: '1px solid #3a3a3a',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '13px',
          marginBottom: '16px',
        }}
      >
        ← Back
      </button>

      <div style={{
        background: '#0a0a0a',
        borderRadius: '12px',
        border: '1px solid #3a3a3a',
        padding: '20px',
        marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', margin: '0 0 6px 0' }}>{leaderboard.title}</h3>
            <p style={{ color: '#888', fontSize: '13px', margin: '0 0 8px 0' }}>
              by {leaderboard.creator_display_name || leaderboard.creator_username} · unit: {leaderboard.unit}
            </p>
            {leaderboard.description && (
              <p style={{ color: '#ccc', fontSize: '14px', margin: '8px 0 0 0', whiteSpace: 'pre-wrap' }}>{leaderboard.description}</p>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
            {isActive ? (
              <div style={{
                padding: '6px 12px',
                borderRadius: '12px',
                background: 'rgba(76, 175, 80, 0.15)',
                border: '1px solid rgba(76, 175, 80, 0.3)',
                color: '#4caf50',
                fontSize: '13px',
                fontWeight: 700,
              }}>
                {formatTimeRemaining(leaderboard.ends_at)} left
              </div>
            ) : (
              <div style={{
                padding: '6px 12px',
                borderRadius: '12px',
                background: '#1a1a1a',
                border: '1px solid #3a3a3a',
                color: '#888',
                fontSize: '13px',
                fontWeight: 700,
              }}>
                Completed
              </div>
            )}
            <div style={{ fontSize: '11px', color: '#666' }}>
              Ends {new Date(leaderboard.ends_at).toLocaleString()}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
          {isActive && (
            <button
              onClick={onSubmit}
              disabled={onCooldown}
              style={{
                padding: '10px 18px',
                background: onCooldown
                  ? 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)'
                  : 'linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                cursor: onCooldown ? 'not-allowed' : 'pointer',
                fontWeight: 700,
                fontSize: '14px',
                boxShadow: onCooldown ? 'none' : '0 4px 15px rgba(255, 107, 53, 0.4)',
              }}
            >
              + Submit My Lift
            </button>
          )}
          {isActive && onCooldown && cooldownUntil && (
            <div style={{
              padding: '10px 14px',
              background: 'rgba(255, 107, 53, 0.08)',
              border: '1px solid rgba(255, 107, 53, 0.2)',
              borderRadius: '10px',
              color: '#ff9469',
              fontSize: '13px',
              fontWeight: 500,
              alignSelf: 'center',
            }}>
              Next entry in {formatTimeRemaining(cooldownUntil)}
            </div>
          )}
          {canDelete && (
            <button
              onClick={onDeleteLeaderboard}
              style={{
                padding: '10px 16px',
                background: 'transparent',
                color: '#ff4444',
                border: '1px solid rgba(255, 68, 68, 0.3)',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '13px',
              }}
            >
              Delete leaderboard
            </button>
          )}
        </div>
      </div>

      {submissionsLoading ? (
        <div style={{ textAlign: 'center', padding: '30px', color: '#888' }}>Loading submissions...</div>
      ) : submissions.length === 0 ? (
        <div style={{
          background: '#0a0a0a',
          borderRadius: '12px',
          border: '1px solid #3a3a3a',
          padding: '30px',
          textAlign: 'center',
          color: '#666',
          fontStyle: 'italic',
        }}>
          No submissions yet. {isActive ? 'Be the first!' : ''}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {submissions.map((s, i) => {
            const rank = i + 1
            const isCurrentUser = s.user_id === userId
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
            return (
              <div
                key={s.id}
                style={{
                  background: '#0a0a0a',
                  borderRadius: '12px',
                  border: isCurrentUser ? '1px solid rgba(255, 107, 53, 0.4)' : '1px solid #3a3a3a',
                  padding: '16px 18px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <div style={{ width: '36px', textAlign: 'center', fontSize: medal ? '22px' : '15px', fontWeight: 700, color: medal ? undefined : '#888' }}>
                    {medal || `#${rank}`}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: isCurrentUser ? '#ff6b35' : '#fff', fontSize: '15px', fontWeight: 700 }}>
                      {s.display_name || s.username}{isCurrentUser ? ' (you)' : ''}
                    </div>
                    <div style={{ color: '#888', fontSize: '12px' }}>Lv.{s.avatar_level} · {new Date(s.created_at).toLocaleDateString()}</div>
                  </div>
                  <div style={{
                    fontSize: '18px',
                    fontWeight: 800,
                    color: '#ffd700',
                    padding: '4px 12px',
                    background: 'rgba(255, 215, 0, 0.1)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                  }}>
                    {s.value}{s.reps ? ` × ${s.reps}` : ''} {leaderboard.unit}
                  </div>
                </div>
                {s.notes && (
                  <div style={{ color: '#ccc', fontSize: '13px', marginBottom: '10px', whiteSpace: 'pre-wrap' }}>{s.notes}</div>
                )}
                <video
                  src={s.video_url}
                  controls
                  preload="metadata"
                  style={{ width: '100%', maxHeight: '380px', borderRadius: '8px', background: '#000' }}
                />
                {userIsAdmin && (
                  <div style={{ marginTop: '10px', textAlign: 'right' }}>
                    <button
                      onClick={() => onAdminDelete(s.id)}
                      style={{
                        padding: '6px 12px',
                        background: 'transparent',
                        color: '#ff4444',
                        border: '1px solid rgba(255, 68, 68, 0.3)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '12px',
                      }}
                    >
                      Remove (admin)
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showSubmit && (
        <SubmitModal
          userId={userId}
          leaderboardId={leaderboard.id}
          unit={leaderboard.unit}
          onClose={onCloseSubmit}
          onDone={onSubmitDone}
        />
      )}
    </div>
  )
}

function CreateModal({ userId, onClose, onCreated }: { userId: string; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [unit, setUnit] = useState('lbs')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handle = async () => {
    if (!title.trim()) { setError('Title is required'); return }
    setSubmitting(true)
    setError('')
    try {
      await createLeaderboard({ creator_id: userId, title, description, unit })
      onCreated()
    } catch (err: any) {
      setError(err.message || 'Failed to create leaderboard')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Overlay onClose={onClose}>
      <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', margin: '0 0 6px 0' }}>Create Lift Leaderboard</h3>
      <p style={{ color: '#888', fontSize: '13px', margin: '0 0 18px 0' }}>Runs for 7 days. You can only create one per week.</p>

      <Field label="Title">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. 5 rep max bench press"
          maxLength={80}
          style={inputStyle}
        />
      </Field>

      <Field label="Description (optional)">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Rules, notes, etc."
          maxLength={500}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </Field>

      <Field label="Unit">
        <select value={unit} onChange={(e) => setUnit(e.target.value)} style={inputStyle}>
          {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </Field>

      {error && <div style={errorStyle}>{error}</div>}

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
        <button onClick={onClose} style={btnSecondary}>Cancel</button>
        <button onClick={handle} disabled={submitting} style={btnPrimary}>{submitting ? 'Creating...' : 'Create'}</button>
      </div>
    </Overlay>
  )
}

function SubmitModal({
  userId, leaderboardId, unit, onClose, onDone,
}: {
  userId: string
  leaderboardId: string
  unit: string
  onClose: () => void
  onDone: () => void
}) {
  const [value, setValue] = useState('')
  const [reps, setReps] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')

  const handle = async () => {
    setError('')
    const num = parseFloat(value)
    if (!Number.isFinite(num)) { setError('Enter a valid number'); return }
    if (!file) { setError('Upload a proof video'); return }

    try {
      setProgress('Uploading video...')
      const videoUrl = await uploadProofVideo(userId, file)
      setProgress('Saving entry...')
      const repsNum = reps.trim() ? parseInt(reps, 10) : null
      await submitEntry({
        leaderboard_id: leaderboardId,
        user_id: userId,
        value: num,
        reps: repsNum && Number.isFinite(repsNum) ? repsNum : null,
        video_url: videoUrl,
        notes,
      })
      onDone()
    } catch (err: any) {
      setError(err.message || 'Failed to submit')
    } finally {
      setProgress('')
    }
  }

  return (
    <Overlay onClose={onClose}>
      <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', margin: '0 0 6px 0' }}>Submit Entry</h3>
      <p style={{ color: '#888', fontSize: '13px', margin: '0 0 18px 0' }}>Upload a video proof of your lift. You can submit a new entry every 24 hours.</p>

      <Field label={`Value (${unit})`}>
        <input
          type="number"
          step="any"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 225"
          style={inputStyle}
        />
      </Field>

      <Field label="Reps (optional)">
        <input
          type="number"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          placeholder="e.g. 5"
          style={inputStyle}
        />
      </Field>

      <Field label="Proof video">
        <input
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          style={{ ...inputStyle, padding: '10px' }}
        />
        <p style={{ color: '#666', fontSize: '11px', margin: '4px 0 0 0' }}>Max 100 MB. Mp4/Mov/Webm.</p>
      </Field>

      <Field label="Notes (optional)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={300}
          rows={2}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </Field>

      {error && <div style={errorStyle}>{error}</div>}
      {progress && <div style={{ color: '#ff9469', fontSize: '13px', marginTop: '10px' }}>{progress}</div>}

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
        <button onClick={onClose} disabled={!!progress} style={btnSecondary}>Cancel</button>
        <button onClick={handle} disabled={!!progress} style={btnPrimary}>{progress ? '...' : 'Submit'}</button>
      </div>
    </Overlay>
  )
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: 2000, padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '500px', width: '100%', padding: '28px',
          background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
          border: '1px solid #3a3a3a', borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ display: 'block', marginBottom: '6px', color: '#ccc', fontWeight: 600, fontSize: '13px' }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  boxSizing: 'border-box',
  background: '#0a0a0a',
  border: '1px solid #3a3a3a',
  borderRadius: '10px',
  color: '#fff',
  fontSize: '14px',
  fontWeight: 500,
  fontFamily: 'inherit',
}

const errorStyle: React.CSSProperties = {
  color: '#ff4444',
  marginTop: '12px',
  padding: '12px',
  background: 'rgba(255, 68, 68, 0.1)',
  border: '1px solid rgba(255, 68, 68, 0.3)',
  borderRadius: '10px',
  fontSize: '13px',
  fontWeight: 500,
}

const btnPrimary: React.CSSProperties = {
  padding: '10px 18px',
  background: 'linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)',
  color: '#fff',
  border: 'none',
  borderRadius: '10px',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '14px',
}

const btnSecondary: React.CSSProperties = {
  padding: '10px 18px',
  background: 'transparent',
  color: '#888',
  border: '1px solid #3a3a3a',
  borderRadius: '10px',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '14px',
}
