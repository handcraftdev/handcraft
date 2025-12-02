import { useState } from 'react';
import { Choice, Result, DifficultyLevel, EssenceAward, ChampionshipAward } from '../types';
import { determineResult, generateComputerChoice } from '../utils';
import { useChampionshipManager } from './useChampionship';

// Hook to manage the game logic and flow
export const useGameLogic = (
  difficulty: DifficultyLevel,
  championship: any,
  energy: number,
  consumeEnergy: (amount: number) => Promise<boolean>,
  addEssence: (type: Choice, amount: number) => Promise<boolean>,
  calculateReward: (choice: Choice, difficulty: DifficultyLevel) => number,
  updateStats: (difficulty: DifficultyLevel, result: 'win' | 'draw' | 'lose') => void,
  addToHistory: (playerChoice: string, computerChoice: string, result: string, difficulty: string) => void
) => {
  // Game state
  const [playerChoice, setPlayerChoice] = useState<Choice | null>(null);
  const [computerChoice, setComputerChoice] = useState<Choice | null>(null);
  const [gameResult, setGameResult] = useState<Result | null>(null);
  const [gameActive, setGameActive] = useState(true);
  const [loadingResult, setLoadingResult] = useState(false);
  const [essenceAwarded, setEssenceAwarded] = useState<EssenceAward | null>(null);
  const [championshipAwarded, setChampionshipAwarded] = useState<ChampionshipAward | null>(null);
  
  // Get championship utilities
  const {
    isChampionshipPlayer,
    hasEnergyCredits,
    hasAvailableEnergy,
    useChampionshipEnergy,
    processChampionshipResult
  } = useChampionshipManager(championship, energy);
  
  // Reset the current round
  const resetRound = () => {
    setPlayerChoice(null);
    setComputerChoice(null);
    setGameResult(null);
    setLoadingResult(false);
    setEssenceAwarded(null);
    setChampionshipAwarded(null);
    setGameActive(true);
  };
  
  // Process the game move after successful verification
  const processGameMove = async (choice: Choice) => {
    // Check if player has enough energy
    if (!gameActive || !hasAvailableEnergy) return;
    
    // Consume energy (regular or championship credits)
    let success = true;
    if (energy > 0) {
      success = await consumeEnergy(1);
    } else if (energy <= 0 && hasEnergyCredits) {
      // This is not a React Hook, it's a function returned from useChampionshipManager
      // eslint-disable-next-line react-hooks/rules-of-hooks
      success = await useChampionshipEnergy();
    } else {
      success = false; // No energy available
    }
    
    if (!success) return; // Exit if energy consumption failed
    
    // Start the game sequence
    setPlayerChoice(choice);
    setLoadingResult(true);
    setGameActive(true);
    
    // Generate computer's choice
    const compChoice = generateComputerChoice(choice, difficulty);
    
    // Simulate suspense with a countdown
    setTimeout(async () => {
      // Reveal computer's choice
      setComputerChoice(compChoice);
      
      // Determine the result
      const roundResult = determineResult(choice, compChoice);
      setEssenceAwarded(null); // Reset essence award display
      
      // Update game statistics
      if (roundResult !== null) {
        updateStats(difficulty, roundResult);
      }
      
      // Handle specific result types
      if (roundResult === 'win') {
        // Award elemental essence based on the player's choice
        const essenceAmount = calculateReward(choice, difficulty);
        setEssenceAwarded({ type: choice, amount: essenceAmount });
        
        // Add to player's inventory
        await addEssence(choice, essenceAmount);
      }
      
      // Add the game to history
      addToHistory(choice, compChoice, roundResult || 'unknown', difficulty);
      
      // Process championship results if applicable
      if (isChampionshipPlayer) {
        const championshipResult = await processChampionshipResult(roundResult, difficulty);
        setChampionshipAwarded(championshipResult);
      } else {
        setChampionshipAwarded(null);
      }
      
      // Show result in the game canvas
      setGameResult(roundResult);
      setLoadingResult(false);
      
      // Wait 2 seconds to let player see the result
      setTimeout(() => {
        setGameActive(false); // Trigger the overlay with rewards/summary
      }, 2000);
    }, 800);
  };
  
  return {
    playerChoice,
    computerChoice,
    gameResult,
    gameActive,
    loadingResult,
    essenceAwarded,
    championshipAwarded,
    hasAvailableEnergy,
    isChampionshipPlayer,
    hasEnergyCredits,
    resetRound,
    processGameMove
  };
};