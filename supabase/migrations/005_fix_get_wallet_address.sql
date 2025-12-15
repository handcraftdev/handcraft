-- Fix get_wallet_address() to handle native Supabase Web3 auth JWT format
-- Native Web3 auth stores wallet in: user_metadata.custom_claims.address

CREATE OR REPLACE FUNCTION public.get_wallet_address()
RETURNS TEXT AS $$
DECLARE
  jwt_claims jsonb;
  wallet text;
  user_meta_sub text;
BEGIN
  jwt_claims := auth.jwt();

  -- 1. Native Supabase Web3 auth: user_metadata.custom_claims.address
  wallet := jwt_claims -> 'user_metadata' -> 'custom_claims' ->> 'address';
  IF wallet IS NOT NULL AND wallet != '' THEN
    RETURN wallet;
  END IF;

  -- 2. Native Web3 auth alternative: parse from user_metadata.sub (web3:solana:{address})
  user_meta_sub := jwt_claims -> 'user_metadata' ->> 'sub';
  IF user_meta_sub IS NOT NULL AND user_meta_sub LIKE 'web3:solana:%' THEN
    wallet := substring(user_meta_sub from 13); -- Skip 'web3:solana:'
    IF wallet IS NOT NULL AND wallet != '' THEN
      RETURN wallet;
    END IF;
  END IF;

  -- 3. Custom claim at top level (our custom JWT format for local dev)
  wallet := jwt_claims ->> 'wallet_address';
  IF wallet IS NOT NULL AND wallet != '' THEN
    RETURN wallet;
  END IF;

  -- 4. user_metadata.wallet_address (fallback)
  wallet := jwt_claims -> 'user_metadata' ->> 'wallet_address';
  IF wallet IS NOT NULL AND wallet != '' THEN
    RETURN wallet;
  END IF;

  -- 5. Check if sub claim is a wallet (not UUID) - legacy fallback
  wallet := jwt_claims ->> 'sub';
  IF wallet IS NOT NULL AND length(wallet) >= 32 AND length(wallet) <= 44
     AND wallet !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN wallet;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_wallet_address() TO authenticated;
