-- ============================================
-- ADD DIPS AND BENT OVER ROW CORE LIFTS
--
-- Adds 1RM / 5RM / 10RM leaderboards for Dips and Bent Over Row,
-- matching the existing squat/bench/deadlift/ohp pattern.
-- ============================================

INSERT INTO core_lifts (id, exercise, variant, display_name, unit, sort_order) VALUES
  ('dips_1rm',  'dips', '1rm',  '1 Rep Max',  'weight', 1),
  ('dips_5rm',  'dips', '5rm',  '5 Rep Max',  'weight', 2),
  ('dips_10rm', 'dips', '10rm', '10 Rep Max', 'weight', 3),
  ('row_1rm',   'row',  '1rm',  '1 Rep Max',  'weight', 1),
  ('row_5rm',   'row',  '5rm',  '5 Rep Max',  'weight', 2),
  ('row_10rm',  'row',  '10rm', '10 Rep Max', 'weight', 3)
ON CONFLICT (id) DO NOTHING;
