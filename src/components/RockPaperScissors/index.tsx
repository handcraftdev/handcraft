'use client';

import { useState, Suspense } from 'react';
import dynamic from 'next/dynamic';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { lazy } from 'react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useSession } from 'next-auth/react';

// Custom hooks
import { useDifficulty, useGameStats, useGameHistory, useStatsTabSelection } from './hooks/useGameState';
import { useVerification } from './hooks/useVerification';
import { useGameLogic } from './hooks/useGameLogic';

// Contexts
import { useEnergy } from '@/contexts/EnergyContext';
import { useElementalEssences } from '@/contexts/ElementalEssencesContext';
import { useSeasonalChampionship } from '@/contexts/SeasonalChampionshipContext';
import { useMiniKit } from '@worldcoin/minikit-js/minikit-provider';

// Pre-load the championship component
const SeasonalChampionship = dynamic(() => import('../SeasonalChampionship'), {
  loading: () => (
    <div className="p-4 text-center">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
      <p>Loading championship data...</p>
      <p className="text-sm text-gray-600 mt-2">
        The Seasonal Championship allows you to compete with other players for rewards!
      </p>
    </div>
  ),
  ssr: false
});

// Import components
import EnergyPurchase from './components/EnergyPurchase';
import GameHeader from './components/GameHeader';
import VerificationOverlay from './components/VerificationOverlay';
import ResultOverlay from './components/ResultOverlay';
import TabNavigation, { TabType } from './components/TabNavigation';
import HistoryTab from './components/HistoryTab';
import StatisticsTab from './components/StatisticsTab';
import PlayTab from './components/PlayTab';

// Import types
import { Choice } from './types';

// Import styles
import './styles.css';
import './styles/theme.css';

