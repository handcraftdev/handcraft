'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Season, 
  PlayerSeasonStats,
  LeaderboardEntry,
  TierType
} from '@/repositories';
import { useElementalEssences } from './ElementalEssencesContext';
import { useEnergy } from './EnergyContext';

// Point calculation result interface
interface PointCalculationResult {
  basePoints: number;         // Base points from difficulty
  streakBonus: number;        // Win streak bonus
  dailyBonus: number;         // Daily participation bonus
  totalPoints: number;        // Total points to award
  isDailyFirstGame: boolean;  // Whether this is the first game of the day
}

// Define the context interface
export interface SeasonalChampionshipContextType {
  currentSeason: Season | null;
  isLoading: boolean;
  playerStats: PlayerSeasonStats | null;
  leaderboard: LeaderboardEntry[];
  neighborhoodPlayers: LeaderboardEntry[];
  playerRank: { rank: number; points: number; tier: TierType } | null;
  refreshData: () => Promise<void>;
  purchaseEntryTicket: (skipEssence?: boolean) => Promise<boolean>;
  purchaseReserveEnergy: (size: 'small' | 'medium' | 'large') => Promise<boolean>;
  calculateGamePoints: (difficulty: string, isWin: boolean, isDraw: boolean) => PointCalculationResult;
  addPointsForGameResult: (difficulty: string, isWin: boolean, isDraw: boolean) => Promise<{success: boolean, pointsAwarded: number}>;
}

// Create the context with a default value
const SeasonalChampionshipContext = createContext<SeasonalChampionshipContextType>({
  currentSeason: null,
  isLoading: true,
  playerStats: null,
  leaderboard: [],
  neighborhoodPlayers: [],
  playerRank: null,
  refreshData: async () => {},
  purchaseEntryTicket: async (_skipEssence?: boolean) => false,
  purchaseReserveEnergy: async () => false,
  calculateGamePoints: () => ({
    basePoints: 0,
    streakBonus: 0,
    dailyBonus: 0,
    totalPoints: 0,
    isDailyFirstGame: false
  }),
  addPointsForGameResult: async () => ({ success: false, pointsAwarded: 0 })
});

// Custom hook to use the context
export const useSeasonalChampionship = () => useContext(SeasonalChampionshipContext);

