'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  listCoreLifts,
  getCoreLiftSubmissions,
  submitCoreLiftEntry,
  deleteCoreLiftSubmission,
  dotsForSubmission,
  EXERCISE_LABEL,
  EXERCISE_EMOJI,
  EXERCISE_ORDER,
} from '@/lib/coreLifts'
import type { CoreLift, CoreLiftSubmissionWithUser, Exercise } from '@/lib/coreLifts'
import {
  getProfile,
  upsertProfile,
  deleteProfile,
  computeFFMI,
  kgToLbs,
  lbsToKg,
  cmToInches,
  inchesToCm,
  formatHeight,
  formatWeight,
} from '@/lib/liftProfile'
import type { LiftProfile, UnitPref } from '@/lib/liftProfile'
import { uploadProofVideo } from '@/lib/lifts'
import { isAdmin } from '@/lib/admin'
import { showModal, showConfirm } from '@/lib/modal'

interface CoreLiftsProps {
  userId: string
  onDetailOpenChange?: (open: boolean) => void
}

type RankMode = 'absolute' | 'relative'

export default function CoreLifts({ userId, onDetailOpenChange }: CoreLiftsProps) {
  const [lifts, setLifts] = useState<CoreLift[]>([])
  const [profile, setProfile] = useState<LiftProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [userIsAdmin, setUserIsAdmin] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [selectedLiftId, setSelectedLiftId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [ls, p, admin] = await Promise.all([
        listCoreLifts(),
        getProfile(userId),
        isAdmin(userId),
      ])
      setLifts(ls)
      setProfile(p)
      setUserIsAdmin(admin)
    } catch (err) {
      console.error('Error loading core lifts:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    onDetailOpenChange?.(selectedLiftId !== null)
  }, [selectedLiftId, onDetailOpenChange])

  const selected = lifts.find((l) => l.id === selectedLiftId) || null

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>Loading core lifts...</div>
  }

  if (selected) {
    return (
      <CoreLiftDetail
        userId={userId}
        userIsAdmin={userIsAdmin}
        lift={selected}
        profile={profile}
        onBack={() => setSelectedLiftId(null)}
        onNeedProfile={() => setShowProfile(true)}
      />
    )
  }

  const liftsByExercise = new Map<Exercise, CoreLift[]>()
  for (const l of lifts) {
    const arr = liftsByExercise.get(l.exercise) || []
    arr.push(l)
    liftsByExercise.set(l.exercise, arr)
  }

  return (
    <div style={{ marginBottom: '36px' }}>
      <ProfileCard
        profile={profile}
        onEdit={() => setShowProfile(true)}
      />

      <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: '24px 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Core Lifts
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {EXERCISE_ORDER.map((ex) => {
          const variants = liftsByExercise.get(ex) || []
          if (variants.length === 0) return null
          return (
            <div key={ex} style={{
              background: '#0a0a0a',
              border: '1px solid #3a3a3a',
              borderRadius: '12px',
              padding: '14px 16px',
            }}>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#fff', marginBottom: '10px' }}>
                <span style={{ marginRight: '8px' }}>{EXERCISE_EMOJI[ex]}</span>
                {EXERCISE_LABEL[ex]}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedLiftId(v.id)}
                    style={{
                      padding: '8px 14px',
                      background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
                      border: '1px solid #3a3a3a',
                      borderRadius: '10px',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 600,
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#ff6b35' }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#3a3a3a' }}
                  >
                    {v.display_name}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {showProfile && (
        <ProfileModal
          userId={userId}
          existing={profile}
          onClose={() => setShowProfile(false)}
          onSaved={async (p) => {
            setProfile(p)
            setShowProfile(false)
          }}
          onDeleted={() => {
            setProfile(null)
            setShowProfile(false)
          }}
        />
      )}
    </div>
  )
}

function ProfileCard({ profile, onEdit }: { profile: LiftProfile | null; onEdit: () => void }) {
  if (!profile) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.08) 0%, rgba(255, 69, 0, 0.04) 100%)',
        border: '1px solid rgba(255, 107, 53, 0.3)',
        borderRadius: '12px',
        padding: '18px',
      }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
          Set up your lift profile
        </div>
        <div style={{ fontSize: '13px', color: '#bbb', marginBottom: '12px' }}>
          We use your bodyweight to compute pound-for-pound (DOTS) rankings.
        </div>
        <button onClick={onEdit} style={btnPrimary}>+ Create Profile</button>
      </div>
    )
  }

  const ffmi = computeFFMI(profile)
  const pref = profile.unit_pref

  return (
    <div style={{
      background: '#0a0a0a',
      border: '1px solid #3a3a3a',
      borderRadius: '12px',
      padding: '16px 18px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
            Your Profile ({pref === 'metric' ? 'kg / cm' : 'lbs / in'})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px 22px' }}>
            <Stat label="Height" value={formatHeight(profile.height_cm, pref)} />
            <Stat label="Weight" value={formatWeight(profile.weight_kg, pref)} />
            {profile.resting_hr !== null && <Stat label="Resting HR" value={`${profile.resting_hr} bpm`} />}
            {profile.body_fat_pct !== null && <Stat label="Body Fat" value={`${profile.body_fat_pct.toFixed(1)}%`} />}
            {ffmi !== null && <Stat label="FFMI" value={ffmi.toFixed(1)} />}
          </div>
        </div>
        <button onClick={onEdit} style={btnSecondary}>Edit</button>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: '15px', color: '#fff', fontWeight: 700 }}>{value}</div>
    </div>
  )
}

