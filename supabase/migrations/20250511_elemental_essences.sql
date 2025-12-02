-- Create elemental_essences table to store user's essences
CREATE TABLE IF NOT EXISTS elemental_essences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rock_essence INTEGER NOT NULL DEFAULT 0,
  paper_essence INTEGER NOT NULL DEFAULT 0,
  scissors_essence INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS elemental_essences_user_id_idx ON elemental_essences(user_id);

-- Function to update the updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_elemental_essences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update the updated_at column on row update
CREATE TRIGGER update_elemental_essences_updated_at
BEFORE UPDATE ON elemental_essences
FOR EACH ROW
EXECUTE FUNCTION update_elemental_essences_updated_at();

-- Create RLS (Row Level Security) policies
ALTER TABLE elemental_essences ENABLE ROW LEVEL SECURITY;

-- Policy allowing users to read only their essence data
CREATE POLICY elemental_essences_select_policy ON elemental_essences
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy allowing users to update only their essence data
CREATE POLICY elemental_essences_update_policy ON elemental_essences
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to initialize essences for a new user
CREATE OR REPLACE FUNCTION initialize_user_essences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO elemental_essences (user_id, rock_essence, paper_essence, scissors_essence)
  VALUES (NEW.id, 0, 0, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically create essences entry when a new user is created
CREATE TRIGGER create_user_essences_trigger
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION initialize_user_essences();