export const RockPaperScissors = () => {
  // Tab navigation state
  const [activeTab, setActiveTab] = useState<TabType>('play');
  
  // Use game state hooks
  const { difficulty, changeDifficulty } = useDifficulty();
  const { gameStats, updateStats, clearStats } = useGameStats(difficulty);
  const { gameHistory, addToHistory, clearHistory } = useGameHistory(difficulty);
  const { statsTabSelection, setStatsTabSelection } = useStatsTabSelection();
  
  // Use global contexts
  const { energy, consumeEnergy } = useEnergy();
  const { addEssence, calculateReward, essences } = useElementalEssences();
  const { isInstalled } = useMiniKit();
  const championship = useSeasonalChampionship();
  
  // Clear stats and history (main function to pass to UI)
  const clearStatsAndHistory = () => {
    clearStats();
    clearHistory();
  };
  
  // Initiate game logic
  const {
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
  } = useGameLogic(
    difficulty,
    championship,
    energy,
    consumeEnergy,
    addEssence,
    calculateReward,
    updateStats,
    addToHistory
  );
  
  // Initiate verification system
  const {
    verifying,
    verificationChoice,
    verificationState,
    verificationError,
    startVerification
  } = useVerification(processGameMove);
  
  // Handle player's choice - initiates verification first
  const handlePlayerChoice = (choice: Choice) => {
    // Check if player has enough energy (regular energy or energy credits)
    if (!gameActive || !hasAvailableEnergy || verifying) return;
    // Player initiating move
    startVerification(choice, isInstalled);
  };
  
  // Handle tab change
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };
  
  // Handle statistics tab change
  const handleStatsTabChange = (tab: string) => {
    setStatsTabSelection(tab);
  };
  
  // Render content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'play':
        return (
          <PlayTab
            essences={essences}
            championship={championship}
            isChampionshipPlayer={isChampionshipPlayer}
            hasEnergyCredits={hasEnergyCredits}
            energy={energy}
            playerChoice={playerChoice}
            computerChoice={computerChoice}
            gameResult={gameResult}
            loadingResult={loadingResult}
            gameActive={gameActive}
            difficulty={difficulty}
            onChangeDifficulty={changeDifficulty}
            onPlayerChoice={handlePlayerChoice}
            onTabChange={handleTabChange}
          />
        );
        
      case 'history':
        return (
          <HistoryTab 
            recentGames={gameHistory} 
            onClear={clearStatsAndHistory} 
          />
        );
        
      case 'statistics':
        return (
          <StatisticsTab
            gameStats={gameStats}
            selectedStatsTab={statsTabSelection}
            onStatsTabChange={handleStatsTabChange}
            onReset={clearStatsAndHistory}
          />
        );
        
      case 'energy':
        // Only show energy tab content if player is a league player
        if (!isChampionshipPlayer) {
          return (
            <div className="flex flex-col items-center justify-center p-6 text-center space-y-4">
              <div className="text-5xl mb-3">🔒</div>
              <div className="text-xl font-bold mb-1">Energy Credits Locked</div>
              <div className="text-sm text-gray-600 max-w-xs">
                Join the League to unlock the ability to purchase energy credits and play more games!
              </div>
              <button
                onClick={() => setActiveTab('championship')}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
              >
                Go to League
              </button>
            </div>
          );
        }
        
        // Use the championship context
        const { purchaseReserveEnergy } = championship || {};

        // Handle energy credits purchase
        const handlePurchaseReserveEnergy = async (size: 'small' | 'medium' | 'large') => {
          if (!championship || !championship.purchaseReserveEnergy) {
            // Championship context not available
            return false;
          }

          try {
            const success = await championship.purchaseReserveEnergy(size);
            if (success) {
              // Energy credits purchased successfully
              return true;
            } else {
              // Failed to purchase energy credits
              return false;
            }
          } catch (_error) {
            // Error purchasing energy credits
            return false;
          }
        };

        return (
          <div className="space-y-4">
            <div style={{
              padding: '0.5rem',
              backgroundColor: '#f0fdf4',
              borderRadius: '0.375rem',
              borderLeft: '4px solid #10b981',
              fontSize: '0.875rem'
            }}>
              Purchase energy credits to continue playing when your regular energy is depleted!
            </div>

            <EnergyPurchase
              onPurchase={handlePurchaseReserveEnergy}
              essences={essences}
              championship={championship}
            />
          </div>
        );
        
      case 'championship':
        return (
          <Suspense fallback={
            <div className="p-4 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
              <p>Loading championship data...</p>
            </div>
          }>
            <SeasonalChampionship />
          </Suspense>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-md mx-auto my-8 relative">
      {/* Overarching header that sits on top */}
      <GameHeader title="Rock Paper Scissors" />
      
      {/* Main game container */}
      <div
        className="w-full rounded-xl shadow-sm"
        style={{
          backgroundColor: '#f0f0f0',
          borderColor: '#e0e0e0',
          borderWidth: '2px',
          borderStyle: 'solid',
          color: '#333',
          borderRadius: '1rem',
          overflow: 'hidden',
          position: 'relative',
          marginTop: '0.5rem' // Push content down to accommodate header
        }}
      >
        {/* Tab navigation under the header */}
        <TabNavigation
          activeTab={activeTab}
          onTabChange={handleTabChange}
          showChampionship={true}
          isChampionshipPlayer={isChampionshipPlayer}
        />
        
        {/* Tab content container */}
        <div
          style={{
            padding: '1rem',
            paddingTop: '2.5rem', /* Add extra padding at top for tab navigation */
          }}
        >
          {renderTabContent()}
        </div>

        {/* Verification overlay */}
        {activeTab === 'play' && (
          <VerificationOverlay
            verifying={verifying}
            verificationChoice={verificationChoice}
            verificationState={verificationState}
            verificationError={verificationError}
          />
        )}

        {/* Result overlay */}
        {activeTab === 'play' && (
          <ResultOverlay
            active={!gameActive}
            energy={energy}
            result={gameResult}
            essenceAwarded={essenceAwarded}
            championshipAwarded={championshipAwarded}
            loadingResult={loadingResult}
            onReset={resetRound}
            championship={championship}
            onOpenLeague={() => handleTabChange(isChampionshipPlayer ? 'energy' : 'championship')}
          />
        )}
      </div>
    </div>
  );
};

export default RockPaperScissors;