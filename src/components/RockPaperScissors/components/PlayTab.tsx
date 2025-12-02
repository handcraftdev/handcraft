import React from 'react';
import { Choice, DifficultyLevel } from '../types';
import StatusBar from './StatusBar';
import GameArena from './GameArena';
import GameControls from './GameControls';
import PlayerEssences from './PlayerEssences';
import LeagueAdvertisement from './LeagueAdvertisement';
import { getResultMessage, getStatusBarStyle } from '../utils';
import { TabType } from './TabNavigation';

interface PlayTabProps {
  essences: {
    rock: number;
    paper: number;
    scissors: number;
  };
  championship: any;
  isChampionshipPlayer: boolean;
  hasEnergyCredits: boolean;
  energy: number;
  playerChoice: Choice | null;
  computerChoice: Choice | null;
  gameResult: any;
  loadingResult: boolean;
  gameActive: boolean;
  difficulty: DifficultyLevel;
  onChangeDifficulty: (level: DifficultyLevel) => void;
  onPlayerChoice: (choice: Choice) => void;
  onTabChange: (tab: TabType) => void;
}

const PlayTab: React.FC<PlayTabProps> = ({
  essences,
  championship,
  isChampionshipPlayer,
  hasEnergyCredits,
  energy,
  playerChoice,
  computerChoice,
  gameResult,
  loadingResult,
  gameActive,
  difficulty,
  onChangeDifficulty,
  onPlayerChoice,
  onTabChange
}) => {
  return (
    <div className="space-y-3">
      {/* Player essence indicator */}
      <PlayerEssences 
        essences={essences}
        championshipEnergyCredits={isChampionshipPlayer ? championship?.playerStats?.reserveEnergy : 0}
        showChampionshipCredits={isChampionshipPlayer}
      />

      {/* League advertisement for non-league players when there's an active season */}
      {championship &&
       championship.currentSeason &&
       (!isChampionshipPlayer) && (
        <LeagueAdvertisement
          seasonNumber={championship.currentSeason.number}
          seasonName={championship.currentSeason.name}
          onJoinLeague={() => onTabChange('championship')}
        />
      )}

      {/* Game arena with separate status bar and game area */}
      <div className="space-y-1">
        {/* Status banner */}
        <StatusBar
          result={gameResult}
          loadingResult={loadingResult}
          playerChoice={playerChoice}
          computerChoice={computerChoice}
          getStatusMessage={() => getResultMessage(gameResult)}
          getStatusStyle={() => getStatusBarStyle(gameResult, loadingResult)}
        />

        {/* Game arena display */}
        <GameArena
          playerChoice={playerChoice}
          computerChoice={computerChoice}
          loadingResult={loadingResult}
        />
      </div>

      {/* Game controls (difficulty selector and player choice buttons) */}
      <GameControls
        difficulty={difficulty}
        onChangeDifficulty={onChangeDifficulty}
        onChoiceSelect={onPlayerChoice}
        gameActive={gameActive}
        loadingResult={loadingResult}
        energy={energy}
        playerChoice={playerChoice}
        hasEnergyCredits={hasEnergyCredits}
      />
    </div>
  );
};

export default PlayTab;