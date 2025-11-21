# Team3D Task Tracker

A full-stack web application built with Next.js and Supabase for tracking daily tasks with RPG elements.

## Features

- **Authentication**: Sign up and login with email + password
- **Daily Tasks**: Add up to 10 tasks per day, mark them complete
- **RPG Elements**: 
  - Daily level system (0-10) based on completed tasks
  - Avatar appearance changes with level
  - Lifetime experience points
  - Gold currency system
- **Leaderboards**: 
  - Daily leaderboard (sorted by daily level)
  - Lifetime leaderboard (sorted by lifetime EXP)
  - View other users' profiles and tasks
- **Friend System**: Send, accept, and reject friend requests
- **Shop**: Purchase items (weapons, armour, potions, clothes) with gold
- **Item Effects**: 
  - Weapons can reduce other players' lifetime EXP
  - Potions provide 24h immunity
  - Armour protects from attacks

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **Backend**: Supabase (PostgreSQL database, Authentication, Real-time)
- **Styling**: Minimal inline styles (ready for customization)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Supabase

1. Create a `.env.local` file in the root directory
2. Add your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

You can find these values in your Supabase project settings under "API".

### 3. Set Up Supabase Database

Make sure your Supabase database has the following tables:

#### `profiles` table
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  username TEXT NOT NULL,
  avatar_level INTEGER DEFAULT 0,
  lifetime_exp INTEGER DEFAULT 0,
  gold INTEGER DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### `tasks` table
```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  is_done BOOLEAN DEFAULT FALSE,
  task_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### `friend_requests` table
```sql
CREATE TABLE friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(sender_id, receiver_id)
);
```

#### `shop_items` table
```sql
CREATE TABLE shop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('armour', 'weapon', 'potion', 'clothes')),
  cost INTEGER NOT NULL,
  effect TEXT NOT NULL
);
```

#### `user_inventory` table
```sql
CREATE TABLE user_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  UNIQUE(user_id, item_id)
);
```

### 4. Set Up Row Level Security (RLS)

Enable RLS on all tables and create policies as needed. For development, you can temporarily disable RLS, but for production, set up proper policies:

```sql
-- Example: Allow users to read their own profile
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
```

Repeat for other tables with appropriate policies.

### 5. Populate Shop Items (Optional)

Add some initial shop items:

```sql
INSERT INTO shop_items (name, type, cost, effect) VALUES
  ('Wooden Sword', 'weapon', 50, 'Reduces target EXP by 10'),
  ('Iron Armour', 'armour', 100, 'Protects from attacks'),
  ('Health Potion', 'potion', 75, '24h immunity from attacks'),
  ('Cool Hat', 'clothes', 25, 'Cosmetic item');
```

### 6. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx             # Main app page (handles routing and auth)
│   └── globals.css          # Global styles
├── components/
│   ├── Auth.tsx             # Authentication component
│   ├── Tasks.tsx            # Task management component
│   ├── Avatar.tsx           # Avatar display component
│   ├── Leaderboard.tsx      # Leaderboard component
│   ├── Friends.tsx          # Friend system component
│   └── Shop.tsx             # Shop component
├── lib/
│   ├── supabase.ts          # Supabase client configuration
│   ├── auth.ts              # Authentication utilities
│   ├── tasks.ts             # Task management utilities
│   ├── leaderboard.ts       # Leaderboard utilities
│   ├── friends.ts           # Friend system utilities
│   └── shop.ts              # Shop utilities
└── package.json
```

## How It Works

### Authentication Flow
1. User signs up with email, password, and username
2. Supabase Auth creates the user account
3. A profile is automatically created in the `profiles` table
4. User is logged in and redirected to the main app

### Task System
- Users can add up to 10 tasks per day
- Tasks reset daily at 5pm EST
- Completing a task increases daily level (0-10) and lifetime EXP
- Avatar appearance changes based on daily level

### Daily Reset Logic
- The app checks if tasks should reset (5pm EST) on load and periodically
- When reset time is reached, all tasks are deleted and avatar_level is reset to 0
- Lifetime EXP persists across resets

### Supabase Integration
All components use the Supabase client (`lib/supabase.ts`) to:
- Read/write to database tables
- Listen to real-time updates (can be added)
- Handle authentication state

## Customization

The app uses minimal inline styles. You can:
- Replace inline styles with CSS modules or Tailwind CSS
- Add more sophisticated avatar graphics
- Enhance item effects and combat system
- Add real-time updates using Supabase subscriptions
- Implement the 24h immunity tracking system for potions

## Notes

- Daily task reset happens at 5pm EST (checks on app load and every minute)
- Starting gold is 100 (set in `lib/auth.ts`)
- Weapon attacks reduce target's lifetime EXP by 10
- The app is ready to run once Supabase is configured

## License

MIT

