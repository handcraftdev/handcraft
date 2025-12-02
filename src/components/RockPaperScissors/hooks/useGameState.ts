import { useState, useEffect } from 'react';
import { DifficultyLevel } from '../types';

// Hook to manage game statistics with localStorage persistence
export const useGameStats = (initialDifficulty: DifficultyLevel) => {
  const [gameStats, setGameStats] = useState<{
    easy: {wins: number, draws: number, losses: number},
    medium: {wins: number, draws: number, losses: number},
    hard: {wins: number, draws: number, losses: number}
  }>(() => {
    // Only run in browser environment
    if (typeof window !== 'undefined') {
      const savedStats = localStorage.getItem('rps-game-stats');
      if (savedStats) {
        try {
          const parsedStats = JSON.parse(savedStats);

          // Handle migration from old format (flat object) to new format (per difficulty)
          if (parsedStats && typeof parsedStats === 'object') {
            // Check if it's the old format (has direct wins/draws/losses properties)
            if ('wins' in parsedStats && 'draws' in parsedStats && 'losses' in parsedStats) {
              // Migration from old format to per-difficulty format
              const migratedStats = {
                easy: { wins: 0, draws: 0, losses: 0 },
                medium: { wins: 0, draws: 0, losses: 0 },
                hard: { wins: 0, draws: 0, losses: 0 }
              };
              // Migrate old stats to current difficulty
              migratedStats[initialDifficulty] = { 
                wins: parsedStats.wins || 0, 
                draws: parsedStats.draws || 0, 
                losses: parsedStats.losses || 0 
              };
              return migratedStats;
            }

            // Make sure all difficulty levels exist (for compatibility)
            const newStats = {
              easy: { wins: 0, draws: 0, losses: 0 },
              medium: { wins: 0, draws: 0, losses: 0 },
              hard: { wins: 0, draws: 0, losses: 0 },
              ...parsedStats
            };

            return newStats;
          }
        } catch (_e) {
          // Failed to parse saved game stats
        }
      }
    }
    // Default empty stats for each difficulty
    return {
      easy: { wins: 0, draws: 0, losses: 0 },
      medium: { wins: 0, draws: 0, losses: 0 },
      hard: { wins: 0, draws: 0, losses: 0 }
    };
  });

  // Save game statistics to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('rps-game-stats', JSON.stringify(gameStats));
    }
  }, [gameStats]);

  // Update game stats based on result
  const updateStats = (difficulty: DifficultyLevel, result: 'win' | 'draw' | 'lose') => {
    setGameStats(prev => ({
      ...prev,
      [difficulty]: {
        ...prev[difficulty],
        [result === 'win' ? 'wins' : result === 'draw' ? 'draws' : 'losses']: 
          prev[difficulty][result === 'win' ? 'wins' : result === 'draw' ? 'draws' : 'losses'] + 1
      }
    }));
  };

  // Clear all game stats
  const clearStats = () => {
    setGameStats({
      easy: { wins: 0, draws: 0, losses: 0 },
      medium: { wins: 0, draws: 0, losses: 0 },
      hard: { wins: 0, draws: 0, losses: 0 }
    });
    if (typeof window !== 'undefined') {
      localStorage.removeItem('rps-game-stats');
    }
  };

  return { gameStats, updateStats, clearStats };
};

// Hook to manage game history with localStorage persistence
export const useGameHistory = (initialDifficulty: DifficultyLevel) => {
  const [gameHistory, setGameHistory] = useState<Array<{
    id: string;
    date: string;
    playerChoice: string;
    computerChoice: string;
    result: string;
    difficulty?: string;
  }>>(() => {
    // Only run in browser environment
    if (typeof window !== 'undefined') {
      const savedHistory = localStorage.getItem('rps-game-history');
      if (savedHistory) {
        try {
          const parsedHistory = JSON.parse(savedHistory);

          // Add difficulty field to any existing history items that don't have it
          if (Array.isArray(parsedHistory)) {
            return parsedHistory.map(game => {
              // If the game already has a difficulty, keep it
              if (game.difficulty) {
                return game;
              }
              // Otherwise add the current difficulty
              return {
                ...game,
                difficulty: initialDifficulty
              };
            });
          }
          return parsedHistory;
        } catch (_e) {
          // Failed to parse saved game history
        }
      }
    }
    return [];
  });

  // Save game history to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('rps-game-history', JSON.stringify(gameHistory));
    }
  }, [gameHistory]);

  // Add a new game to history
  const addToHistory = (playerChoice: string, computerChoice: string, result: string, difficulty: string) => {
    const newGame = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      playerChoice,
      computerChoice,
      result,
      difficulty
    };
    setGameHistory(prev => [newGame, ...prev].slice(0, 30)); // Keep up to 30 most recent games
  };

  // Clear game history
  const clearHistory = () => {
    setGameHistory([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('rps-game-history');
    }
  };

  return { gameHistory, addToHistory, clearHistory };
};

// Hook to manage difficulty with localStorage persistence
export const useDifficulty = () => {
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(() => {
    // Only run in browser environment
    if (typeof window !== 'undefined') {
      const savedDifficulty = localStorage.getItem('rps-difficulty');
      // Validate that the saved value is a valid difficulty level
      if (savedDifficulty === 'easy' || savedDifficulty === 'medium' || savedDifficulty === 'hard') {
        return savedDifficulty as DifficultyLevel;
      }
    }
    return 'easy'; // Default to 'easy' if no valid saved value
  });

  // Save difficulty to localStorage when it changes
  const changeDifficulty = (level: DifficultyLevel) => {
    setDifficulty(level);
    if (typeof window !== 'undefined') {
      localStorage.setItem('rps-difficulty', level);
    }
  };

  return { difficulty, changeDifficulty };
};

// Hook to manage stats tab selection with localStorage persistence
export const useStatsTabSelection = () => {
  const [statsTabSelection, setStatsTabSelection] = useState<string>(() => {
    // Only run in browser environment
    if (typeof window !== 'undefined') {
      const savedStatsTab = localStorage.getItem('rps-stats-tab');
      // Validate that the saved value is a valid tab
      if (savedStatsTab === 'all' || savedStatsTab === 'easy' ||
          savedStatsTab === 'medium' || savedStatsTab === 'hard') {
        return savedStatsTab;
      }
    }
    return 'all'; // Default to 'all' if no valid saved value
  });

  // Save stats tab selection to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('rps-stats-tab', statsTabSelection);
    }
  }, [statsTabSelection]);

  return { statsTabSelection, setStatsTabSelection };
};