# Troubleshooting: "Database error saving new user"

If you're getting this error when trying to sign up, follow these steps:

## Step 1: Check if the profiles table exists

1. Go to your Supabase Dashboard
2. Click on "Table Editor" in the left sidebar
3. Look for a table called `profiles`

**If the table doesn't exist:**
- Go to "SQL Editor" in Supabase
- Copy and paste the entire contents of `database-setup.sql`
- Click "Run"
- Try signing up again

## Step 2: Check Row Level Security (RLS) Policies

1. In Supabase Dashboard, go to "Table Editor"
2. Click on the `profiles` table
3. Click on the "Policies" tab (or look for RLS settings)
4. Make sure you see a policy called "Users can insert own profile"

**If the policy doesn't exist:**
- Go to "SQL Editor"
- Run this SQL:

```sql
-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create the insert policy
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
```

## Step 3: Check the exact error message

The app should now show a more detailed error message. Look for:
- "Database table not found" → Run the database setup SQL
- "Permission denied" → Fix RLS policies (Step 2)
- "Foreign key constraint failed" → This is rare, but means auth.users and profiles aren't linked correctly

## Step 4: Verify your database setup

Run this SQL in Supabase SQL Editor to check if everything is set up:

```sql
-- Check if profiles table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'profiles'
);

-- Check RLS policies on profiles
SELECT * FROM pg_policies WHERE tablename = 'profiles';
```

## Step 5: Temporary fix (for testing only)

If you just want to test and don't care about security for now, you can temporarily disable RLS:

```sql
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
```

**⚠️ WARNING: Only do this for testing! Re-enable RLS before going to production.**

## Still having issues?

1. Open your browser's Developer Console (F12)
2. Try signing up again
3. Look at the Console tab for detailed error messages
4. Share the exact error message you see

