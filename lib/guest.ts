/**
 * Guest mode — lets visitors browse the app without an account.
 *
 * The "user" is a sentinel id ('guest') and all state lives in-memory plus
 * sessionStorage so a page refresh keeps the sandbox alive. Nothing here
 * touches Supabase. Lib functions detect guest by checking userId === GUEST_USER_ID
 * and route through this module instead of the network.
 */

import type { Profile, Task } from './supabase'

export const GUEST_USER_ID = 'guest'

export function isGuest(userId: string | null | undefined): boolean {
  return userId === GUEST_USER_ID
}

// Helper for write paths that we don't sandbox. Throws a user-facing error
// so the existing try/catch + modal flow surfaces a clean "sign up" message
// instead of a Supabase RLS error.
export function requireAccount(action = 'do that'): never {
  throw new Error(`Guest mode — sign up to ${action}.`)
}

export function assertAccount(userId: string | null | undefined, action = 'do that') {
  if (isGuest(userId) || !userId) requireAccount(action)
}

const STORAGE_KEY = 'team3d_guest_state_v1'

type GuestState = {
  profile: Profile
  tasks: Task[]                  // all tasks across all dates (mirrors `tasks` table)
  taskExp: Record<string, number> // per-task EXP grant, mirrors deterministic reward
}

function nowIso() { return new Date().toISOString() }

function makeId() {
  // RFC4122-ish v4 — good enough for client-only guest IDs and keeps the
  // taskExpReward UUID hash well-distributed.
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'gxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function makeGuestProfile(): Profile {
  return {
    id: GUEST_USER_ID,
    username: 'Guest',
    display_name: 'Guest',
    name_changed_by: null,
    is_admin: false,
    avatar_level: 0,
    lifetime_exp: 0,
    gold: 100,
    tasks_completed_today: 0,
    completed_all_tasks_at: null,
    potion_immunity_expires: null,
    created_at: nowIso(),
  }
}

function seedTasks(taskDate: string): Task[] {
  const placeholders = [
    'Drink a glass of water',
    'Take a 10-minute walk',
    'Write down one goal for today',
    'Do 20 push-ups',
    'Read for 15 minutes',
  ]
  return placeholders.map((description, i) => ({
    id: makeId(),
    user_id: GUEST_USER_ID,
    description,
    reward: null,
    is_done: false,
    task_order: i,
    task_date: taskDate,
    created_at: nowIso(),
  } as Task))
}

let cached: GuestState | null = null

function load(): GuestState | null {
  if (cached) return cached
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    cached = JSON.parse(raw) as GuestState
    return cached
  } catch {
    return null
  }
}

function save(state: GuestState) {
  cached = state
  if (typeof window !== 'undefined') {
    try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* ignore quota */ }
  }
}

export function initGuestState(currentTaskDate: string): Profile {
  const existing = load()
  if (existing) return existing.profile
  const state: GuestState = {
    profile: makeGuestProfile(),
    tasks: seedTasks(currentTaskDate),
    taskExp: {},
  }
  save(state)
  return state.profile
}

