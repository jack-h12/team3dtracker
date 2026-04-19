-- ============================================
-- ADD task_date COLUMN TO tasks TABLE
-- Lets users plan tasks up to 7 days in the future.
-- A task's "day" is defined by the 5pm-EST reset boundary:
--   * Before 5pm Eastern → today's Eastern calendar date
--   * At/after 5pm Eastern → tomorrow's Eastern calendar date
-- The cron archives/deletes tasks whose task_date matches the
-- snapshot date it just wrote, so future-dated tasks survive.
-- ============================================

-- 1. Add the column (nullable so backfill can run first)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_date DATE;

-- 2. Backfill existing rows to the current "task day" in Eastern time
UPDATE tasks
SET task_date = CASE
  WHEN EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'America/New_York')) >= 17
    THEN ((NOW() AT TIME ZONE 'America/New_York')::DATE + INTERVAL '1 day')::DATE
  ELSE (NOW() AT TIME ZONE 'America/New_York')::DATE
END
WHERE task_date IS NULL;

-- 3. Enforce NOT NULL going forward with a computed default
ALTER TABLE tasks
  ALTER COLUMN task_date SET NOT NULL,
  ALTER COLUMN task_date SET DEFAULT (
    CASE
      WHEN EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'America/New_York')) >= 17
        THEN ((NOW() AT TIME ZONE 'America/New_York')::DATE + INTERVAL '1 day')::DATE
      ELSE (NOW() AT TIME ZONE 'America/New_York')::DATE
    END
  );

-- 4. Index for fast per-day lookups
CREATE INDEX IF NOT EXISTS idx_tasks_user_date
  ON tasks(user_id, task_date);