function ProfileModal({
  userId, existing, onClose, onSaved, onDeleted,
}: {
  userId: string
  existing: LiftProfile | null
  onClose: () => void
  onSaved: (p: LiftProfile) => void
  onDeleted: () => void
}) {
  const [pref, setPref] = useState<UnitPref>(existing?.unit_pref || 'imperial')

  // Display values reflect the current unit pref. Stored canonical = cm/kg.
  // In imperial mode height is split across feet + inches; in metric it's cm.
  const [heightCmStr, setHeightCmStr] = useState(() =>
    existing && (existing.unit_pref || 'imperial') === 'metric' ? existing.height_cm.toFixed(1) : '',
  )
  const [feetStr, setFeetStr] = useState(() => {
    if (!existing) return ''
    return Math.floor(cmToInches(existing.height_cm) / 12).toString()
  })
  const [inchesStr, setInchesStr] = useState(() => {
    if (!existing) return ''
    const totalIn = cmToInches(existing.height_cm)
    const ft = Math.floor(totalIn / 12)
    return (totalIn - ft * 12).toFixed(1)
  })
  const [weightStr, setWeightStr] = useState(() => {
    if (!existing) return ''
    return (existing.unit_pref || 'imperial') === 'metric'
      ? existing.weight_kg.toFixed(1)
      : kgToLbs(existing.weight_kg).toFixed(1)
  })
  const [restingHr, setRestingHr] = useState(existing?.resting_hr?.toString() || '')
  const [bodyFat, setBodyFat] = useState(existing?.body_fat_pct?.toString() || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Read currently-entered height as cm regardless of which mode the user is in.
  const currentHeightCm = (): number | null => {
    if (pref === 'metric') {
      const v = parseFloat(heightCmStr)
      return Number.isFinite(v) && v > 0 ? v : null
    }
    const ft = parseFloat(feetStr)
    const inch = inchesStr.trim() === '' ? 0 : parseFloat(inchesStr)
    if (!Number.isFinite(ft) || ft < 0) return null
    if (!Number.isFinite(inch) || inch < 0) return null
    const totalIn = ft * 12 + inch
    return totalIn > 0 ? inchesToCm(totalIn) : null
  }

  // When user toggles units, convert the visible values so they don't lose data.
  const togglePref = (next: UnitPref) => {
    if (next === pref) return
    const cm = currentHeightCm()
    if (cm !== null) {
      if (next === 'metric') {
        setHeightCmStr(cm.toFixed(1))
      } else {
        const totalIn = cmToInches(cm)
        const ft = Math.floor(totalIn / 12)
        setFeetStr(ft.toString())
        setInchesStr((totalIn - ft * 12).toFixed(1))
      }
    }
    const w = parseFloat(weightStr)
    if (Number.isFinite(w)) {
      setWeightStr(next === 'metric' ? lbsToKg(w).toFixed(1) : kgToLbs(w).toFixed(1))
    }
    setPref(next)
  }

  const handle = async () => {
    setError('')
    const heightCm = currentHeightCm()
    const w = parseFloat(weightStr)
    if (heightCm === null) { setError('Enter a valid height'); return }
    if (!Number.isFinite(w) || w <= 0) { setError('Enter a valid weight'); return }

    const weightKg = pref === 'metric' ? w : lbsToKg(w)

    let rhr: number | null = null
    if (restingHr.trim()) {
      const n = parseInt(restingHr, 10)
      if (!Number.isFinite(n) || n <= 0) { setError('Resting HR must be a positive integer'); return }
      rhr = n
    }
    let bf: number | null = null
    if (bodyFat.trim()) {
      const n = parseFloat(bodyFat)
      if (!Number.isFinite(n) || n < 0 || n >= 70) { setError('Body fat must be between 0 and 70'); return }
      bf = n
    }

    setSubmitting(true)
    try {
      const saved = await upsertProfile({
        user_id: userId,
        height_cm: heightCm,
        weight_kg: weightKg,
        resting_hr: rhr,
        body_fat_pct: bf,
        unit_pref: pref,
      })
      onSaved(saved)
    } catch (err: any) {
      setError(err.message || 'Failed to save profile')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    const ok = await showConfirm(
      'Delete profile',
      'Delete your lift profile? Existing core lift submissions keep their snapshotted bodyweight, but you\'ll need to set up a new profile to submit again.',
    )
    if (!ok) return
    setSubmitting(true)
    try {
      await deleteProfile(userId)
      onDeleted()
    } catch (err: any) {
      setError(err.message || 'Failed to delete profile')
      setSubmitting(false)
    }
  }

  return (
    <Overlay onClose={onClose}>
      <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', margin: '0 0 14px 0' }}>Lift Profile</h3>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
        <UnitToggle active={pref === 'imperial'} onClick={() => togglePref('imperial')}>lbs / inches</UnitToggle>
        <UnitToggle active={pref === 'metric'} onClick={() => togglePref('metric')}>kg / cm</UnitToggle>
      </div>

      {pref === 'metric' ? (
        <Field label="Height (cm) *">
          <input
            type="number"
            step="any"
            value={heightCmStr}
            onChange={(e) => setHeightCmStr(e.target.value)}
            placeholder="e.g. 180"
            style={inputStyle}
          />
        </Field>
      ) : (
        <Field label="Height *">
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <input
                type="number"
                min="0"
                step="1"
                value={feetStr}
                onChange={(e) => setFeetStr(e.target.value)}
                placeholder="ft"
                style={inputStyle}
              />
              <p style={{ color: '#666', fontSize: '11px', margin: '4px 0 0 0' }}>feet</p>
            </div>
            <div style={{ flex: 1 }}>
              <input
                type="number"
                min="0"
                step="any"
                value={inchesStr}
                onChange={(e) => setInchesStr(e.target.value)}
                placeholder="in"
                style={inputStyle}
              />
              <p style={{ color: '#666', fontSize: '11px', margin: '4px 0 0 0' }}>inches</p>
            </div>
          </div>
        </Field>
      )}

      <Field label={`Weight (${pref === 'metric' ? 'kg' : 'lbs'}) *`}>
        <input
          type="number"
          step="any"
          value={weightStr}
          onChange={(e) => setWeightStr(e.target.value)}
          placeholder={pref === 'metric' ? 'e.g. 82' : 'e.g. 180'}
          style={inputStyle}
        />
      </Field>

      <Field label="Resting heart rate (bpm, optional)">
        <input
          type="number"
          value={restingHr}
          onChange={(e) => setRestingHr(e.target.value)}
          placeholder="e.g. 58"
          style={inputStyle}
        />
      </Field>

      <Field label="Body fat % (optional — needed for FFMI)">
        <input
          type="number"
          step="any"
          value={bodyFat}
          onChange={(e) => setBodyFat(e.target.value)}
          placeholder="e.g. 15"
          style={inputStyle}
        />
      </Field>

      {error && <div style={errorStyle}>{error}</div>}

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', flexWrap: 'wrap' }}>
        <div>
          {existing && (
            <button onClick={handleDelete} disabled={submitting} style={btnDanger}>Delete profile</button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} disabled={submitting} style={btnSecondary}>Cancel</button>
          <button onClick={handle} disabled={submitting} style={btnPrimary}>{submitting ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </Overlay>
  )
}

function CoreLiftDetail({
  userId, userIsAdmin, lift, profile, onBack, onNeedProfile,
}: {
  userId: string
  userIsAdmin: boolean
  lift: CoreLift
  profile: LiftProfile | null
  onBack: () => void
  onNeedProfile: () => void
}) {
  const [submissions, setSubmissions] = useState<CoreLiftSubmissionWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showSubmit, setShowSubmit] = useState(false)
  const [mode, setMode] = useState<RankMode>('absolute')

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const subs = await getCoreLiftSubmissions(lift.id)
      setSubmissions(subs)
    } catch (err) {
      console.error('Error loading core lift submissions:', err)
    } finally {
      setLoading(false)
    }
  }, [lift.id])

  useEffect(() => { reload() }, [reload])

  const userSubs = submissions.filter((s) => s.user_id === userId)
  const lastUserAt = userSubs.length > 0
    ? userSubs.reduce((max, s) => (s.created_at > max ? s.created_at : max), userSubs[0].created_at)
    : null
  const cooldownUntilMs = lastUserAt ? new Date(lastUserAt).getTime() + 24 * 60 * 60 * 1000 : null
  const onCooldown = !!cooldownUntilMs && cooldownUntilMs > Date.now()

  const isAmrap = lift.unit === 'reps'
  const supportsRelative = !isAmrap

  // Build ranked list for current mode.
  let ranked: CoreLiftSubmissionWithUser[]
  if (mode === 'relative' && supportsRelative) {
    ranked = [...submissions]
      .filter((s) => s.dots !== null)
      .sort((a, b) => (b.dots! - a.dots!) || (a.created_at < b.created_at ? -1 : 1))
  } else {
    ranked = [...submissions].sort(
      (a, b) => (b.value - a.value) || (a.created_at < b.created_at ? -1 : 1),
    )
  }

  const handleAdminDelete = async (id: string) => {
    const ok = await showConfirm('Remove submission', 'Remove this submission?')
    if (!ok) return
    try {
      await deleteCoreLiftSubmission(id)
      await reload()
    } catch (err: any) {
      showModal('Error', err.message || 'Failed to delete submission', 'error')
    }
  }

  const pref: UnitPref = profile?.unit_pref || 'imperial'

  return (
    <div>
      <button onClick={onBack} style={{
        padding: '8px 14px', background: 'transparent', color: '#888',
        border: '1px solid #3a3a3a', borderRadius: '8px', cursor: 'pointer',
        fontWeight: 600, fontSize: '13px', marginBottom: '16px',
      }}>← Back</button>

      <div style={{
        background: '#0a0a0a', borderRadius: '12px', border: '1px solid #3a3a3a',
        padding: '20px', marginBottom: '20px',
      }}>
        <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', margin: '0 0 4px 0' }}>
          <span style={{ marginRight: '8px' }}>{EXERCISE_EMOJI[lift.exercise]}</span>
          {EXERCISE_LABEL[lift.exercise]} — {lift.display_name}
        </h3>
        <p style={{ color: '#888', fontSize: '13px', margin: '0 0 14px 0' }}>
          {isAmrap
            ? 'Ranked by reps. Pound-for-pound view not applicable.'
            : 'Toggle between absolute weight and pound-for-pound (DOTS) rankings.'}
        </p>

        {supportsRelative && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
            <UnitToggle active={mode === 'absolute'} onClick={() => setMode('absolute')}>Absolute</UnitToggle>
            <UnitToggle active={mode === 'relative'} onClick={() => setMode('relative')}>Pound-for-Pound</UnitToggle>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              if (!profile) { onNeedProfile(); return }
              setShowSubmit(true)
            }}
            disabled={onCooldown}
            style={{
              padding: '10px 18px',
              background: onCooldown
                ? 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)'
                : 'linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)',
              color: '#fff', border: 'none', borderRadius: '10px',
              cursor: onCooldown ? 'not-allowed' : 'pointer',
              fontWeight: 700, fontSize: '14px',
              boxShadow: onCooldown ? 'none' : '0 4px 15px rgba(255, 107, 53, 0.4)',
            }}
          >
            + Submit My Lift
          </button>
          {onCooldown && cooldownUntilMs && (
            <div style={{
              padding: '10px 14px',
              background: 'rgba(255, 107, 53, 0.08)',
              border: '1px solid rgba(255, 107, 53, 0.2)',
              borderRadius: '10px', color: '#ff9469',
              fontSize: '13px', fontWeight: 500, alignSelf: 'center',
            }}>
              Next entry in {formatRemaining(cooldownUntilMs - Date.now())}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '30px', color: '#888' }}>Loading...</div>
      ) : ranked.length === 0 ? (
        <div style={{
          background: '#0a0a0a', borderRadius: '12px', border: '1px solid #3a3a3a',
          padding: '30px', textAlign: 'center', color: '#666', fontStyle: 'italic',
        }}>
          No submissions yet. Be the first!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {ranked.map((s, i) => {
            const rank = i + 1
            const isCurrentUser = s.user_id === userId
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
            return (
              <div key={s.id} style={{
                background: '#0a0a0a', borderRadius: '12px',
                border: isCurrentUser ? '1px solid rgba(255, 107, 53, 0.4)' : '1px solid #3a3a3a',
                padding: '16px 18px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <div style={{ width: '36px', textAlign: 'center', fontSize: medal ? '22px' : '15px', fontWeight: 700, color: medal ? undefined : '#888' }}>
                    {medal || `#${rank}`}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: isCurrentUser ? '#ff6b35' : '#fff', fontSize: '15px', fontWeight: 700 }}>
                      {s.display_name || s.username}{isCurrentUser ? ' (you)' : ''}
                    </div>
                    <div style={{ color: '#888', fontSize: '12px' }}>
                      Lv.{s.avatar_level} · BW {formatWeight(s.bodyweight_kg, pref, 1)} · {new Date(s.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '18px', fontWeight: 800, color: '#ffd700',
                    padding: '4px 12px', background: 'rgba(255, 215, 0, 0.1)',
                    borderRadius: '8px', border: '1px solid rgba(255, 215, 0, 0.3)',
                  }}>
                    {mode === 'relative' && s.dots !== null
                      ? `${s.dots.toFixed(1)} DOTS`
                      : isAmrap
                      ? `${s.value} reps`
                      : formatWeight(s.value, pref, 1)}
                  </div>
                </div>
                {mode === 'relative' && !isAmrap && (
                  <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>
                    Lifted {formatWeight(lift.variant === 'weighted_1rm' ? s.bodyweight_kg + s.value : s.value, pref, 1)}
                    {lift.variant === 'weighted_1rm' ? ` (BW + ${formatWeight(s.value, pref, 1)} added)` : ''}
                  </div>
                )}
                {s.notes && (
                  <div style={{ color: '#ccc', fontSize: '13px', marginBottom: '10px', whiteSpace: 'pre-wrap' }}>{s.notes}</div>
                )}
                <video src={s.video_url} controls preload="metadata" style={{
                  width: '100%', maxHeight: '380px', borderRadius: '8px', background: '#000',
                }} />
                {userIsAdmin && (
                  <div style={{ marginTop: '10px', textAlign: 'right' }}>
                    <button onClick={() => handleAdminDelete(s.id)} style={{
                      padding: '6px 12px', background: 'transparent', color: '#ff4444',
                      border: '1px solid rgba(255, 68, 68, 0.3)', borderRadius: '8px',
                      cursor: 'pointer', fontWeight: 600, fontSize: '12px',
                    }}>
                      Remove (admin)
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showSubmit && profile && (
        <SubmitCoreLiftModal
          userId={userId}
          lift={lift}
          profile={profile}
          onClose={() => setShowSubmit(false)}
          onDone={async () => { setShowSubmit(false); await reload() }}
        />
      )}
    </div>
  )
}

function SubmitCoreLiftModal({
  userId, lift, profile, onClose, onDone,
}: {
  userId: string
  lift: CoreLift
  profile: LiftProfile
  onClose: () => void
  onDone: () => void
}) {
  const isAmrap = lift.unit === 'reps'
  const isWeighted1rm = lift.variant === 'weighted_1rm'
  const pref = profile.unit_pref

  const [valueStr, setValueStr] = useState('')
  // Bodyweight defaults to profile but user can override per-submission.
  const [bwStr, setBwStr] = useState(() =>
    pref === 'metric' ? profile.weight_kg.toFixed(1) : kgToLbs(profile.weight_kg).toFixed(1),
  )
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')

  // For weight lifts, show preview of DOTS based on entered value + bw.
  const previewDots = (() => {
    if (isAmrap) return null
    const v = parseFloat(valueStr)
    const bw = parseFloat(bwStr)
    if (!Number.isFinite(v) || !Number.isFinite(bw) || v <= 0 || bw <= 0) return null
    const valueKg = pref === 'metric' ? v : lbsToKg(v)
    const bwKg = pref === 'metric' ? bw : lbsToKg(bw)
    return dotsForSubmission(lift, { value: valueKg, bodyweight_kg: bwKg })
  })()

  const handle = async () => {
    setError('')
    const v = parseFloat(valueStr)
    if (!Number.isFinite(v) || v <= 0) { setError(isAmrap ? 'Enter a valid rep count' : 'Enter a valid weight'); return }
    if (isAmrap && !Number.isInteger(v)) { setError('Reps must be a whole number'); return }
    const bw = parseFloat(bwStr)
    if (!Number.isFinite(bw) || bw <= 0) { setError('Enter a valid bodyweight'); return }
    if (!file) { setError('Upload a proof video'); return }

    try {
      setProgress('Uploading video...')
      const videoUrl = await uploadProofVideo(userId, file)
      setProgress('Saving entry...')

      // Convert to canonical units for storage.
      const valueCanonical = isAmrap
        ? v
        : pref === 'metric' ? v : lbsToKg(v)
      const bwKg = pref === 'metric' ? bw : lbsToKg(bw)

      await submitCoreLiftEntry({
        core_lift_id: lift.id,
        user_id: userId,
        value: valueCanonical,
        bodyweight_kg: bwKg,
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

  const valueLabel = isAmrap
    ? 'Reps'
    : isWeighted1rm
    ? `Added weight (${pref === 'metric' ? 'kg' : 'lbs'})`
    : `Weight (${pref === 'metric' ? 'kg' : 'lbs'})`

  return (
    <Overlay onClose={onClose}>
      <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', margin: '0 0 6px 0' }}>
        Submit — {EXERCISE_EMOJI[lift.exercise]} {EXERCISE_LABEL[lift.exercise]} {lift.display_name}
      </h3>
      <p style={{ color: '#888', fontSize: '13px', margin: '0 0 18px 0' }}>
        Upload a video proof. One submission per 24 hours.
      </p>

      <Field label={valueLabel + ' *'}>
        <input
          type="number"
          step={isAmrap ? 1 : 'any'}
          value={valueStr}
          onChange={(e) => setValueStr(e.target.value)}
          placeholder={isAmrap ? 'e.g. 25' : (pref === 'metric' ? 'e.g. 100' : 'e.g. 225')}
          style={inputStyle}
        />
      </Field>

      <Field label={`Bodyweight at lift (${pref === 'metric' ? 'kg' : 'lbs'}) *`}>
        <input
          type="number"
          step="any"
          value={bwStr}
          onChange={(e) => setBwStr(e.target.value)}
          style={inputStyle}
        />
        <p style={{ color: '#666', fontSize: '11px', margin: '4px 0 0 0' }}>
          Defaults to your profile weight. Override if you weighed in different that day.
        </p>
      </Field>

      {previewDots !== null && (
        <div style={{
          padding: '10px 12px',
          background: 'rgba(255, 215, 0, 0.08)',
          border: '1px solid rgba(255, 215, 0, 0.25)',
          borderRadius: '10px',
          color: '#ffd700',
          fontSize: '13px',
          fontWeight: 600,
          marginBottom: '14px',
        }}>
          Estimated DOTS: {previewDots.toFixed(1)}
        </div>
      )}

      <Field label="Proof video *">
        <input
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          style={{ ...inputStyle, padding: '10px' }}
        />
        <p style={{ color: '#666', fontSize: '11px', margin: '4px 0 0 0' }}>Max 100 MB.</p>
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

function UnitToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 14px',
        background: active ? 'linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)' : 'transparent',
        color: active ? '#fff' : '#888',
        border: active ? 'none' : '1px solid #3a3a3a',
        borderRadius: '10px',
        cursor: 'pointer',
        fontWeight: 700,
        fontSize: '13px',
      }}
    >
      {children}
    </button>
  )
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 2000, padding: '20px',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        maxWidth: '500px', width: '100%', padding: '28px',
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
        border: '1px solid #3a3a3a', borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
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

function formatRemaining(ms: number): string {
  if (ms <= 0) return '0m'
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', boxSizing: 'border-box',
  background: '#0a0a0a', border: '1px solid #3a3a3a', borderRadius: '10px',
  color: '#fff', fontSize: '14px', fontWeight: 500, fontFamily: 'inherit',
}

const errorStyle: React.CSSProperties = {
  color: '#ff4444', marginTop: '12px', padding: '12px',
  background: 'rgba(255, 68, 68, 0.1)', border: '1px solid rgba(255, 68, 68, 0.3)',
  borderRadius: '10px', fontSize: '13px', fontWeight: 500,
}

const btnPrimary: React.CSSProperties = {
  padding: '10px 18px', background: 'linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)',
  color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer',
  fontWeight: 700, fontSize: '14px',
}

const btnDanger: React.CSSProperties = {
  padding: '10px 16px', background: 'transparent', color: '#ff4444',
  border: '1px solid rgba(255, 68, 68, 0.3)', borderRadius: '10px',
  cursor: 'pointer', fontWeight: 600, fontSize: '13px',
}

const btnSecondary: React.CSSProperties = {
  padding: '10px 18px', background: 'transparent', color: '#888',
  border: '1px solid #3a3a3a', borderRadius: '10px', cursor: 'pointer',
  fontWeight: 600, fontSize: '14px',
}
