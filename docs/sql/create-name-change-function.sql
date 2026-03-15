-- ============================================
-- CREATE NAME CHANGE FUNCTION
-- This function bypasses RLS to allow name changes
-- Run this in your Supabase SQL Editor
-- ============================================

-- Create function to change display name (bypasses RLS)
CREATE OR REPLACE FUNCTION change_display_name(
  target_user_id UUID,
  new_display_name TEXT,
  changed_by_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET 
    display_name = new_display_name,
    name_changed_by = changed_by_user_id
  WHERE id = target_user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION change_display_name(UUID, TEXT, UUID) TO authenticated;

-- Create function to restore display name (bypasses RLS)
CREATE OR REPLACE FUNCTION restore_display_name(
  user_id_to_restore UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET 
    display_name = NULL,
    name_changed_by = NULL
  WHERE id = user_id_to_restore;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION restore_display_name(UUID) TO authenticated;

