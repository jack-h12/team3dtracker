-- ============================================
-- ADD BIRTH DATE TO LIFT PROFILES
--
-- Needed to compute age, which feeds max HR (220 - age) and VO2 max
-- (max HR / RHR * 15.3) used by the composite strength × endurance score.
-- ============================================

ALTER TABLE lift_profiles
  ADD COLUMN IF NOT EXISTS birth_date DATE
    CHECK (birth_date IS NULL OR (birth_date > '1900-01-01' AND birth_date < CURRENT_DATE));