export function clearGuestState() {
  cached = null
  if (typeof window !== 'undefined') {
    try { window.sessionStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }
}

export function getGuestProfile(): Profile {
  const s = load()
  if (s) return s.profile
  const p = makeGuestProfile()
  save({ profile: p, tasks: [], taskExp: {} })
  return p
}

function updateState(mutate: (s: GuestState) => void) {
  const s = load() || { profile: makeGuestProfile(), tasks: [], taskExp: {} }
  mutate(s)
  save(s)
}

export function getGuestTasksForDate(date: string): Task[] {
  const s = load()
  if (!s) return []
  return s.tasks.filter((t) => t.task_date === date).sort((a, b) => a.task_order - b.task_order)
}

export function addGuestTask(description: string, reward: string | null, date: string, taskOrder?: number): Task {
  const existing = getGuestTasksForDate(date)
  if (existing.length >= 10) throw new Error('Maximum 10 tasks per day')
  const order = typeof taskOrder === 'number'
    ? taskOrder
    : existing.length === 0 ? 0 : Math.max(...existing.map((t) => t.task_order)) + 1
  const task: Task = {
    id: makeId(),
    user_id: GUEST_USER_ID,
    description,
    reward: reward && reward.trim() ? reward.trim() : null,
    is_done: false,
    task_order: order,
    task_date: date,
    created_at: nowIso(),
  } as Task
  updateState((s) => { s.tasks.push(task) })
  return task
}

export function hasGuestTask(taskId: string): boolean {
  const s = load()
  if (!s) return false
  return s.tasks.some((t) => t.id === taskId)
}

export function updateGuestTask(taskId: string, updates: Partial<Task>): Task {
  let result: Task | null = null
  updateState((s) => {
    const idx = s.tasks.findIndex((t) => t.id === taskId)
    if (idx === -1) return
    s.tasks[idx] = { ...s.tasks[idx], ...updates }
    result = s.tasks[idx]
  })
  if (!result) throw new Error('Task not found')
  return result
}

export function deleteGuestTask(taskId: string): void {
  updateState((s) => { s.tasks = s.tasks.filter((t) => t.id !== taskId) })
}

function recountDoneTodayAndFuture(s: GuestState, todayStr: string): number {
  return s.tasks.filter((t) => t.is_done && t.task_date >= todayStr).length
}

// Mirrors lib/tasks.ts:taskExpReward — flat 10 EXP per completion.
function taskExpReward(_taskId: string): 10 {
  return 10
}

export function completeGuestTask(taskId: string, todayStr: string): Profile {
  const s = load() || { profile: makeGuestProfile(), tasks: [], taskExp: {} }
  const idx = s.tasks.findIndex((t) => t.id === taskId)
  if (idx === -1) throw new Error('Task not found')
  if (s.tasks[idx].is_done) { save(s); return s.profile }

  s.tasks[idx] = { ...s.tasks[idx], is_done: true }
  const doneCount = recountDoneTodayAndFuture(s, todayStr)
  const newCounter = Math.min(10, doneCount)
  const oldCounter = s.profile.tasks_completed_today || 0
  const counterDelta = newCounter - oldCounter

  const expReward = counterDelta > 0 ? taskExpReward(taskId) : 0
  s.taskExp[taskId] = expReward as number
  s.profile = {
    ...s.profile,
    avatar_level: newCounter,
    tasks_completed_today: newCounter,
    lifetime_exp: s.profile.lifetime_exp + expReward,
    gold: s.profile.gold + 10,
    completed_all_tasks_at: newCounter === 10 && !s.profile.completed_all_tasks_at
      ? nowIso()
      : s.profile.completed_all_tasks_at,
  }
  save(s)
  return s.profile
}

export function uncompleteGuestTask(taskId: string, todayStr: string): Profile {
  const s = load() || { profile: makeGuestProfile(), tasks: [], taskExp: {} }
  const idx = s.tasks.findIndex((t) => t.id === taskId)
  if (idx === -1) return s.profile
  if (!s.tasks[idx].is_done) return s.profile

  s.tasks[idx] = { ...s.tasks[idx], is_done: false }
  const doneCount = recountDoneTodayAndFuture(s, todayStr)
  const newCounter = Math.min(10, doneCount)
  const oldCounter = s.profile.tasks_completed_today || 0
  const counterDelta = oldCounter - newCounter

  const expRefund = counterDelta > 0 ? (s.taskExp[taskId] ?? taskExpReward(taskId)) : 0
  s.profile = {
    ...s.profile,
    avatar_level: newCounter,
    tasks_completed_today: newCounter,
    lifetime_exp: Math.max(0, s.profile.lifetime_exp - expRefund),
    gold: Math.max(0, s.profile.gold - 10),
    completed_all_tasks_at: counterDelta > 0 ? null : s.profile.completed_all_tasks_at,
  }
  save(s)
  return s.profile
}
