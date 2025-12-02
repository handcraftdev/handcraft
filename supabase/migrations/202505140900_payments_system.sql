-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id),
  payment_type TEXT NOT NULL CHECK (payment_type IN ('energy', 'leagueEntry')),
  tier TEXT CHECK (tier IN ('small', 'medium', 'large')),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add a function to increment reserve energy
-- This function expects reserve_energy as an input parameter
CREATE OR REPLACE FUNCTION increment_reserve_energy(current_energy INTEGER, amount INTEGER)
RETURNS INTEGER
LANGUAGE SQL
AS $$
  SELECT COALESCE(current_energy, 0) + amount;
$$;