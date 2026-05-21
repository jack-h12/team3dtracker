import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  // Verify the request is from Vercel Cron (or has the correct secret)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Use service role key to bypass RLS
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Missing Supabase environment variables' },
      { status: 500 }
    )
  }

  // DST guard: This cron is scheduled at both 21:00 and 22:00 UTC so that
  // one invocation always hits 5 PM Eastern regardless of EST/EDT.
  // Check the current Eastern hour and skip if it's not 5 PM (17:00).
  const easternHour = parseInt(
    new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      hour12: false,
    }),
    10
  )

  if (easternHour !== 17) {
    return NextResponse.json({
      skipped: true,
      message: `Current Eastern hour is ${easternHour}, not 17. Skipping reset.`,
      timestamp: new Date().toISOString(),
    })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // ── Snapshot today's data before resetting ──────────────────────────
    // Compute the snapshot date as today's date in Eastern time (the day
    // that is ending at this 5 PM reset).
    const snapshotDate = new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/New_York',
    }) // YYYY-MM-DD format

    // Check if snapshot already exists for this date (idempotency guard)
    const { data: existingSnapshot } = await supabase
      .from('daily_leaderboard_snapshots')
      .select('id')
      .eq('snapshot_date', snapshotDate)
      .limit(1)

    if (!existingSnapshot || existingSnapshot.length === 0) {
      // Snapshot tasks for all users — only the day that's ending.
      // Future-dated tasks (user-planned up to 7 days ahead) are left alone.
      const { data: allTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('task_date', snapshotDate)

      if (allTasks && allTasks.length > 0) {
        const taskSnapshots = allTasks.map((task: any) => ({
          user_id: task.user_id,
          snapshot_date: snapshotDate,
          description: task.description,
          reward: task.reward,
          is_done: task.is_done,
          task_order: task.task_order,
        }))

        const { error: taskSnapshotError } = await supabase
          .from('daily_task_snapshots')
          .insert(taskSnapshots)

        if (taskSnapshotError) {
          console.warn('Task snapshot failed:', taskSnapshotError.message)
        }
      }

      // Snapshot the daily leaderboard (sorted by completion order)
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_level, tasks_completed_today, completed_all_tasks_at, lifetime_exp')
        .order('avatar_level', { ascending: false })

      if (allProfiles && allProfiles.length > 0) {
        // Sort using the same logic as the live leaderboard
        const sorted = [...allProfiles].sort((a: any, b: any) => {
          const aCompleted = a.completed_all_tasks_at != null
          const bCompleted = b.completed_all_tasks_at != null
          if (aCompleted && bCompleted) {
            return new Date(a.completed_all_tasks_at).getTime() - new Date(b.completed_all_tasks_at).getTime()
          }
          if (aCompleted && !bCompleted) return -1
          if (!aCompleted && bCompleted) return 1
          if (b.avatar_level !== a.avatar_level) return b.avatar_level - a.avatar_level
          return 0
        })

        const leaderboardSnapshots = sorted.map((profile: any, index: number) => ({
          snapshot_date: snapshotDate,
          user_id: profile.id,
          username: profile.username,
          display_name: profile.display_name,
          avatar_level: profile.avatar_level,
          tasks_completed_today: profile.tasks_completed_today,
          completed_all_tasks_at: profile.completed_all_tasks_at,
          lifetime_exp: profile.lifetime_exp,
          rank: index + 1,
        }))

        const { error: lbSnapshotError } = await supabase
          .from('daily_leaderboard_snapshots')
          .insert(leaderboardSnapshots)

        if (lbSnapshotError) {
          console.warn('Leaderboard snapshot failed:', lbSnapshotError.message)
        }
      }
    }

    // ── Reset everything ────────────────────────────────────────────────
    // Delete only tasks for the day that's ending — future-dated tasks must
    // survive the reset. We always scope the delete client-side here rather
    // than relying on admin_reset_all_daily_progress, which wipes every row.
    const { error: tasksError } = await supabase
      .from('tasks')
      .delete()
      .eq('task_date', snapshotDate)

    if (tasksError) throw tasksError

    const { error: profilesError } = await supabase
      .from('profiles')
      .update({
        avatar_level: 0,
        tasks_completed_today: 0,
        completed_all_tasks_at: null,
      })
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (profilesError) throw profilesError

    // Clean up expired armour from all users' inventories
    const { error: armourCleanupError } = await supabase
      .from('user_inventory')
      .delete()
      .not('expires_at', 'is', null)
      .lte('expires_at', new Date().toISOString())

    if (armourCleanupError) {
      console.warn('Expired armour cleanup failed:', armourCleanupError.message)
    }

    return NextResponse.json({
      success: true,
      message: 'Daily reset completed for all users',
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Daily reset failed:', error)
    return NextResponse.json(
      { error: 'Daily reset failed', details: error.message },
      { status: 500 }
    )
  }
}
