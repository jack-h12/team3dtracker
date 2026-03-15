# Achievements System Setup Guide

## Overview

The Achievements System adds gamification to your task tracker app with:
- **40+ achievements** across 7 categories (Tasks, EXP, Combat, Social, Shop, Streak, Special)
- **4 rarity tiers** (Common, Rare, Epic, Legendary)
- **Rewards** (Gold and EXP bonuses)
- **Beautiful UI** with achievement gallery and progress tracking
- **Automatic unlocking** when requirements are met

## Setup Instructions

### Step 1: Run the SQL Script

1. Open your Supabase Dashboard
2. Go to SQL Editor
3. Run the contents of `add-achievements-system.sql`

This will create:
- `achievements` table - All available achievements
- `user_achievements` table - Tracks which users have unlocked which achievements
- `unlock_achievement()` function - Handles unlocking achievements and awarding rewards
- Initial achievement data (40+ achievements)

### Step 2: Verify Setup

After running the SQL, verify the tables were created:

```sql
-- Check achievements were created
SELECT COUNT(*) FROM achievements;

-- Check function exists
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'unlock_achievement';
```

You should see:
- ~40 achievements in the achievements table
- The `unlock_achievement` function listed

### Step 3: Test the System

1. Complete a task - this should automatically check for achievements
2. Navigate to the "Achievements" tab in the app
3. You should see your unlocked achievements highlighted

## Achievement Categories

### Tasks (8 achievements)
- First task completion
- Milestones: 10, 50, 100, 500, 1000 tasks
- Perfect day (all 10 tasks)
- Week warrior (7 perfect days)

### EXP (6 achievements)
- Milestones: 100, 500, 1K, 5K, 10K, 50K lifetime EXP

### Combat (6 achievements)
- First attack
- Attack milestones: 10, 50, 100 players
- Defense milestones: Survive 10, 50 attacks

### Social (4 achievements)
- Friend milestones: 1, 5, 10, 25 friends

### Shop (6 achievements)
- Purchase milestones: 1, 10, 50, 100 purchases
- Collect all weapons
- Collect all armour

### Streak (4 achievements)
- Login streaks: 3, 7, 30, 100 days

### Special (4 achievements)
- Elite status
- #1 on daily leaderboard
- #1 on lifetime leaderboard
- Early adopter

## How It Works

### Automatic Unlocking

Achievements are automatically checked when:
- **Task completion** - Checks task and EXP achievements
- **Friend added** - Checks social achievements (to be implemented)
- **Purchase made** - Checks shop achievements (to be implemented)
- **Attack performed** - Checks combat achievements (to be implemented)

### Manual Unlocking

You can manually unlock achievements using the database function:

```sql
SELECT unlock_achievement('user-id-here', 'achievement-code');
```

For example:
```sql
SELECT unlock_achievement('123e4567-e89b-12d3-a456-426614174000', 'first_task');
```

### Notifications

When achievements are unlocked:
1. They're stored in `localStorage` as `pending_achievements`
2. The Achievements component checks for pending achievements on load
3. A notification modal appears showing the unlocked achievement(s)
4. The achievement gallery updates to show the new unlock

## Customization

### Adding New Achievements

Add achievements to the `achievements` table:

```sql
INSERT INTO achievements (code, name, description, category, icon, rarity, requirement_value, requirement_type, reward_gold, reward_exp)
VALUES (
  'custom_achievement',           -- Unique code
  'Custom Achievement',            -- Display name
  'Do something special',          -- Description
  'special',                       -- Category
  '🎯',                            -- Icon (emoji)
  'epic',                          -- Rarity
  100,                             -- Requirement value
  'custom_type',                   -- Requirement type
  50,                              -- Gold reward
  25                               -- EXP reward
);
```

### Checking Achievements in Code

Use the utility functions in `lib/achievements.ts`:

```typescript
import { checkTaskAchievements, checkExpAchievements } from '@/lib/achievements'

// Check achievements after task completion
const unlocked = await checkTaskAchievements(userId, totalTasks, dailyTasks)
```

### Displaying Achievements

The `Achievements` component automatically:
- Shows all achievements in a grid
- Highlights unlocked achievements
- Shows locked achievements with reduced opacity
- Displays rarity colors and badges
- Shows reward information

## Future Enhancements

Potential additions:
- Achievement progress bars
- Achievement statistics dashboard
- Achievement sharing
- Achievement leaderboards
- Seasonal/limited-time achievements
- Achievement sets/collections

## Troubleshooting

### Achievements not unlocking

1. Check the database function exists:
   ```sql
   SELECT * FROM information_schema.routines WHERE routine_name = 'unlock_achievement';
   ```

2. Check RLS policies allow the function to run:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'user_achievements';
   ```

3. Check browser console for errors

### Achievements not showing

1. Verify the component is imported in `app/page.tsx`
2. Check the "Achievements" tab appears in navigation
3. Verify data is loading (check network tab)

### Rewards not being awarded

1. Check the `unlock_achievement` function includes reward logic
2. Verify the profile update is working
3. Check RLS policies allow profile updates

## Notes

- Task counting uses an estimation based on lifetime EXP (each task = 5 EXP)
- For more accurate task counting, consider adding a `total_tasks_completed` column to profiles
- Achievement checking is async and non-blocking
- Multiple achievements can unlock simultaneously

