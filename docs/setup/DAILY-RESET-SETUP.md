# Daily Reset Setup Guide

This guide explains how to set up automatic daily reset at 5pm EST for all users.

## Problem

Previously, the daily reset only occurred when users signed into their accounts. This meant:
- Users who didn't sign in wouldn't get their tasks reset
- The reset was inconsistent across all users

## Solution

We've created a database function and scheduled job that automatically resets all users' daily progress at 5pm EST, regardless of whether they're signed in.

## Setup Instructions

### Option 1: Using pg_cron (Recommended)

1. **Run the SQL script:**
   - Open your Supabase Dashboard
   - Go to SQL Editor
   - Run the contents of `add-daily-reset-cron.sql`

2. **Verify the setup:**
   - Check that the cron job was created:
     ```sql
     SELECT * FROM cron.job WHERE jobname = 'daily-reset-5pm-est';
     ```

3. **Test the function manually (optional):**
   ```sql
   SELECT reset_all_daily_progress_automatic();
   ```

### Option 2: If pg_cron is not available

If you get an error about pg_cron not being available, you have a few alternatives:

#### A. Enable pg_cron in Supabase Dashboard
- Go to Database → Extensions
- Enable the `pg_cron` extension
- Then run the SQL script again

#### B. Use Supabase Edge Functions with Cron
1. Create a Supabase Edge Function that calls the reset function
2. Set up a cron trigger in your Supabase project settings
3. The function should call: `SELECT reset_all_daily_progress_automatic();`

#### C. Use an external cron service
- Set up a cron job (e.g., using a service like cron-job.org or GitHub Actions)
- Have it call a webhook that triggers the reset function
- The webhook should be secured with your Supabase service role key

## How It Works

1. **Database Function:** `reset_all_daily_progress_automatic()`
   - Checks if it's currently 5pm Eastern Time (handles EST/EDT automatically)
   - Checks if we've already reset today (prevents duplicate resets)
   - Deletes all tasks for all users
   - Resets `avatar_level` and `tasks_completed_today` to 0 for all users

2. **Scheduled Job:** Runs every hour
   - The function checks the time and only executes at 5pm Eastern
   - This ensures it works correctly during both EST and EDT periods

3. **Tracking:** Uses `daily_reset_log` table
   - Prevents multiple resets in the same day
   - Tracks when the last reset occurred

## Monitoring

To check if the reset is working:

1. **View cron job execution history:**
   ```sql
   SELECT * FROM cron.job_run_details 
   WHERE jobname = 'daily-reset-5pm-est' 
   ORDER BY start_time DESC 
   LIMIT 10;
   ```

2. **Check the reset log:**
   ```sql
   SELECT * FROM daily_reset_log;
   ```

3. **Manually trigger a reset (for testing):**
   ```sql
   SELECT reset_all_daily_progress_automatic();
   ```

## Troubleshooting

### The cron job isn't running
- Check if pg_cron extension is enabled
- Verify the cron job exists: `SELECT * FROM cron.job;`
- Check Supabase logs for any errors

### The reset isn't happening at 5pm EST
- Verify the function is checking Eastern Time correctly
- Check the `daily_reset_log` table to see when the last reset occurred
- The function has a 10-minute window (4:50pm - 5:10pm Eastern)

### Multiple resets in one day
- This shouldn't happen due to the date check in the function
- If it does, check the `daily_reset_log` table
- You can manually update it: `UPDATE daily_reset_log SET last_reset_date = CURRENT_DATE WHERE id = 1;`

## Client-Side Behavior

The client-side reset logic in `components/Tasks.tsx` will still work as a backup:
- When users sign in, the app checks if a reset is needed
- This ensures immediate reset for active users
- The database cron job ensures all users get reset, even if they don't sign in

Both systems work together to ensure reliable daily resets.

