-- ============================================
-- ADD POTION IMMUNITY TRACKING
-- Run this in your Supabase SQL Editor
-- ============================================

-- Add potion_immunity_expires column to profiles table
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS potion_immunity_expires TIMESTAMP WITH TIME ZONE;

-- Note: This field will be set when a potion is used
-- Health Potion: 24 hours from use time
-- Super Potion: 48 hours from use time

