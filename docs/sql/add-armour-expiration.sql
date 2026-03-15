-- ============================================
-- ADD ARMOUR EXPIRATION TO USER_INVENTORY
-- Run this in your Supabase SQL Editor
-- ============================================

-- Add expires_at column to user_inventory table for armour expiration (2 weeks)
ALTER TABLE user_inventory 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Create an index for faster queries on expired items
CREATE INDEX IF NOT EXISTS idx_user_inventory_expires_at 
ON user_inventory(expires_at) 
WHERE expires_at IS NOT NULL;

-- Verify column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_inventory' 
AND column_name = 'expires_at';

