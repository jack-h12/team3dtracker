-- Daily Notes table
-- Stores private per-day notes for each user.
-- RLS ensures only the owner can read or write their own notes.

CREATE TABLE IF NOT EXISTS daily_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  note_date DATE NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, note_date)
);

ALTER TABLE daily_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own notes" ON daily_notes
  FOR ALL USING (auth.uid() = user_id);

-- Index for fast per-user lookups
CREATE INDEX IF NOT EXISTS idx_daily_notes_user_date ON daily_notes(user_id, note_date);
