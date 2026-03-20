-- Add attack notifications table
-- Run this in the Supabase SQL Editor

-- Create the attack_notifications table
CREATE TABLE IF NOT EXISTS attack_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  target_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  attacker_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  attacker_username TEXT NOT NULL,
  weapon_name TEXT NOT NULL,
  damage_dealt INTEGER NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX idx_attack_notifications_target ON attack_notifications(target_user_id, is_read, created_at DESC);

-- Enable RLS
ALTER TABLE attack_notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "Users can read own notifications"
  ON attack_notifications FOR SELECT
  USING (auth.uid() = target_user_id);

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update own notifications"
  ON attack_notifications FOR UPDATE
  USING (auth.uid() = target_user_id);

-- Anyone can insert notifications (when attacking someone)
CREATE POLICY "Anyone can insert notifications"
  ON attack_notifications FOR INSERT
  WITH CHECK (true);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON attack_notifications FOR DELETE
  USING (auth.uid() = target_user_id);
