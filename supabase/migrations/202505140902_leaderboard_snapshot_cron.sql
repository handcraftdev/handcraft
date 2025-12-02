-- Migration for setting up the leaderboard snapshot cron job
-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to generate leaderboard snapshots for all active seasons
CREATE OR REPLACE FUNCTION public.generate_all_leaderboard_snapshots()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    season_record RECORD;
BEGIN
    -- Get all active seasons
    FOR season_record IN 
        SELECT id FROM seasons WHERE status = 'active'
    LOOP
        -- Call the existing function to create a snapshot for each active season
        PERFORM create_leaderboard_snapshot(season_record.id);
    END LOOP;
    
    -- Log that the job ran
    INSERT INTO scheduled_job_logs (job_name, execution_time, status, message)
    VALUES ('generate_all_leaderboard_snapshots', NOW(), 'completed', 'Generated leaderboard snapshots for all active seasons');
END;
$$;

-- Create a table to log scheduled job executions
CREATE TABLE IF NOT EXISTS public.scheduled_job_logs (
    id BIGSERIAL PRIMARY KEY,
    job_name TEXT NOT NULL,
    execution_time TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL,
    message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add RLS policies for the job logs table
ALTER TABLE public.scheduled_job_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view job logs
CREATE POLICY "Allow authenticated users to view job logs" ON public.scheduled_job_logs
    FOR SELECT USING (auth.role() = 'authenticated');

-- Schedule the job to run every 10 minutes
SELECT cron.schedule(
    'generate-leaderboard-snapshots',      -- Job name
    '*/10 * * * *',                       -- Every 10 minutes (cron expression)
    $$SELECT public.generate_all_leaderboard_snapshots()$$  -- SQL command to execute
);

-- Schedule a more frequent job for development/testing if needed
-- SELECT cron.schedule(
--     'generate-leaderboard-snapshots-frequent',
--     '*/2 * * * *',                       -- Every 2 minutes
--     $$SELECT public.generate_all_leaderboard_snapshots()$$
-- );