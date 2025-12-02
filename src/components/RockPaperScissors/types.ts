// Game types
export type Choice = 'rock' | 'paper' | 'scissors';
export type Result = 'win' | 'lose' | 'draw' | null;
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

// Game rules
export const RULES: Record<Choice, Choice> = {
  rock: 'scissors', // Rock beats scissors
  paper: 'rock',    // Paper beats rock
  scissors: 'paper', // Scissors beats paper
};

// Verification state types
export type VerificationState = 'pending' | 'success' | 'failed' | undefined;

// For statistics tracking
export interface GameStats {
  wins: number;
  draws: number;
  losses: number;
}

// Essence award type
export interface EssenceAward {
  type: Choice;
  amount: number;
}

// Championship points award type
export interface ChampionshipAward {
  points: number;
  isInChampionship: boolean;
  streakBonus?: number; // Track streak bonus for display
}