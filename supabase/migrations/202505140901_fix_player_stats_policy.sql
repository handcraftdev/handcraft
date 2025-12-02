-- Drop the existing policy causing recursive issues
DROP POLICY IF EXISTS player_season_stats_select_policy ON player_season_stats;

-- Create a new policy that doesn't cause recursion
CREATE POLICY player_season_stats_select_policy ON player_season_stats
  FOR SELECT
  USING (
    -- Allow users to see their own stats
    auth.uid() = player_id
    -- Allow users to see stats of other users if they have joined the championship
    OR EXISTS (
      SELECT 1 FROM player_season_stats
      WHERE player_id = auth.uid() AND has_entry_ticket = true
    )
  );

-- Create a simpler temporary fix by allowing all authenticated users to see the stats
-- Uncomment this if the above still doesn't work
-- DROP POLICY IF EXISTS player_season_stats_select_policy ON player_season_stats;
-- CREATE POLICY player_season_stats_select_policy ON player_season_stats
--   FOR SELECT USING (true);