-- ============================================
-- ADD ACHIEVEMENTS SYSTEM
-- Run this in your Supabase SQL Editor
-- ============================================
-- This script creates:
-- 1. achievements table - defines all available achievements
-- 2. user_achievements table - tracks which users have unlocked which achievements
-- 3. Functions to check and unlock achievements
-- 4. Initial achievement data

-- ============================================
-- Step 1: Create achievements table
-- ============================================
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- Unique identifier (e.g., 'first_task', 'exp_1000')
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('tasks', 'exp', 'combat', 'social', 'shop', 'streak', 'special')),
  icon TEXT NOT NULL, -- Emoji or icon identifier
  rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  requirement_value INTEGER, -- Numeric requirement (e.g., 100 tasks, 1000 EXP)
  requirement_type TEXT, -- Type of requirement (e.g., 'task_count', 'exp_total', 'attack_count')
  reward_gold INTEGER DEFAULT 0,
  reward_exp INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Step 2: Create user_achievements table
-- ============================================
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- ============================================
-- Step 3: Add indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON user_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_achievements_code ON achievements(code);
CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category);

-- ============================================
-- Step 4: Enable RLS
-- ============================================
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- Achievements are public (anyone can view)
DROP POLICY IF EXISTS "Anyone can view achievements" ON achievements;
CREATE POLICY "Anyone can view achievements" ON achievements
  FOR SELECT USING (true);

-- Users can view their own achievements
DROP POLICY IF EXISTS "Users can view own achievements" ON user_achievements;
CREATE POLICY "Users can view own achievements" ON user_achievements
  FOR SELECT USING (auth.uid() = user_id);

-- Anyone can view user achievements (for leaderboard/profile display)
DROP POLICY IF EXISTS "Anyone can view user achievements" ON user_achievements;
CREATE POLICY "Anyone can view user achievements" ON user_achievements
  FOR SELECT USING (true);

