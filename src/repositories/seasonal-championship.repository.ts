import { createSupabaseBrowserClient, createSupabaseServerClient } from '@/utils/supabase';

// Debug and logging code removed for production

// Season status
export type SeasonStatus = 'upcoming' | 'active' | 'completed';

// Tier types
export type TierType = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

// Transaction types
export type SeasonTransactionType = 'entry_ticket' | 'reserve_energy_small' | 'reserve_energy_medium' | 'reserve_energy_large';

// Type for essence cost object
export interface EssenceCost {
  rock: number;
  paper: number;
  scissors: number;
}

// Season data
export interface Season {
  id: string;
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  status: SeasonStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Player season stats data
export interface PlayerSeasonStats {
  id: string;
  playerId: string;
  seasonId: string;
  points: number;
  gamesPlayed: number;
  gamesWon: number;
  winStreak: number;
  participationDays: number;
  lastPlayedDate?: Date;
  hasEntryTicket: boolean;
  reserveEnergy: number;
  createdAt: Date;
  updatedAt: Date;
}

// Leaderboard entry data
export interface LeaderboardEntry {
  id: string;
  seasonId: string;
  playerId: string;
  rank: number;
  points: number;
  tier: TierType;
  snapshotDate: Date;
  createdAt: Date;
  playerName?: string; // Joined from users table
}

// Season reward data
export interface SeasonReward {
  id: string;
  seasonId: string;
  playerId: string;
  rank?: number;
  tier: TierType;
  rewardsDistributed: boolean;
  distributionDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Season transaction data
export interface SeasonTransaction {
  id: string;
  playerId: string;
  seasonId: string;
  transactionType: SeasonTransactionType;
  amount: number;
  essenceCost: EssenceCost;
  createdAt: Date;
}

// Season repository class
export class SeasonalChampionshipRepository {
  /**
   * Get current active season
   * @returns The current active season or null if none is active
   */
  async getCurrentSeason(): Promise<Season | null> {
    const supabase = typeof window === 'undefined'
      ? createSupabaseServerClient()
      : createSupabaseBrowserClient();

    try {
      // First, check if the seasons table exists at all
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { data: tablesData, error: tablesError } = await supabase
          .from('seasons')
          .select('id')
          .limit(1);

        if (tablesError) {
          // Table might not exist, let's try a more general approach
          return await this.getAnySeason();
        }
      } catch (_tableCheckError) {
        // Try the fallback approach
        return await this.getAnySeason();
      }

      // Proceed with the normal query if the table exists
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .eq('status', 'active')
        .lte('start_date', now)
        .gte('end_date', now)
        .order('start_date', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        // Error fetching current season with date filter

        // If we couldn't find a season with the date filter, try without it
        // Fetching any active season
        return await this.getActiveSeason();
      }

      if (!data) {
        // No current season found with date filter
        return await this.getActiveSeason();
      }

      // Current season found
      return this.mapSeasonFromDb(data);
    } catch (_error) {
      // Exception in getCurrentSeason
      return null;
    }
  }

  // Helper method to get any active season without date filters
  private async getActiveSeason(): Promise<Season | null> {
    const supabase = typeof window === 'undefined'
      ? createSupabaseServerClient()
      : createSupabaseBrowserClient();

    try {
      // Fetching any active season...
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .eq('status', 'active')
        .limit(1)
        .single();

      if (error) {
        // Error fetching any active season
        return null;
      }

      if (!data) {
        // No active season found
        return null;
      }

      // Found active season
      return this.mapSeasonFromDb(data);
    } catch (_error) {
      // Exception in getActiveSeason
      return null;
    }
  }

  // Fallback method to get any season regardless of status
  private async getAnySeason(): Promise<Season | null> {
    const supabase = typeof window === 'undefined'
      ? createSupabaseServerClient()
      : createSupabaseBrowserClient();

    try {
      // Trying to fetch any season as fallback
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .limit(1)
        .single();

      if (error) {
        // Error fetching any season (fallback)
        return null;
      }

      if (!data) {
        // No seasons found in the database
        return null;
      }

      // Found season (fallback)
      return this.mapSeasonFromDb(data);
    } catch (_error) {
      // Exception in getAnySeason
      return null;
    }
  }
  
  /**
   * Get upcoming seasons
   * @param limit Maximum number of upcoming seasons to return
   * @returns Array of upcoming seasons
   */
  async getUpcomingSeasons(limit: number = 5): Promise<Season[]> {
    const supabase = typeof window === 'undefined'
      ? createSupabaseServerClient()
      : createSupabaseBrowserClient();
    
    try {
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .eq('status', 'upcoming')
        .gt('start_date', now)
        .order('start_date', { ascending: true })
        .limit(limit);
      
      if (error) {
        // Error fetching upcoming seasons
        return [];
      }
      
      if (!data || data.length === 0) {
        return [];
      }

      return data.map(item => this.mapSeasonFromDb(item));
    } catch (_error) {
      // Error in getUpcomingSeasons
      return [];
    }
  }
  
