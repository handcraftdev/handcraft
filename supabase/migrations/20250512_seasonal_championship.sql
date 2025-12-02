-- Create Seasons table
CREATE TABLE IF NOT EXISTS seasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'upcoming', -- 'upcoming', 'active', 'completed'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Function to update the updated_at timestamp automatically for seasons
CREATE OR REPLACE FUNCTION update_seasons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update the updated_at column on row update for seasons
CREATE TRIGGER update_seasons_updated_at
BEFORE UPDATE ON seasons
FOR EACH ROW
EXECUTE FUNCTION update_seasons_updated_at();

-- Create PlayerSeasonStats table
CREATE TABLE IF NOT EXISTS player_season_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 0,
  games_played INTEGER NOT NULL DEFAULT 0,
  games_won INTEGER NOT NULL DEFAULT 0,
  win_streak INTEGER NOT NULL DEFAULT 0,
  participation_days INTEGER NOT NULL DEFAULT 0,
  last_played_date TIMESTAMPTZ,
  has_entry_ticket BOOLEAN NOT NULL DEFAULT FALSE,
  reserve_energy INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(player_id, season_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS player_season_stats_player_id_idx ON player_season_stats(player_id);
CREATE INDEX IF NOT EXISTS player_season_stats_season_id_idx ON player_season_stats(season_id);

-- Function to update the updated_at timestamp automatically for player_season_stats
CREATE OR REPLACE FUNCTION update_player_season_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update the updated_at column on row update for player_season_stats
CREATE TRIGGER update_player_season_stats_updated_at
BEFORE UPDATE ON player_season_stats
FOR EACH ROW
EXECUTE FUNCTION update_player_season_stats_updated_at();

-- Create LeaderboardEntries table
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  tier VARCHAR(20) NOT NULL, -- 'bronze', 'silver', 'gold', 'platinum', 'diamond'
  snapshot_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(season_id, player_id, snapshot_date)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS leaderboard_entries_season_id_idx ON leaderboard_entries(season_id);
CREATE INDEX IF NOT EXISTS leaderboard_entries_player_id_idx ON leaderboard_entries(player_id);
CREATE INDEX IF NOT EXISTS leaderboard_entries_snapshot_date_idx ON leaderboard_entries(snapshot_date);

-- Create SeasonRewards table
CREATE TABLE IF NOT EXISTS season_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rank INTEGER,
  tier VARCHAR(20) NOT NULL, -- 'bronze', 'silver', 'gold', 'platinum', 'diamond'
  rewards_distributed BOOLEAN NOT NULL DEFAULT FALSE,
  distribution_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(season_id, player_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS season_rewards_season_id_idx ON season_rewards(season_id);
CREATE INDEX IF NOT EXISTS season_rewards_player_id_idx ON season_rewards(player_id);

-- Function to update the updated_at timestamp automatically for season_rewards
CREATE OR REPLACE FUNCTION update_season_rewards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update the updated_at column on row update for season_rewards
CREATE TRIGGER update_season_rewards_updated_at
BEFORE UPDATE ON season_rewards
FOR EACH ROW
EXECUTE FUNCTION update_season_rewards_updated_at();

-- Create SeasonTransactions table
CREATE TABLE IF NOT EXISTS season_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL, -- 'entry_ticket', 'reserve_energy_small', 'reserve_energy_medium', 'reserve_energy_large'
  amount INTEGER NOT NULL DEFAULT 1,
  essence_cost JSONB NOT NULL, -- {"rock": 15, "paper": 15, "scissors": 15}
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS season_transactions_player_id_idx ON season_transactions(player_id);
CREATE INDEX IF NOT EXISTS season_transactions_season_id_idx ON season_transactions(season_id);

-- Create RLS (Row Level Security) policies
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_season_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_transactions ENABLE ROW LEVEL SECURITY;

-- Seasons table policies
CREATE POLICY seasons_select_policy ON seasons
  FOR SELECT
  USING (true); -- All authenticated users can view seasons

-- Player Season Stats policies
CREATE POLICY player_season_stats_select_policy ON player_season_stats
  FOR SELECT
  USING (auth.uid() = player_id OR auth.uid() IN (SELECT player_id FROM player_season_stats WHERE has_entry_ticket = true));

CREATE POLICY player_season_stats_update_policy ON player_season_stats
  FOR UPDATE
  USING (auth.uid() = player_id);

CREATE POLICY player_season_stats_insert_policy ON player_season_stats
  FOR INSERT
  WITH CHECK (auth.uid() = player_id);

-- Leaderboard Entries policies
CREATE POLICY leaderboard_entries_select_policy ON leaderboard_entries
  FOR SELECT
  USING (true); -- All authenticated users can view leaderboard

-- Season Rewards policies
CREATE POLICY season_rewards_select_policy ON season_rewards
  FOR SELECT
  USING (auth.uid() = player_id);

-- Season Transactions policies
CREATE POLICY season_transactions_select_policy ON season_transactions
  FOR SELECT
  USING (auth.uid() = player_id);

CREATE POLICY season_transactions_insert_policy ON season_transactions
  FOR INSERT
  WITH CHECK (auth.uid() = player_id);

-- Function to calculate tier based on points
CREATE OR REPLACE FUNCTION calculate_tier(points INTEGER)
RETURNS VARCHAR(20) AS $$
BEGIN
  IF points >= 1000 THEN
    RETURN 'diamond';
  ELSIF points >= 501 THEN
    RETURN 'platinum';
  ELSIF points >= 251 THEN
    RETURN 'gold';
  ELSIF points >= 101 THEN
    RETURN 'silver';
  ELSE
    RETURN 'bronze';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to create a daily snapshot of the leaderboard
CREATE OR REPLACE FUNCTION create_leaderboard_snapshot(season_id_param UUID)
RETURNS VOID AS $$
DECLARE
  player_record RECORD;
  rank_counter INTEGER := 1;
BEGIN
  -- Loop through players ordered by points in descending order
  FOR player_record IN 
    SELECT player_id, points
    FROM player_season_stats
    WHERE season_id = season_id_param AND has_entry_ticket = true
    ORDER BY points DESC
  LOOP
    -- Insert leaderboard entry
    INSERT INTO leaderboard_entries (
      season_id, 
      player_id, 
      rank, 
      points, 
      tier, 
      snapshot_date
    ) VALUES (
      season_id_param,
      player_record.player_id,
      rank_counter,
      player_record.points,
      calculate_tier(player_record.points),
      NOW()
    );
    
    -- Increment rank counter
    rank_counter := rank_counter + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;