import { DifficultyLevel, Result } from '../types';

// Helper function to handle championship operations
export const useChampionshipManager = (championship: any, energy: number) => {
  // Check if player is a league player
  const isChampionshipPlayer = championship &&
    championship.currentSeason &&
    championship.playerStats &&
    championship.playerStats.hasEntryTicket;

  // Check if player has energy credits available
  const hasEnergyCredits = isChampionshipPlayer &&
    championship.playerStats?.reserveEnergy > 0;

  // Calculate if player has any form of energy available (regular or credits)
  const hasAvailableEnergy = energy > 0 || hasEnergyCredits;

  // Consume championship energy credits
  const useChampionshipEnergy = async (): Promise<boolean> => {
    if (!championship || !championship.currentSeason || !championship.playerStats?.reserveEnergy) {
      return false;
    }

    try {
      // Use energy credits via API
      const response = await fetch('/api/championship', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'use_reserve_energy',
          seasonId: championship.currentSeason.id,
          amount: 1
        })
      });

      const data = await response.json();
      const success = data.success;

      // Refresh league data if energy credits were used
      if (success) {
        championship.refreshData();
      }
      
      return success;
    } catch (_error) {
      // Error using energy credits
      return false;
    }
  };

  // Record league result and calculate points
  const processChampionshipResult = async (
    roundResult: Result,
    difficulty: DifficultyLevel
  ) => {
    if (!isChampionshipPlayer || !championship) {
      return null;
    }

    const isWin = roundResult === 'win';
    const isDraw = roundResult === 'draw';
    const isLoss = roundResult === 'lose';

    try {
      // For losses, record the loss to update games played count and reset win streak
      if (isLoss) {
        try {
          // Use await to properly handle the loss recording
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const lossResult = await championship.addPointsForGameResult(
            difficulty,
            false, // not a win
            false  // not a draw
          );

          // Loss recorded for championship

          // Explicitly refresh data to ensure UI updates
          await championship.refreshData();

          // Return null as this is just tracking the loss
          return null;
        } catch (_error) {
          // Error recording loss for championship
          return null;
        }
      }

      // For wins and draws, calculate points
      // Log current player stats before calculations
      // League stats before calculation

      // Calculate points using the league context
      const pointsResult = championship.calculateGamePoints(
        difficulty,
        isWin,
        isDraw
      );

      // League points calculation from context

      // Add points for the game result using the context method
      const result = await championship.addPointsForGameResult(
        difficulty,
        isWin,
        isDraw
      );

      // Always refresh data to ensure UI is updated with current win streak
      await championship.refreshData().catch((_err: Error) => {
        // Error refreshing league data
      });

      if (result.success) {
        if (result.pointsAwarded > 0) {
          // League points from API
        } else if (isWin || isDraw) {
          // No league points awarded for this game
        }

        // Return points info for display
        return {
          points: result.pointsAwarded || pointsResult.totalPoints,
          isInChampionship: true,
          streakBonus: pointsResult.streakBonus
        };
      } else {
        // If no points were awarded but calculation showed points
        if (pointsResult.totalPoints > 0) {
          return {
            points: 0,
            isInChampionship: true,
            streakBonus: 0
          };
        }
        return null;
      }
    } catch (_error) {
      // Error awarding league points
      return null;
    }
  };

  return {
    isChampionshipPlayer,
    hasEnergyCredits,
    hasAvailableEnergy,
    useChampionshipEnergy,
    processChampionshipResult
  };
};