  /**
   * Get past completed seasons
   * @param limit Maximum number of past seasons to return
   * @returns Array of past completed seasons
   */
  async getPastSeasons(limit: number = 5): Promise<Season[]> {
    const supabase = typeof window === 'undefined'
      ? createSupabaseServerClient()
      : createSupabaseBrowserClient();
    
    try {
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .eq('status', 'completed')
        .order('end_date', { ascending: false })
        .limit(limit);
      
      if (error) {
        // Error fetching past seasons
        return [];
      }
      
      if (!data || data.length === 0) {
        return [];
      }

      return data.map(item => this.mapSeasonFromDb(item));
    } catch (_error) {
      // Error in getPastSeasons
      return [];
    }
  }
  
  /**
   * Get a specific season by ID
   * @param seasonId The ID of the season to get
   * @returns The season data or null if not found
   */
  async getSeasonById(seasonId: string): Promise<Season | null> {
    const supabase = typeof window === 'undefined'
      ? createSupabaseServerClient()
      : createSupabaseBrowserClient();
    
    try {
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .eq('id', seasonId)
        .single();
      
      if (error) {
        // Error fetching season by ID
        return null;
      }
      
      if (!data) {
        return null;
      }
      
      return this.mapSeasonFromDb(data);
    } catch (_error) {
      // Error handling without logging
      return null;
    }
  }
  
