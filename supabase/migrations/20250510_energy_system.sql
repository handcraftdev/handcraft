-- Create energy table to store user energy data
CREATE TABLE IF NOT EXISTS energy (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  energy_amount INTEGER NOT NULL DEFAULT 10,
  last_consumed_at TIMESTAMPTZ DEFAULT NULL,
  last_refreshed_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS energy_user_id_idx ON energy(user_id);

-- Function to update the updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_energy_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update the updated_at column on row update
CREATE TRIGGER update_energy_updated_at
BEFORE UPDATE ON energy
FOR EACH ROW
EXECUTE FUNCTION update_energy_updated_at();

-- Create RLS (Row Level Security) policies
ALTER TABLE energy ENABLE ROW LEVEL SECURITY;

-- Policy allowing users to read only their energy data
CREATE POLICY energy_select_policy ON energy
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy allowing users to update only their energy data
CREATE POLICY energy_update_policy ON energy
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to initialize energy for a new user
CREATE OR REPLACE FUNCTION initialize_user_energy()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO energy (user_id, energy_amount)
  VALUES (NEW.id, 10);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically create energy entry when a new user is created
CREATE TRIGGER create_user_energy_trigger
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION initialize_user_energy();

-- Add energy_replenish_rate in minutes (default 10 minutes per energy point)
ALTER TABLE energy ADD COLUMN IF NOT EXISTS energy_replenish_rate INTEGER NOT NULL DEFAULT 10;
-- Add max_energy to set the maximum amount of energy a user can have
ALTER TABLE energy ADD COLUMN IF NOT EXISTS max_energy INTEGER NOT NULL DEFAULT 10;