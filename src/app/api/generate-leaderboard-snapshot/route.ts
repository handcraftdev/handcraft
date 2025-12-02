'use server';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { SeasonalChampionshipRepository } from '@/repositories';
import { createSupabaseServerClient } from '@/utils/supabase';

/**
 * POST endpoint to manually generate a leaderboard snapshot
 */
export async function POST(_request: NextRequest) {
  try {
    // Get session to verify authentication
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Create repository instance
    const repository = new SeasonalChampionshipRepository();

    // Get current season
    const currentSeason = await repository.getCurrentSeason();

    if (!currentSeason) {
      return NextResponse.json({
        success: false,
        message: 'No active season found'
      });
    }

    // First attempt to use the repository method to create the snapshot
    let success = false;
    try {
      success = await repository.createLeaderboardSnapshot(currentSeason.id);
    } catch (_repositoryError) {
      // Error using repository to create leaderboard snapshot

      // If that fails, try a direct SQL approach
      try {
        const supabase = createSupabaseServerClient();

        // Get player season stats for this season
        const { data: playerStats, error: statsError } = await supabase
          .from('player_season_stats')
          .select('player_id, points')
          .eq('season_id', currentSeason.id)
          .eq('has_entry_ticket', true)
          .order('points', { ascending: false });

        if (statsError) {
          console.error('Error fetching player stats for leaderboard:', statsError);
          throw statsError;
        }

        // Calculate tier and rank for each player
        if (playerStats && playerStats.length > 0) {
          // First, delete existing entries for this snapshot date
          const now = new Date().toISOString();

          await supabase
            .from('leaderboard_entries')
            .delete()
            .eq('season_id', currentSeason.id)
            .eq('snapshot_date', now);

          // Now insert new entries
          for (let i = 0; i < playerStats.length; i++) {
            const rank = i + 1;
            const points = playerStats[i].points;
            const playerId = playerStats[i].player_id;

            // Calculate tier based on points
            let tier = 'bronze';
            if (points >= 1000) {
              tier = 'diamond';
            } else if (points >= 501) {
              tier = 'platinum';
            } else if (points >= 251) {
              tier = 'gold';
            } else if (points >= 101) {
              tier = 'silver';
            }

            // Insert leaderboard entry
            const { error: insertError } = await supabase
              .from('leaderboard_entries')
              .insert({
                season_id: currentSeason.id,
                player_id: playerId,
                rank,
                points,
                tier,
                snapshot_date: now
              });

            if (insertError) {
              console.error(`Error inserting leaderboard entry for player ${playerId}:`, insertError);
            }
          }

          success = true;
        }
      } catch (_directError) {
        // Error using direct SQL to create leaderboard snapshot
        success = false;
      }
    }

    return NextResponse.json({
      success,
      message: success ? 'Leaderboard snapshot generated successfully' : 'Failed to generate leaderboard snapshot'
    });
  } catch (error) {
    // Error in generate-leaderboard-snapshot API route
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}