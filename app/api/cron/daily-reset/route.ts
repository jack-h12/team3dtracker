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

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // Delete all tasks for all users
    const { error: tasksError } = await supabase
      .from('tasks')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all rows (neq a non-existent id)

    if (tasksError) throw tasksError

    // Reset avatar_level, tasks_completed_today, and daily completion timestamp for all users
    const { error: profilesError } = await supabase
      .from('profiles')
      .update({
        avatar_level: 0,
        tasks_completed_today: 0,
        completed_all_tasks_at: null,
      })
      .neq('id', '00000000-0000-0000-0000-000000000000') // Update all rows

    if (profilesError) throw profilesError

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
