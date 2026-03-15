-- ============================================
-- COMPLETE DATABASE SETUP FOR TEAM3D TRACKER
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  display_name TEXT, -- Custom name set by others (if null, shows username)
  name_changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Who changed the name
  is_admin BOOLEAN DEFAULT FALSE, -- Admin role
  first_completed_all_tasks_at TIMESTAMP WITH TIME ZONE, -- When user first completed all 10 tasks (elite status)
  avatar_level INTEGER DEFAULT 0,
  lifetime_exp INTEGER DEFAULT 0,
  gold INTEGER DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  reward TEXT, -- Optional reward for completing the task
  is_done BOOLEAN DEFAULT FALSE,
  task_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create friend_requests table
CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(sender_id, receiver_id)
);

-- 4. Create shop_items table
CREATE TABLE IF NOT EXISTS shop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('armour', 'weapon', 'potion', 'clothes')),
  cost INTEGER NOT NULL,
  effect JSONB NOT NULL
);

-- 5. Create user_inventory table
CREATE TABLE IF NOT EXISTS user_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  UNIQUE(user_id, item_id)
);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_inventory ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Anyone can view all profiles" ON profiles;
CREATE POLICY "Anyone can view all profiles" ON profiles
  FOR SELECT USING (true);

-- Tasks policies
DROP POLICY IF EXISTS "Users can manage own tasks" ON tasks;
CREATE POLICY "Users can manage own tasks" ON tasks
  FOR ALL USING (auth.uid() = user_id);

-- Friend requests policies
DROP POLICY IF EXISTS "Users can view own friend requests" ON friend_requests;
CREATE POLICY "Users can view own friend requests" ON friend_requests
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can create friend requests" ON friend_requests;
CREATE POLICY "Users can create friend requests" ON friend_requests
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can update own friend requests" ON friend_requests;
CREATE POLICY "Users can update own friend requests" ON friend_requests
  FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Shop items policies (public read)
DROP POLICY IF EXISTS "Anyone can view shop items" ON shop_items;
CREATE POLICY "Anyone can view shop items" ON shop_items
  FOR SELECT USING (true);

-- User inventory policies
DROP POLICY IF EXISTS "Users can view own inventory" ON user_inventory;
CREATE POLICY "Users can view own inventory" ON user_inventory
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own inventory" ON user_inventory;
CREATE POLICY "Users can manage own inventory" ON user_inventory
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- OPTIONAL: Populate shop items
-- ============================================

INSERT INTO shop_items (name, type, cost, effect) VALUES
  ('Wooden Sword', 'weapon', 50, '{"description": "Deals 10 EXP damage", "damage": 10}'),
  ('Iron Sword', 'weapon', 150, '{"description": "Deals 25 EXP damage", "damage": 25}'),
  ('Diamond Sword', 'weapon', 300, '{"description": "Deals 50 EXP damage", "damage": 50}'),
  ('Leather Armour', 'armour', 100, '{"description": "Blocks 5 EXP damage per attack", "protection": 5}'),
  ('Iron Armour', 'armour', 250, '{"description": "Blocks 15 EXP damage per attack", "protection": 15}'),
  ('Diamond Armour', 'armour', 500, '{"description": "Blocks 30 EXP damage per attack", "protection": 30}'),
  ('Health Potion', 'potion', 75, '{"description": "24h immunity from attacks"}'),
  ('Super Potion', 'potion', 200, '{"description": "48h immunity from attacks"}'),
  ('Cool Hat', 'clothes', 25, '{"description": "Cosmetic item"}'),
  ('Epic Cape', 'clothes', 100, '{"description": "Fancy cosmetic item"}'),
  ('Name Change Scroll', 'name_change', 500, '{"description": "Change someone else''s displayed name"}'),
  ('Name Restore Scroll', 'name_restore', 200, '{"description": "Restore your own name back to original"}')
ON CONFLICT DO NOTHING;

