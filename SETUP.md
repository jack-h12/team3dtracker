# Quick Setup Guide

## 1. Install Dependencies

```bash
npm install
```

## 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 3. Run Database Setup Scripts

Run these SQL scripts in your Supabase SQL Editor:

### Create Tables

```sql
-- Profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  username TEXT NOT NULL,
  avatar_level INTEGER DEFAULT 0,
  lifetime_exp INTEGER DEFAULT 0,
  gold INTEGER DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  is_done BOOLEAN DEFAULT FALSE,
  task_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Friend requests table
CREATE TABLE friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(sender_id, receiver_id)
);

-- Shop items table
CREATE TABLE shop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('armour', 'weapon', 'potion', 'clothes')),
  cost INTEGER NOT NULL,
  effect TEXT NOT NULL
);

-- User inventory table
CREATE TABLE user_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  UNIQUE(user_id, item_id)
);
```

### Enable Row Level Security (RLS)

For development, you can temporarily disable RLS, but for production, enable it:

```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_inventory ENABLE ROW LEVEL SECURITY;

-- Example policies (adjust as needed for your security requirements)
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view all profiles" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own tasks" ON tasks
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own friend requests" ON friend_requests
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can manage own friend requests" ON friend_requests
  FOR ALL USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Anyone can view shop items" ON shop_items
  FOR SELECT USING (true);

CREATE POLICY "Users can view own inventory" ON user_inventory
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own inventory" ON user_inventory
  FOR ALL USING (auth.uid() = user_id);
```

### Populate Shop Items (Optional)

```sql
INSERT INTO shop_items (name, type, cost, effect) VALUES
  ('Wooden Sword', 'weapon', 50, 'Reduces target EXP by 10'),
  ('Iron Sword', 'weapon', 150, 'Reduces target EXP by 25'),
  ('Iron Armour', 'armour', 100, 'Protects from attacks'),
  ('Steel Armour', 'armour', 250, 'Strong protection from attacks'),
  ('Health Potion', 'potion', 75, '24h immunity from attacks'),
  ('Super Potion', 'potion', 200, '48h immunity from attacks'),
  ('Cool Hat', 'clothes', 25, 'Cosmetic item'),
  ('Epic Cape', 'clothes', 100, 'Fancy cosmetic item');
```

## 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features Overview

- **Authentication**: Sign up/login with email + password
- **Tasks**: Add up to 10 daily tasks, mark them complete
- **Level System**: Daily level (0-10) based on completed tasks, lifetime EXP
- **Avatar**: Changes appearance based on daily level
- **Leaderboards**: Daily and lifetime rankings
- **Friends**: Send/accept/reject friend requests
- **Shop**: Buy items with gold, use weapons to attack, potions for immunity

## Daily Reset

Tasks reset automatically at 5pm EST. The app checks for reset on load and every minute.

