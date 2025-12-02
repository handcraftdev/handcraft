import { Choice, DifficultyLevel, Result, RULES } from './types';

// Get appropriate message for result
export const getResultMessage = (result: Result): string => {
  switch (result) {
    case 'win': return 'Victory! 🎉';
    case 'lose': return 'Defeat! 😢';
    case 'draw': return 'Draw! 🤝';
    default: return '';
  }
};

// Get appropriate status bar style based on game state
export const getStatusBarStyle = (result: Result, loadingResult: boolean): React.CSSProperties => {
  if (loadingResult) return { backgroundColor: '#8B5CF6' };
  if (!result) return { backgroundColor: '#8B5CF6' };

  switch (result) {
    case 'win': return { backgroundColor: '#4ADE80' };
    case 'lose': return { backgroundColor: '#F87171' };
    case 'draw': return { backgroundColor: '#FBBF24' };
    default: return { backgroundColor: '#8B5CF6' };
  }
};

// Generate computer's choice based on difficulty
export const generateComputerChoice = (
  playerMove: Choice,
  difficulty: DifficultyLevel
): Choice => {
  let compChoice: Choice;

  // Log the difficulty being used to confirm it's set correctly
  // Generating computer choice with difficulty

  switch (difficulty) {
    case 'easy': // Computer mostly makes random choices, increased chance to lose
      const easyRandom = Math.random();
      // Easy mode random value

      // For easy mode, computer should intentionally lose more often to let player win
      if (easyRandom < 0.25) { // Set to 25% (calculation: 25% + (75% × 1/3) = 50% win rate)
        // FIXED: Correctly find the move that would lose to the player's move
        // If player chose rock, computer should pick scissors (which loses to rock)
        compChoice = playerMove === 'rock' ? 'scissors' :
                    playerMove === 'paper' ? 'rock' : 'paper';
        // Easy mode: Letting player win
      } else {
        // 67% random choice - which gives roughly equal chances of win/lose/draw
        const choices: Choice[] = ['rock', 'paper', 'scissors'];
        compChoice = choices[Math.floor(Math.random() * choices.length)];
        // Easy mode: Random choice
      }
      break;

    case 'medium': // Balanced for fair play
      const mediumRandom = Math.random();
      // Medium mode random value

      if (mediumRandom < 0.25) {
        // 25% chance to choose the winning move (calculation: 25% computer advantage, 75% random = 25% win rate)
        // FIXED: Correctly find the move that would win against the player's move
        // If player chose rock, computer should pick paper (which beats rock)
        compChoice = playerMove === 'rock' ? 'paper' :
                    playerMove === 'paper' ? 'scissors' : 'rock';
        // Medium mode: Choosing winning move
      } else {
        // 70% random choice
        const mediumChoices: Choice[] = ['rock', 'paper', 'scissors'];
        compChoice = mediumChoices[Math.floor(Math.random() * mediumChoices.length)];
        // Medium mode: Random choice
      }
      break;

    case 'hard': // More challenging for player
      const hardRandom = Math.random();
      // Hard mode random value

      if (hardRandom < 0.50) { // Set to 50% (calculation: 50% computer advantage, 50% random = 16.67% win rate)
        // 50% chance to choose the winning move
        // FIXED: Correctly find the move that would win against the player's move
        compChoice = playerMove === 'rock' ? 'paper' :
                     playerMove === 'paper' ? 'scissors' : 'rock';
        // Hard mode: Choosing winning move
      } else {
        // 40% random choice
        const hardChoices: Choice[] = ['rock', 'paper', 'scissors'];
        compChoice = hardChoices[Math.floor(Math.random() * hardChoices.length)];
        // Hard mode: Random choice
      }
      break;

    default:
      // Unknown difficulty, falling back to random choice
      const defaultChoices: Choice[] = ['rock', 'paper', 'scissors'];
      compChoice = defaultChoices[Math.floor(Math.random() * defaultChoices.length)];
      // Default mode: Random choice
  }

  return compChoice;
};

// Determine result of the round
export const determineResult = (
  playerChoice: Choice, 
  computerChoice: Choice
): Result => {
  if (playerChoice === computerChoice) {
    return 'draw';
  } else if (RULES[playerChoice] === computerChoice) {
    return 'win';
  } else {
    return 'lose';
  }
};