-- ============================================
-- Step 5: Function to unlock achievement
-- ============================================
CREATE OR REPLACE FUNCTION unlock_achievement(
  user_id_param UUID,
  achievement_code_param TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  achievement_record achievements%ROWTYPE;
  already_unlocked BOOLEAN;
  reward_gold_val INTEGER;
  reward_exp_val INTEGER;
BEGIN
  -- Get achievement by code
  SELECT * INTO achievement_record
  FROM achievements
  WHERE code = achievement_code_param;
  
  -- Check if achievement exists
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check if already unlocked
  SELECT EXISTS(
    SELECT 1 FROM user_achievements
    WHERE user_id = user_id_param
    AND achievement_id = achievement_record.id
  ) INTO already_unlocked;
  
  IF already_unlocked THEN
    RETURN FALSE; -- Already unlocked
  END IF;
  
  -- Unlock the achievement
  INSERT INTO user_achievements (user_id, achievement_id)
  VALUES (user_id_param, achievement_record.id)
  ON CONFLICT (user_id, achievement_id) DO NOTHING;
  
  -- Award rewards if any
  reward_gold_val := COALESCE(achievement_record.reward_gold, 0);
  reward_exp_val := COALESCE(achievement_record.reward_exp, 0);
  
  IF reward_gold_val > 0 OR reward_exp_val > 0 THEN
    UPDATE profiles
    SET 
      gold = gold + reward_gold_val,
      lifetime_exp = lifetime_exp + reward_exp_val
    WHERE id = user_id_param;
  END IF;
  
  RETURN TRUE; -- Successfully unlocked
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION unlock_achievement(UUID, TEXT) TO authenticated;

-- ============================================
-- Step 6: Insert initial achievements
-- ============================================

-- Task Achievements
INSERT INTO achievements (code, name, description, category, icon, rarity, requirement_value, requirement_type, reward_gold, reward_exp) VALUES
  ('first_task', 'First Steps', 'Complete your first task', 'tasks', '🎯', 'common', 1, 'task_count', 10, 5),
  ('task_10', 'Getting Started', 'Complete 10 tasks total', 'tasks', '⭐', 'common', 10, 'task_count', 25, 10),
  ('task_50', 'Task Master', 'Complete 50 tasks total', 'tasks', '🌟', 'rare', 50, 'task_count', 50, 25),
  ('task_100', 'Centurion', 'Complete 100 tasks total', 'tasks', '💫', 'rare', 100, 'task_count', 100, 50),
  ('task_500', 'Task Legend', 'Complete 500 tasks total', 'tasks', '🔥', 'epic', 500, 'task_count', 250, 100),
  ('task_1000', 'Immortal Tasker', 'Complete 1000 tasks total', 'tasks', '👑', 'legendary', 1000, 'task_count', 500, 200),
  ('daily_10', 'Perfect Day', 'Complete all 10 tasks in one day', 'tasks', '✨', 'epic', 10, 'daily_task_count', 100, 50),
  ('daily_10_week', 'Week Warrior', 'Complete all 10 tasks for 7 days straight', 'tasks', '⚡', 'legendary', 7, 'daily_10_streak', 500, 250);

-- EXP Achievements
INSERT INTO achievements (code, name, description, category, icon, rarity, requirement_value, requirement_type, reward_gold, reward_exp) VALUES
  ('exp_100', 'Rising Star', 'Reach 100 lifetime EXP', 'exp', '⭐', 'common', 100, 'exp_total', 20, 10),
  ('exp_500', 'Experienced', 'Reach 500 lifetime EXP', 'exp', '🌟', 'common', 500, 'exp_total', 50, 25),
  ('exp_1000', 'Veteran', 'Reach 1,000 lifetime EXP', 'exp', '💫', 'rare', 1000, 'exp_total', 100, 50),
  ('exp_5000', 'Elite Warrior', 'Reach 5,000 lifetime EXP', 'exp', '🔥', 'epic', 5000, 'exp_total', 250, 100),
  ('exp_10000', 'Master', 'Reach 10,000 lifetime EXP', 'exp', '👑', 'legendary', 10000, 'exp_total', 500, 200),
  ('exp_50000', 'Living Legend', 'Reach 50,000 lifetime EXP', 'exp', '🌌', 'legendary', 50000, 'exp_total', 1000, 500);

-- Combat Achievements
INSERT INTO achievements (code, name, description, category, icon, rarity, requirement_value, requirement_type, reward_gold, reward_exp) VALUES
  ('first_attack', 'First Strike', 'Attack another player for the first time', 'combat', '⚔️', 'common', 1, 'attack_count', 15, 5),
  ('attack_10', 'Aggressor', 'Attack 10 different players', 'combat', '🗡️', 'common', 10, 'attack_count', 30, 15),
  ('attack_50', 'Warrior', 'Attack 50 different players', 'combat', '⚡', 'rare', 50, 'attack_count', 75, 35),
  ('attack_100', 'Destroyer', 'Attack 100 different players', 'combat', '💀', 'epic', 100, 'attack_count', 150, 75),
  ('survive_10', 'Survivor', 'Survive 10 attacks from other players', 'combat', '🛡️', 'rare', 10, 'defense_count', 50, 25),
  ('survive_50', 'Tank', 'Survive 50 attacks from other players', 'combat', '🏰', 'epic', 50, 'defense_count', 150, 75);

-- Social Achievements
INSERT INTO achievements (code, name, description, category, icon, rarity, requirement_value, requirement_type, reward_gold, reward_exp) VALUES
  ('first_friend', 'Social Butterfly', 'Add your first friend', 'social', '👥', 'common', 1, 'friend_count', 20, 10),
  ('friend_5', 'Popular', 'Add 5 friends', 'social', '🌟', 'common', 5, 'friend_count', 40, 20),
  ('friend_10', 'Influencer', 'Add 10 friends', 'social', '💫', 'rare', 10, 'friend_count', 75, 35),
  ('friend_25', 'Celebrity', 'Add 25 friends', 'social', '👑', 'epic', 25, 'friend_count', 150, 75);

-- Shop Achievements
INSERT INTO achievements (code, name, description, category, icon, rarity, requirement_value, requirement_type, reward_gold, reward_exp) VALUES
  ('first_purchase', 'Shopper', 'Make your first purchase', 'shop', '🛒', 'common', 1, 'purchase_count', 25, 10),
  ('purchase_10', 'Customer', 'Make 10 purchases', 'shop', '💎', 'common', 10, 'purchase_count', 50, 25),
  ('purchase_50', 'Big Spender', 'Make 50 purchases', 'shop', '💰', 'rare', 50, 'purchase_count', 100, 50),
  ('purchase_100', 'Tycoon', 'Make 100 purchases', 'shop', '🏆', 'epic', 100, 'purchase_count', 200, 100),
  ('collect_all_weapons', 'Arsenal', 'Own all weapon types', 'shop', '⚔️', 'epic', 3, 'weapon_types', 150, 75),
  ('collect_all_armour', 'Fortress', 'Own all armour types', 'shop', '🛡️', 'epic', 3, 'armour_types', 150, 75);

-- Streak Achievements
INSERT INTO achievements (code, name, description, category, icon, rarity, requirement_value, requirement_type, reward_gold, reward_exp) VALUES
  ('streak_3', 'On Fire', '3 day login streak', 'streak', '🔥', 'common', 3, 'login_streak', 30, 15),
  ('streak_7', 'Week Warrior', '7 day login streak', 'streak', '⭐', 'rare', 7, 'login_streak', 75, 35),
  ('streak_30', 'Dedicated', '30 day login streak', 'streak', '💫', 'epic', 30, 'login_streak', 200, 100),
  ('streak_100', 'Unstoppable', '100 day login streak', 'streak', '👑', 'legendary', 100, 'login_streak', 500, 250);

-- Special Achievements
INSERT INTO achievements (code, name, description, category, icon, rarity, requirement_value, requirement_type, reward_gold, reward_exp) VALUES
  ('elite_status', 'Elite', 'Achieve Elite status (complete all 10 tasks in one day)', 'special', '💎', 'epic', 1, 'elite_status', 200, 100),
  ('first_place_daily', 'Daily Champion', 'Reach #1 on daily leaderboard', 'special', '🥇', 'rare', 1, 'daily_rank', 100, 50),
  ('first_place_lifetime', 'Lifetime Legend', 'Reach #1 on lifetime leaderboard', 'special', '👑', 'legendary', 1, 'lifetime_rank', 500, 250),
  ('early_adopter', 'Pioneer', 'Join within first 100 users', 'special', '🚀', 'rare', 100, 'user_rank', 150, 75);

-- ============================================
-- Step 7: Verify achievements were created
-- ============================================
SELECT 
  code,
  name,
  category,
  rarity,
  COUNT(*) OVER (PARTITION BY category) as category_count
FROM achievements
ORDER BY category, rarity, requirement_value;

