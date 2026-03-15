-- ============================================
-- ADD ELITE STATUS FEATURE
-- Run this in your Supabase SQL Editor
-- ============================================

-- Add column to track when user first completed all tasks
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS first_completed_all_tasks_at TIMESTAMP WITH TIME ZONE;

-- This column will be set when a user completes all 10 tasks
-- Only the first 3 users (by timestamp) can purchase weapons and name_change items