// Provider component
export const SeasonalChampionshipProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Get the user session
  const { data: session } = useSession();
  
  // Use other contexts
  const essenceContext = useElementalEssences();
  const energyContext = useEnergy();
  
  // Extract functions to avoid hooks in callbacks
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _addEssence = essenceContext.addEssence;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _useEssence = essenceContext.useEssence;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const energy = energyContext.energy;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const consumeEnergy = energyContext.consumeEnergy;
  
  // State with default values to prevent null issues
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [playerStats, setPlayerStats] = useState<PlayerSeasonStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [neighborhoodPlayers, setNeighborhoodPlayers] = useState<LeaderboardEntry[]>([]);
  const [playerRank, setPlayerRank] = useState<{ rank: number; points: number; tier: TierType } | null>({
    rank: 0,
    points: 0,
    tier: 'bronze'
  });
  
  // Track in-flight requests to prevent duplicates
  const requestInProgress = React.useRef<Promise<void> | null>(null);
  const lastRequestTime = React.useRef<number>(0);
  const MIN_REQUEST_INTERVAL = 5000; // 5 seconds minimum between requests

  // Refresh all data - using the API endpoint instead of direct database calls
  const refreshData = useCallback(async (): Promise<void> => {
    if (!session?.user?.id) {
      // No user session, skipping championship data loading
      setIsLoading(false);
      return;
    }

    // If a request is already in progress, wait for it to complete
    if (requestInProgress.current) {
      // Championship data refresh already in progress, waiting...
      await requestInProgress.current;
      return;
    }

    // Throttle requests to prevent excessive API calls
    const now = Date.now();
    if (now - lastRequestTime.current < MIN_REQUEST_INTERVAL) {
      // Championship data was fetched recently, skipping
      return;
    }

    setIsLoading(true);

    // Create a new request promise
    const requestPromise = (async () => {
      try {
        lastRequestTime.current = Date.now();

        // Use the API endpoint to fetch all championship data in a single request
        const response = await fetch('/api/championship', {
          // Use proper cache control headers
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          // Add a timeout
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });

        // Check for successful response
        if (!response.ok) {
          // API request failed with status
          // Set default values instead of returning (which would leave loading state active)
          setIsLoading(false);
          setCurrentSeason(null);
          setLeaderboard([]);
          setNeighborhoodPlayers([]);
          setPlayerRank({
            rank: 0,
            points: 0,
            tier: 'bronze'
          });
          return;
        }

        const data = await response.json();
        if (!data.success) {
          // API returned an error
          // Set default values
          setIsLoading(false);
          setCurrentSeason(null);
          setLeaderboard([]);
          setNeighborhoodPlayers([]);
          setPlayerRank({
            rank: 0,
            points: 0,
            tier: 'bronze'
          });
          return;
        }

        // Extract and set all data from the API response
        const {
          currentSeason: season,
          playerStats: stats,
          leaderboard: board,
          playerRank: rank,
          neighborhoodPlayers: neighbors
        } = data.data;

        // API championship data received and being processed
        
        // Set data
        setCurrentSeason(season);
        setPlayerStats(stats);
        setLeaderboard(board || []);
        setPlayerRank(rank);
        setNeighborhoodPlayers(neighbors || []);
      } catch (_error) {
        // Error refreshing seasonal championship data
        // Clear data on error
        setCurrentSeason(null);
        setPlayerStats(null);
        setLeaderboard([]);
        setNeighborhoodPlayers([]);
        setPlayerRank({
          rank: 0,
          points: 0,
          tier: 'bronze'
        });
      } finally {
        setIsLoading(false);
        // Clear the request promise when done
        requestInProgress.current = null;
      }
    })();

    // Store the request promise
    requestInProgress.current = requestPromise;

    // Wait for the request to complete
    await requestPromise;
  }, [session?.user?.id]);
  
  // Helper functions for essence operations
  const createHelpers = (walletId: string) => {
    const handleUseEssence = async (type: 'rock' | 'paper' | 'scissors', amount: number) => {
      return await essenceContext.useEssence(walletId, type, amount);
    };
    
    const handleAddEssence = async (type: 'rock' | 'paper' | 'scissors', amount: number) => {
      return await essenceContext.addEssence(walletId, type, amount);
    };
    
    return { handleUseEssence, handleAddEssence };
  };

  // Purchase entry ticket - using the API endpoint
  const purchaseEntryTicket = useCallback(async (skipEssence: boolean = false): Promise<boolean> => {
    if (!session?.user?.id || !currentSeason) {
      return false;
    }

    // Use wallet ID for essence operations
    const walletId = session.user.id;
    
    // Create helpers
    const { handleUseEssence, handleAddEssence } = createHelpers(walletId);

    // Entry ticket cost - 15 of each essence
    const essenceCost = {
      rock: 15,
      paper: 15,
      scissors: 15
    };

    try {
      // Skip essence deduction if requested (used for WLD payments)
      if (!skipEssence) {
        // Use essence first - uses wallet ID
        
        // Use the helper functions
        const rockResult = await handleUseEssence('rock', essenceCost.rock);
        if (!rockResult.success) {
          // Failed to use rock essence for entry ticket
          return false;
        }

        const paperResult = await handleUseEssence('paper', essenceCost.paper);
        if (!paperResult.success) {
          // Refund rock essence
          await handleAddEssence('rock', essenceCost.rock);
          // Failed to use paper essence for entry ticket
          return false;
        }

        const scissorsResult = await handleUseEssence('scissors', essenceCost.scissors);
        if (!scissorsResult.success) {
          // Refund rock and paper essence
          await handleAddEssence('rock', essenceCost.rock);
          await handleAddEssence('paper', essenceCost.paper);
          // Failed to use scissors essence for entry ticket
          return false;
        }
      } else {
        // Skipping essence deduction - WLD payment flow
      }
      
      // Purchase the ticket using the API
      const response = await fetch('/api/championship', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'purchase_entry_ticket',
          seasonId: currentSeason.id
        })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        // Refund all essence (only if we actually used essence)
        if (!skipEssence) {
          await handleAddEssence('rock', essenceCost.rock);
          await handleAddEssence('paper', essenceCost.paper);
          await handleAddEssence('scissors', essenceCost.scissors);
        }
        // Failed to purchase entry ticket
        return false;
      }
      
      // Refresh data
      await refreshData();
      return true;
    } catch (_error) {
      // Error purchasing entry ticket
      return false;
    }
  }, [session?.user?.id, currentSeason, essenceContext, refreshData]);
  
  // Purchase reserve energy - using the API endpoint
  const purchaseReserveEnergy = useCallback(async (
    size: 'small' | 'medium' | 'large'
  ): Promise<boolean> => {
    if (!session?.user?.id || !currentSeason || !playerStats || !playerStats.hasEntryTicket) {
      return false;
    }
    
    // Use wallet ID for essence operations
    const walletId = session.user.id;
    
    // Energy amounts and costs
    const energyPacks = {
      small: {
        amount: 50,
        cost: { rock: 15, paper: 15, scissors: 15 } // 45 essence total = $0.99
      },
      medium: {
        amount: 150,
        cost: { rock: 30, paper: 30, scissors: 30 } // 90 essence total = $1.99
      },
      large: {
        amount: 300,
        cost: { rock: 45, paper: 45, scissors: 45 } // 135 essence total = $2.99
      }
    };
    
    const pack = energyPacks[size];
    
    try {
      // Create helpers
      const { handleUseEssence, handleAddEssence } = createHelpers(walletId);

      const rockResult = await handleUseEssence('rock', pack.cost.rock);
      if (!rockResult.success) {
        // Failed to use rock essence for reserve energy
        return false;
      }

      const paperResult = await handleUseEssence('paper', pack.cost.paper);
      if (!paperResult.success) {
        // Refund rock essence
        await handleAddEssence('rock', pack.cost.rock);
        // Failed to use paper essence for reserve energy
        return false;
      }

      const scissorsResult = await handleUseEssence('scissors', pack.cost.scissors);
      if (!scissorsResult.success) {
        // Refund rock and paper essence
        await handleAddEssence('rock', pack.cost.rock);
        await handleAddEssence('paper', pack.cost.paper);
        // Failed to use scissors essence for reserve energy
        return false;
      }
      
      // Purchase the reserve energy using the API
      const response = await fetch('/api/championship', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'purchase_reserve_energy',
          seasonId: currentSeason.id,
          size
        })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        // Refund all essence
        await handleAddEssence('rock', pack.cost.rock);
        await handleAddEssence('paper', pack.cost.paper);
        await handleAddEssence('scissors', pack.cost.scissors);
        // Failed to purchase reserve energy
        return false;
      }
      
      // Refresh data
      await refreshData();
      return true;
    } catch (_error) {
      // Error purchasing reserve energy
      return false;
    }
  }, [session?.user?.id, currentSeason, playerStats, essenceContext, refreshData]);
  
  // Calculate points for game result
  const calculateGamePoints = useCallback((
    difficulty: string,
    isWin: boolean,
    isDraw: boolean
  ): PointCalculationResult => {
    // Default result with no points
    const defaultResult: PointCalculationResult = {
      basePoints: 0,
      streakBonus: 0,
      dailyBonus: 0,
      totalPoints: 0,
      isDailyFirstGame: false
    };

    // If not in championship, return 0 points
    if (!playerStats || !playerStats.hasEntryTicket) {
      return defaultResult;
    }

    // Calculate base points based on difficulty (only for wins)
    let basePoints = 0;
    if (isWin) {
      switch (difficulty) {
        case 'easy':
          basePoints = 1;
          break;
        case 'medium':
          basePoints = 2;
          break;
        case 'hard':
          basePoints = 3;
          break;
        default:
          basePoints = 1;
      }
    }

    // All bonuses removed
    const streakBonus = 0;
    const dailyBonus = 0;

    // Determine if this is first game of the day (for tracking only)
    let isDailyFirstGame = false;
    if (playerStats.lastPlayedDate) {
      const lastPlayed = new Date(playerStats.lastPlayedDate);
      const now = new Date();
      isDailyFirstGame =
        lastPlayed.getDate() !== now.getDate() ||
        lastPlayed.getMonth() !== now.getMonth() ||
        lastPlayed.getFullYear() !== now.getFullYear();
    } else {
      // If no previous games, this is the first game
      isDailyFirstGame = true;
    }

    // Calculate total points - just base points for wins, 1 point for draws
    let totalPoints = 0;

    // Award points for wins - just base points
    if (isWin) {
      totalPoints = basePoints;
    }

    // Additional point for draws
    if (isDraw && !isWin) {
      totalPoints = 1;
    }

    // Point calculation details (all bonuses removed)

    return {
      basePoints,
      streakBonus,
      dailyBonus,
      totalPoints,
      isDailyFirstGame
    };
  }, [playerStats]);

  // Add points for game result - using the API endpoint
  const addPointsForGameResult = useCallback(async (
    difficulty: string,
    isWin: boolean,
    isDraw: boolean
  ): Promise<{ success: boolean; pointsAwarded: number }> => {
    if (!session?.user?.id || !currentSeason || !playerStats || !playerStats.hasEntryTicket) {
      return { success: false, pointsAwarded: 0 };
    }

    try {
      // Calculate points
      const pointsResult = calculateGamePoints(difficulty, isWin, isDraw);
      const points = pointsResult.totalPoints;

      // For losses with no points to award, we should still update the stats
      // but return success to avoid error messages
      const isLoss = !isWin && !isDraw;

      // Handle losses specifically to record the game
      if (isLoss) {
        // Recording loss in championship stats

        // Make API call to update stats even for losses
        const response = await fetch('/api/championship', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'add_points',
            seasonId: currentSeason.id,
            points: 0, // No points for losses
            isWin: false // Mark as not a win
          })
        });

        const data = await response.json();

        if (!data.success) {
          // Failed to record loss
          return { success: false, pointsAwarded: 0 };
        }

        // Update player stats
        if (data.updatedStats) {
          setPlayerStats(data.updatedStats);
        }

        // Refresh rank data
        await refreshData();

        // Return success but 0 points
        return { success: true, pointsAwarded: 0 };
      }

      // For non-losses, only proceed if there are points to award
      if (points <= 0) {
        return { success: false, pointsAwarded: 0 };
      }

      // Add points using the API
      const response = await fetch('/api/championship', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'add_points',
          seasonId: currentSeason.id,
          points,
          isWin
        })
      });

      const data = await response.json();

      if (!data.success) {
        // Failed to add points for game result
        return { success: false, pointsAwarded: 0 };
      }

      // Update player stats and rank
      if (data.updatedStats) {
        setPlayerStats(data.updatedStats);
      }

      // Refresh rank data
      await refreshData();

      return { success: true, pointsAwarded: points };
    } catch (_error) {
      // Error adding points for game result
      return { success: false, pointsAwarded: 0 };
    }
  }, [session?.user?.id, currentSeason, playerStats, calculateGamePoints, refreshData]);

  // Initialize data when authenticated
  useEffect(() => {
    // Only fetch data if we have an authenticated user
    if (session?.user?.id) {
      refreshData();
    } else {
      setIsLoading(false);
    }
  }, [session?.user?.id, refreshData]);

  // Context value
  const value = {
    currentSeason,
    isLoading,
    playerStats,
    leaderboard,
    neighborhoodPlayers,
    playerRank,
    refreshData,
    purchaseEntryTicket,
    purchaseReserveEnergy,
    calculateGamePoints,
    addPointsForGameResult
  };
  
  return (
    <SeasonalChampionshipContext.Provider value={value}>
      {children}
    </SeasonalChampionshipContext.Provider>
  );
};