  /**
   * Get player's stats for a specific season
   * @param playerId The ID of the player
   * @param seasonId The ID of the season
   * @returns The player's season stats or null if not found
   */
  async getPlayerSeasonStats(playerId: string, seasonId: string): Promise<PlayerSeasonStats | null> {
    // Direct database query to avoid recursion
    const supabase = typeof window === 'undefined'
      ? createSupabaseServerClient()
      : createSupabaseBrowserClient();

    try {
      // First try to get existing stats directly from database
      const { data, error } = await supabase
        .from('player_season_stats')
        .select('*')
        .eq('player_id', playerId)
        .eq('season_id', seasonId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No data found
          // No player stats found, returning default object
          // Return default object instead of creating one to avoid recursion
          return {
            id: 'pending', // Temporary ID
            playerId: playerId,
            seasonId: seasonId,
            points: 0,
            gamesPlayed: 0,
            gamesWon: 0,
            winStreak: 0,
            participationDays: 0,
            hasEntryTicket: false,
            reserveEnergy: 0,
            createdAt: new Date(),
            updatedAt: new Date()
          };
        } else {
          // Error fetching player stats
          return null;
        }
      }

      // Map the data to our model
      return this.mapPlayerSeasonStatsFromDb(data);
    } catch (_error) {
      // Error in getPlayerSeasonStats

      // Default fallback object
      return {
        id: 'pending', // Temporary ID
        playerId: playerId,
        seasonId: seasonId,
        points: 0,
        gamesPlayed: 0,
        gamesWon: 0,
        winStreak: 0,
        participationDays: 0,
        hasEntryTicket: false,
        reserveEnergy: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
  }
  
  /**
   * Get player's stats for the current active season
   * @param playerId The ID of the player
   * @returns The player's current season stats or null if not found
   */
  async getPlayerCurrentSeasonStats(playerId: string): Promise<PlayerSeasonStats | null> {
    try {
      // Get current season first
      const currentSeason = await this.getCurrentSeason();
      
      if (!currentSeason) {
        return null;
      }
      
      // Get player stats for this season
      return await this.getPlayerSeasonStats(playerId, currentSeason.id);
    } catch (_error) {
      // Error handling without logging
      return null;
    }
  }
  
  /**
   * Create or update player stats for a season
   * @param playerId The ID of the player
   * @param seasonId The ID of the season
   * @param hasEntryTicket Whether the player has purchased an entry ticket
   * @param reserveEnergy Amount of reserve energy (optional)
   * @returns Success flag and the updated stats
   */
  async createOrUpdatePlayerSeasonStats(
    playerId: string,
    seasonId: string,
    hasEntryTicket: boolean = false,
    reserveEnergy: number = 0
  ): Promise<{
    success: boolean;
    stats: PlayerSeasonStats | null;
  }> {
    const supabase = typeof window === 'undefined'
      ? createSupabaseServerClient()
      : createSupabaseBrowserClient();
    
    try {
      // Check if stats already exist directly in the database to avoid recursion
      const { data: existingData, error: existingError } = await supabase
        .from('player_season_stats')
        .select('*')
        .eq('player_id', playerId)
        .eq('season_id', seasonId)
        .single();

      if (!existingError && existingData) {
        // Update existing stats
        const { data, error } = await supabase
          .from('player_season_stats')
          .update({
            has_entry_ticket: hasEntryTicket,
            reserve_energy: reserveEnergy
          })
          .eq('id', existingData.id)
          .select('*')
          .single();

        if (error) {
          // Error handling without logging
          return { success: false, stats: null };
        }

        return {
          success: true,
          stats: this.mapPlayerSeasonStatsFromDb(data)
        };
      } else {
        // Create new stats if doesn't exist or error is PGRST116 (no rows returned)
        const { data, error } = await supabase
          .from('player_season_stats')
          .insert({
            player_id: playerId,
            season_id: seasonId,
            has_entry_ticket: hasEntryTicket,
            reserve_energy: reserveEnergy,
            points: 0,
            games_played: 0,
            games_won: 0,
            win_streak: 0,
            participation_days: 0
          })
          .select('*')
          .single();
        
        if (error) {
          // Error handling without logging
          return { success: false, stats: null };
        }
        
        return {
          success: true,
          stats: this.mapPlayerSeasonStatsFromDb(data)
        };
      }
    } catch (_error) {
      // Error handling without logging
      return { success: false, stats: null };
    }
  }
  
  /**
   * Get current season leaderboard
   * @param limit Maximum number of entries to return
   * @param offset Pagination offset
   * @returns Array of leaderboard entries
   */
  async getCurrentSeasonLeaderboard(
    limit: number = 10,
    offset: number = 0
  ): Promise<LeaderboardEntry[]> {
    try {
      // Get current season first
      const currentSeason = await this.getCurrentSeason();
      // Check for current season ID

      if (!currentSeason) {
        // No active season found for leaderboard
        return [];
      }

      try {
        // Get leaderboard for this season
        const leaderboardEntries = await this.getSeasonLeaderboard(currentSeason.id, limit, offset);
        // Fetched leaderboard entries
        
        // If no real entries were found, generate placeholders
        if (leaderboardEntries.length === 0) {
          // No entries found, generating placeholders
          return this.generatePlaceholderLeaderboard(currentSeason.id, limit, offset);
        }
        
        return leaderboardEntries;
      } catch (leaderboardError) {
        // Error handling with logging
        console.error('Error fetching season leaderboard:', leaderboardError);

        // Generate placeholder data to prevent UI from breaking
        // Error occurred, generating placeholders
        return this.generatePlaceholderLeaderboard(currentSeason.id, limit, offset);
      }
    } catch (error) {
      // Error handling with logging
      console.error('Error in getCurrentSeasonLeaderboard:', error);
      return [];
    }
  }
  
  /**
   * Generate placeholder leaderboard data for UI testing and fallbacks
   */
  private generatePlaceholderLeaderboard(
    seasonId: string,
    limit: number = 10,
    offset: number = 0
  ): LeaderboardEntry[] {
    // Generate some placeholder entries
    const placeholders: LeaderboardEntry[] = [];
    for (let i = 1; i <= limit; i++) {
      placeholders.push({
        id: `placeholder-${i}`,
        seasonId: seasonId,
        playerId: `player-${i}`,
        rank: i + offset,
        points: Math.floor(Math.random() * 500),
        tier: this.calculateTier(Math.floor(Math.random() * 500)),
        snapshotDate: new Date(),
        createdAt: new Date(),
        playerName: `Player ${i + offset}`
      });
    }
    // Generated placeholder leaderboard entries
    return placeholders;
  }
  
  /**
   * Get leaderboard for a specific season
   * @param seasonId The ID of the season
   * @param limit Maximum number of entries to return
   * @param offset Pagination offset
   * @returns Array of leaderboard entries
   */
  async getSeasonLeaderboard(
    seasonId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<LeaderboardEntry[]> {
    // Getting season leaderboard
    const supabase = typeof window === 'undefined'
      ? createSupabaseServerClient()
      : createSupabaseBrowserClient();
    
    try {
      // Get the latest snapshot date for this season
      const { data: latestSnapshot, error: snapshotError } = await supabase
        .from('leaderboard_entries')
        .select('snapshot_date')
        .eq('season_id', seasonId)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .single();
      
      if (snapshotError || !latestSnapshot) {
        // No leaderboard snapshot found, using player_season_stats directly
        // If no snapshot exists, use player_season_stats directly
        const { data: statsData, error: statsError } = await supabase
          .from('player_season_stats')
          .select(`
            id,
            player_id,
            season_id,
            points
          `)
          .eq('season_id', seasonId)
          .eq('has_entry_ticket', true)
          .order('points', { ascending: false })
          .range(offset, offset + limit - 1);
          
        // Get player IDs to look up usernames
        let playerNames: Record<string, string> = {};
        if (statsData && statsData.length > 0) {
          // Extract player IDs
          const playerIds = statsData.map(stat => stat.player_id);
          
          // Get usernames for these players
          const { data: usersData } = await supabase
            .from('users')
            .select('id, username')
            .in('id', playerIds);
            
          // Create a mapping of player IDs to usernames
          if (usersData) {
            playerNames = usersData.reduce((acc, user) => {
              acc[user.id] = user.username || `Player ${Object.keys(acc).length + 1}`;
              return acc;
            }, {} as Record<string, string>);
          }
        }
        
        if (statsError) {
          // Error fetching player stats for leaderboard
          return [];
        }
        
        if (!statsData || statsData.length === 0) {
          // No player stats found for leaderboard
          return [];
        }
        
        // Found player stats for leaderboard
        
        // Calculate tier and rank for each player
        return statsData.map((stat, index) => {
          // Use the playerNames mapping to get the username
          let username = playerNames[stat.player_id] || `Player ${index + 1}`;
          
          return {
            id: stat.id,
            seasonId: stat.season_id,
            playerId: stat.player_id,
            rank: offset + index + 1,
            points: stat.points,
            tier: this.calculateTier(stat.points),
            snapshotDate: new Date(),
            createdAt: new Date(),
            playerName: username
          };
        });
      }
      
      // Found leaderboard snapshot
      
      // Get leaderboard entries for this season and snapshot date
      const { data, error } = await supabase
        .from('leaderboard_entries')
        .select(`
          id,
          season_id,
          player_id,
          rank,
          points,
          tier,
          snapshot_date,
          created_at
        `)
        .eq('season_id', seasonId)
        .eq('snapshot_date', latestSnapshot.snapshot_date)
        .order('rank', { ascending: true })
        .range(offset, offset + limit - 1);
      
      if (error) {
        // Error fetching leaderboard entries
        return [];
      }
      
      if (!data || data.length === 0) {
        // No leaderboard entries found
        return [];
      }
      
      // Found leaderboard entries
      
      // Get player IDs to look up usernames
      let playerNames: Record<string, string> = {};
      if (data && data.length > 0) {
        // Extract player IDs
        const playerIds = data.map(entry => entry.player_id);
        
        // Get usernames for these players
        const { data: usersData } = await supabase
          .from('users')
          .select('id, username')
          .in('id', playerIds);
          
        // Create a mapping of player IDs to usernames
        if (usersData) {
          playerNames = usersData.reduce((acc, user) => {
            acc[user.id] = user.username || `Player ${Object.keys(acc).length + 1}`;
            return acc;
          }, {} as Record<string, string>);
        }
      }
      
      return data.map(entry => {
        // Use the playerNames mapping to get the username
        let username = playerNames[entry.player_id] || `Player ${entry.rank}`;
        
        return {
          id: entry.id,
          seasonId: entry.season_id,
          playerId: entry.player_id,
          rank: entry.rank,
          points: entry.points,
          tier: entry.tier as TierType,
          snapshotDate: new Date(entry.snapshot_date),
          createdAt: new Date(entry.created_at),
          playerName: username
        };
      });
    } catch (error) {
      // Add logging for troubleshooting
      // Error in getSeasonLeaderboard
      return [];
    }
  }
  
  /**
   * Get player's rank in the current season
   * @param playerId The ID of the player
   * @returns The player's rank, points, and tier, or null if not found
   */
  async getPlayerCurrentRank(
    playerId: string
  ): Promise<{ rank: number; points: number; tier: TierType } | null> {
    try {
      // Get current season first
      const currentSeason = await this.getCurrentSeason();
      
      if (!currentSeason) {
        return null;
      }
      
      // Get player's rank for this season
      return await this.getPlayerSeasonRank(playerId, currentSeason.id);
    } catch (_error) {
      // Error in getPlayerCurrentRank
      return null;
    }
  }
  
  /**
   * Get player's rank in a specific season
   * @param playerId The ID of the player
   * @param seasonId The ID of the season
   * @returns The player's rank, points, and tier, or null if not found
   */
  async getPlayerSeasonRank(
    playerId: string,
    seasonId: string
  ): Promise<{ rank: number; points: number; tier: TierType } | null> {
    // Getting player rank in season
    try {
      const supabase = typeof window === 'undefined'
        ? createSupabaseServerClient()
        : createSupabaseBrowserClient();
        
      // First try to get player stats which now has fallback logic
      const playerStats = await this.getPlayerSeasonStats(playerId, seasonId);

      if (!playerStats) {
        // No player stats found, returning default rank
        // If we can't get player stats, return a default rank
        return {
          rank: 0,
          points: 0,
          tier: 'bronze' as TierType
        };
      }
      
      // First, try to get the actual rank from leaderboard_entries
      try {
        // Get the latest snapshot date for this season
        const { data: latestSnapshot, error: snapshotError } = await supabase
          .from('leaderboard_entries')
          .select('snapshot_date')
          .eq('season_id', seasonId)
          .order('snapshot_date', { ascending: false })
          .limit(1)
          .single();
        
        if (!snapshotError && latestSnapshot) {
          // Get player's entry from leaderboard
          const { data: leaderboardEntry, error: entryError } = await supabase
            .from('leaderboard_entries')
            .select('rank, points, tier')
            .eq('season_id', seasonId)
            .eq('player_id', playerId)
            .eq('snapshot_date', latestSnapshot.snapshot_date)
            .single();
          
          if (!entryError && leaderboardEntry) {
            // Found player rank
            return {
              rank: leaderboardEntry.rank,
              points: leaderboardEntry.points,
              tier: leaderboardEntry.tier as TierType
            };
          }
        }
      } catch (e) {
        console.error('Error querying leaderboard entry:', e);
      }
      
      // If we can't get the actual rank, calculate an approximate rank
      try {
        // Count how many players have more points (to determine approximate rank)
        const { count, error: countError } = await supabase
          .from('player_season_stats')
          .select('*', { count: 'exact', head: true })
          .eq('season_id', seasonId)
          .eq('has_entry_ticket', true)
          .gt('points', playerStats.points);
          
        if (!countError) {
          // Rank is number of players with more points + 1
          const rank = (count || 0) + 1;
          // Calculated approximate rank
          return {
            rank,
            points: playerStats.points,
            tier: this.calculateTier(playerStats.points)
          };
        }
      } catch (e) {
        // Error calculating approximate rank
      }
      
      // Fallback approach if the above methods fail
      return {
        rank: 0, // Better default than 0 for UI display
        points: playerStats.points,
        tier: this.calculateTier(playerStats.points)
      };
    } catch (error) {
      // Error in getPlayerSeasonRank
      // Return a default rank as fallback
      return {
        rank: 0, // Better default than 0 for UI display
        points: 0,
        tier: 'bronze' as TierType
      };
    }
  }
  
  /**
   * Get players around the current player in the leaderboard
   * @param playerId The ID of the player
   * @param seasonId The ID of the season
   * @param range Number of players to get above and below
   * @returns Array of leaderboard entries around the player
   */
  async getPlayersAroundInLeaderboard(
    playerId: string,
    seasonId: string,
    range: number = 3
  ): Promise<LeaderboardEntry[]> {
    // Getting players around current player in leaderboard
    try {
      // Get player's current rank
      const playerRank = await this.getPlayerSeasonRank(playerId, seasonId);
      
      if (!playerRank) {
        // No player rank found, returning empty neighborhood
        return [];
      }
      
      // Calculating range around player rank
      
      // Calculate range to fetch
      const startRank = Math.max(1, playerRank.rank - range);
      const endRank = playerRank.rank + range;
      
      // Fetch players in that range
      const supabase = typeof window === 'undefined'
        ? createSupabaseServerClient()
        : createSupabaseBrowserClient();
      
      // Get the latest snapshot date for this season
      const { data: latestSnapshot, error: snapshotError } = await supabase
        .from('leaderboard_entries')
        .select('snapshot_date')
        .eq('season_id', seasonId)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .single();
      
      if (snapshotError || !latestSnapshot) {
        // If no snapshot exists, use player_season_stats
        // This is more complex without a rank column, so we approximate
        
        // No leaderboard snapshot found, using player_season_stats for neighborhood
        // If no snapshot exists, use player_season_stats
        // Fetch top players and include the current player if needed
        
        // Get players ordered by points
        const { data: topPlayers, error: topPlayersError } = await supabase
          .from('player_season_stats')
          .select(`
            id,
            player_id,
            season_id,
            points
          `)
          .eq('season_id', seasonId)
          .eq('has_entry_ticket', true)
          .order('points', { ascending: false })
          .limit(range * 2 + 1);
        
        if (topPlayersError || !topPlayers || topPlayers.length === 0) {
          // Error or no data when fetching top players
          return [];
        }
        
        // Get player IDs to look up usernames
        let playerNames: Record<string, string> = {};
        if (topPlayers && topPlayers.length > 0) {
          // Extract player IDs
          const playerIds = topPlayers.map(stat => stat.player_id);
          
          // Get usernames for these players
          const { data: usersData } = await supabase
            .from('users')
            .select('id, username')
            .in('id', playerIds);
            
          // Create a mapping of player IDs to usernames
          if (usersData) {
            playerNames = usersData.reduce((acc, user) => {
              acc[user.id] = user.username || `Player ${Object.keys(acc).length + 1}`;
              return acc;
            }, {} as Record<string, string>);
          }
        }
        
        // Map to leaderboard entries format
        return topPlayers.map((stat, index) => {
          // Use the playerNames mapping to get the username
          let username = playerNames[stat.player_id] || `Player ${index + 1}`;
          
          return {
            id: stat.id,
            seasonId: stat.season_id,
            playerId: stat.player_id,
            rank: index + 1, // Approximate rank
            points: stat.points,
            tier: this.calculateTier(stat.points),
            snapshotDate: new Date(),
            createdAt: new Date(),
            playerName: username
          };
        });
      }
      
      // Get leaderboard entries around the player, including username data
      const { data, error } = await supabase
        .from('leaderboard_entries')
        .select(`
          id,
          season_id,
          player_id,
          rank,
          points,
          tier,
          snapshot_date,
          created_at,
          users:player_id (
            username
          )
        `)
        .eq('season_id', seasonId)
        .eq('snapshot_date', latestSnapshot.snapshot_date)
        .gte('rank', startRank)
        .lte('rank', endRank)
        .order('rank', { ascending: true });
      
      if (error) {
        // Error fetching leaderboard entries around player
        return [];
      }
      
      if (!data || data.length === 0) {
        // No players found in the rank range
        return [];
      }
      
      // Found players in the rank range
      
      // Check if the player's entry is in the results
      const playerIncluded = data.some(entry => entry.player_id === playerId);
      
      // If not, we should add the player's entry
      if (!playerIncluded) {
        // Player not in results, adding explicitly
        
        // Get the player's entry specifically with user join for type consistency
        const { data: playerEntry, error: playerEntryError } = await supabase
          .from('leaderboard_entries')
          .select(`
            id,
            season_id,
            player_id,
            rank,
            points,
            tier,
            snapshot_date,
            created_at,
            users:player_id (
              username
            )
          `)
          .eq('season_id', seasonId)
          .eq('player_id', playerId)
          .eq('snapshot_date', latestSnapshot.snapshot_date)
          .single();
          
        if (!playerEntryError && playerEntry) {
          data.push(playerEntry);
          // Resort by rank
          data.sort((a, b) => a.rank - b.rank);
        }
      }
      
      // Get player IDs to look up usernames
      let playerNames: Record<string, string> = {};
      if (data && data.length > 0) {
        // Extract player IDs
        const playerIds = data.map(entry => entry.player_id);
        
        // Get usernames for these players
        const { data: usersData } = await supabase
          .from('users')
          .select('id, username')
          .in('id', playerIds);
          
        // Create a mapping of player IDs to usernames
        if (usersData) {
          playerNames = usersData.reduce((acc, user) => {
            acc[user.id] = user.username || `Player ${Object.keys(acc).length + 1}`;
            return acc;
          }, {} as Record<string, string>);
        }
      }
      
      return data.map(entry => {
        // Use the playerNames mapping to get the username
        let username = playerNames[entry.player_id] || `Player ${entry.rank}`;
        
        return {
          id: entry.id,
          seasonId: entry.season_id,
          playerId: entry.player_id,
          rank: entry.rank,
          points: entry.points,
          tier: entry.tier as TierType,
          snapshotDate: new Date(entry.snapshot_date),
          createdAt: new Date(entry.created_at),
          playerName: username
        };
      });
    } catch (error) {
      // Error in getPlayersAroundInLeaderboard
      return [];
    }
  }
  
  /**
   * Add points to player's season stats
   * @param playerId The ID of the player
   * @param seasonId The ID of the season
   * @param points Number of points to add
   * @param gameWon Whether the game was won
   * @returns Success flag and updated points
   */
  async addPoints(
    playerId: string,
    seasonId: string,
    points: number,
    gameWon: boolean = false
  ): Promise<{
    success: boolean;
    updatedPoints: number;
    updatedStats: PlayerSeasonStats | null;
  }> {
    // Allow zero points for loss records - we still need to update games played
    // Only reject negative points
    if (points < 0) {
      return { success: false, updatedPoints: 0, updatedStats: null };
    }
    
    const supabase = typeof window === 'undefined'
      ? createSupabaseServerClient()
      : createSupabaseBrowserClient();
    
    try {
      // Get player's current stats
      const currentStats = await this.getPlayerSeasonStats(playerId, seasonId);
      
      if (!currentStats) {
        // Stats don't exist yet, create them
        const { success, stats } = await this.createOrUpdatePlayerSeasonStats(
          playerId,
          seasonId,
          true, // Assume they have an entry ticket if they're getting points
          0
        );
        
        if (!success || !stats) {
          return { success: false, updatedPoints: 0, updatedStats: null };
        }
        
        // Update with points
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from('player_season_stats')
          .update({
            points: stats.points + points,
            games_played: stats.gamesPlayed + 1,
            games_won: stats.gamesWon + (gameWon ? 1 : 0),
            win_streak: gameWon ? stats.winStreak + 1 : 0,
            last_played_date: now
          })
          .eq('id', stats.id)
          .select('*')
          .single();
        
        if (error) {
          // Error handling without logging
          return { success: false, updatedPoints: 0, updatedStats: null };
        }
        
        const updatedStats = this.mapPlayerSeasonStatsFromDb(data);
        return {
          success: true,
          updatedPoints: updatedStats.points,
          updatedStats
        };
      }
      
      // Check if this is a new day for participation tracking
      let participationDays = currentStats.participationDays;
      const now = new Date();
      const lastPlayed = currentStats.lastPlayedDate ? new Date(currentStats.lastPlayedDate) : null;
      
      // Check if this is a new day (different day than last played)
      if (!lastPlayed || 
          lastPlayed.getDate() !== now.getDate() ||
          lastPlayed.getMonth() !== now.getMonth() ||
          lastPlayed.getFullYear() !== now.getFullYear()) {
        participationDays += 1;
      }
      
      // Calculate new win streak
      const winStreak = gameWon ? currentStats.winStreak + 1 : 0;
      
      // Update stats with new points and other data
      const { data, error } = await supabase
        .from('player_season_stats')
        .update({
          points: currentStats.points + points,
          games_played: currentStats.gamesPlayed + 1,
          games_won: currentStats.gamesWon + (gameWon ? 1 : 0),
          win_streak: winStreak,
          participation_days: participationDays,
          last_played_date: now.toISOString()
        })
        .eq('id', currentStats.id)
        .select('*')
        .single();
      
      if (error) {
        // Error handling without logging
        return { 
          success: false, 
          updatedPoints: currentStats.points,
          updatedStats: currentStats
        };
      }
      
      const updatedStats = this.mapPlayerSeasonStatsFromDb(data);
      return {
        success: true,
        updatedPoints: updatedStats.points,
        updatedStats
      };
    } catch (_error) {
      // Error handling without logging
      return { success: false, updatedPoints: 0, updatedStats: null };
    }
  }
  
  /**
   * Purchase a season entry ticket
   * @param playerId The ID of the player
   * @param seasonId The ID of the season
   * @param essenceCost The cost in essence
   * @returns Success flag
   */
  async purchaseEntryTicket(
    playerId: string,
    seasonId: string,
    essenceCost: EssenceCost
  ): Promise<boolean> {
    const supabase = typeof window === 'undefined'
      ? createSupabaseServerClient()
      : createSupabaseBrowserClient();
    
    try {
      // Check if player already has an entry ticket
      const stats = await this.getPlayerSeasonStats(playerId, seasonId);
      
      if (stats && stats.hasEntryTicket) {
        // Player already has an entry ticket for this season
        return false;
      }
      
      // Record the transaction first
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { data: transactionData, error: transactionError } = await supabase
        .from('season_transactions')
        .insert({
          player_id: playerId,
          season_id: seasonId,
          transaction_type: 'entry_ticket',
          amount: 1,
          essence_cost: essenceCost
        })
        .select('*')
        .single();
      
      if (transactionError) {
        // Error recording entry ticket transaction
        return false;
      }
      
      // Now update player's season stats
      const { success } = await this.createOrUpdatePlayerSeasonStats(
        playerId,
        seasonId,
        true, // Has entry ticket
        0     // No reserve energy
      );
      
      return success;
    } catch (_error) {
      // Error handling without logging
      return false;
    }
  }
  
  /**
   * Purchase reserve energy
   * @param playerId The ID of the player
   * @param seasonId The ID of the season
   * @param energyAmount Amount of energy to purchase
   * @param transactionType Type of reserve energy transaction
   * @param essenceCost The cost in essence
   * @returns Success flag and updated reserve energy amount
   */
  async purchaseReserveEnergy(
    playerId: string,
    seasonId: string,
    energyAmount: number,
    transactionType: 'reserve_energy_small' | 'reserve_energy_medium' | 'reserve_energy_large',
    essenceCost: EssenceCost
  ): Promise<{
    success: boolean;
    updatedReserveEnergy: number;
  }> {
    const supabase = typeof window === 'undefined'
      ? createSupabaseServerClient()
      : createSupabaseBrowserClient();
    
    try {
      // Check if player has an entry ticket (required for reserve energy)
      const stats = await this.getPlayerSeasonStats(playerId, seasonId);
      
      if (!stats || !stats.hasEntryTicket) {
        // Player must have an entry ticket to purchase reserve energy
        return { success: false, updatedReserveEnergy: 0 };
      }
      
      // Record the transaction first
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { data: transactionData, error: transactionError } = await supabase
        .from('season_transactions')
        .insert({
          player_id: playerId,
          season_id: seasonId,
          transaction_type: transactionType,
          amount: energyAmount,
          essence_cost: essenceCost
        })
        .select('*')
        .single();
      
      if (transactionError) {
        // Error recording reserve energy transaction
        return { success: false, updatedReserveEnergy: stats.reserveEnergy };
      }
      
      // Now update player's season stats with new reserve energy
      const newReserveEnergy = stats.reserveEnergy + energyAmount;
      
      const { data, error } = await supabase
        .from('player_season_stats')
        .update({
          reserve_energy: newReserveEnergy
        })
        .eq('id', stats.id)
        .select('*')
        .single();
      
      if (error) {
        // Error handling without logging
        return { 
          success: false, 
          updatedReserveEnergy: stats.reserveEnergy
        };
      }
      
      return {
        success: true,
        updatedReserveEnergy: data.reserve_energy
      };
    } catch (_error) {
      // Error handling without logging
      return { success: false, updatedReserveEnergy: 0 };
    }
  }
  
  /**
   * Use reserve energy
   * @param playerId The ID of the player
   * @param seasonId The ID of the season
   * @param amount Amount of reserve energy to use
   * @returns Success flag and remaining reserve energy
   */
  async useReserveEnergy(
    playerId: string,
    seasonId: string,
    amount: number = 1
  ): Promise<{
    success: boolean;
    remainingReserveEnergy: number;
  }> {
    const supabase = typeof window === 'undefined'
      ? createSupabaseServerClient()
      : createSupabaseBrowserClient();
    
    try {
      // Get player's current stats
      const stats = await this.getPlayerSeasonStats(playerId, seasonId);
      
      if (!stats) {
        return { success: false, remainingReserveEnergy: 0 };
      }
      
      // Check if player has enough reserve energy
      if (stats.reserveEnergy < amount) {
        return { 
          success: false, 
          remainingReserveEnergy: stats.reserveEnergy
        };
      }
      
      // Update stats with reduced reserve energy
      const newReserveEnergy = stats.reserveEnergy - amount;
      
      const { data, error } = await supabase
        .from('player_season_stats')
        .update({
          reserve_energy: newReserveEnergy
        })
        .eq('id', stats.id)
        .select('*')
        .single();
      
      if (error) {
        // Error handling without logging
        return { 
          success: false, 
          remainingReserveEnergy: stats.reserveEnergy
        };
      }
      
      return {
        success: true,
        remainingReserveEnergy: data.reserve_energy
      };
    } catch (_error) {
      // Error handling without logging
      return { success: false, remainingReserveEnergy: 0 };
    }
  }
  
  /**
   * Create a daily snapshot of the leaderboard
   * @param seasonId The ID of the season
   * @returns Success flag
   */
  async createLeaderboardSnapshot(seasonId: string): Promise<boolean> {
    const supabase = createSupabaseServerClient(); // Server-side only operation
    
    try {
      // Call the database function
      const { error } = await supabase.rpc('create_leaderboard_snapshot', {
        season_id_param: seasonId
      });
      
      if (error) {
        // Error handling without logging
        return false;
      }
      
      return true;
    } catch (_error) {
      // Error handling without logging
      return false;
    }
  }
  
  /**
   * Get player's season rewards
   * @param playerId The ID of the player
   * @param seasonId The ID of the season
   * @returns Season rewards data or null if not found
   */
  async getPlayerSeasonRewards(
    playerId: string,
    seasonId: string
  ): Promise<SeasonReward | null> {
    const supabase = typeof window === 'undefined'
      ? createSupabaseServerClient()
      : createSupabaseBrowserClient();
    
    try {
      const { data, error } = await supabase
        .from('season_rewards')
        .select('*')
        .eq('player_id', playerId)
        .eq('season_id', seasonId)
        .single();
      
      if (error) {
        // Error handling without logging
        return null;
      }
      
      if (!data) {
        return null;
      }
      
      return {
        id: data.id,
        seasonId: data.season_id,
        playerId: data.player_id,
        rank: data.rank,
        tier: data.tier as TierType,
        rewardsDistributed: data.rewards_distributed,
        distributionDate: data.distribution_date ? new Date(data.distribution_date) : undefined,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };
    } catch (_error) {
      // Error handling without logging
      return null;
    }
  }
  
  /**
   * Helper function to map Season from database format to app format
   */
  private mapSeasonFromDb(data: any): Season {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      startDate: new Date(data.start_date),
      endDate: new Date(data.end_date),
      status: data.status as SeasonStatus,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }
  
  /**
   * Helper function to map PlayerSeasonStats from database format to app format
   */
  private mapPlayerSeasonStatsFromDb(data: any): PlayerSeasonStats {
    return {
      id: data.id,
      playerId: data.player_id,
      seasonId: data.season_id,
      points: data.points,
      gamesPlayed: data.games_played,
      gamesWon: data.games_won,
      winStreak: data.win_streak,
      participationDays: data.participation_days,
      lastPlayedDate: data.last_played_date ? new Date(data.last_played_date) : undefined,
      hasEntryTicket: data.has_entry_ticket,
      reserveEnergy: data.reserve_energy,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }
  
  /**
   * Helper function to calculate tier based on points
   */
  private calculateTier(points: number): TierType {
    if (points >= 1000) {
      return 'diamond';
    } else if (points >= 501) {
      return 'platinum';
    } else if (points >= 251) {
      return 'gold';
    } else if (points >= 101) {
      return 'silver';
    } else {
      return 'bronze';
    }
  }
}