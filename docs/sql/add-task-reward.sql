-- ============================================
-- ADD REWARD FIELD TO TASKS
-- Run this in your Supabase SQL Editor
-- ============================================

-- Add reward column to tasks table (optional text field)
ALTER TABLE tasks 
  ADD COLUMN IF NOT EXISTS reward TEXT;

-- Note: This column is optional, so existing tasks will have NULL rewards
-- Users can add rewards when creating new tasks

