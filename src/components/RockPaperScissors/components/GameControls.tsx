'use client';

import React from 'react';
import { Choice, DifficultyLevel } from '../types';

interface GameControlsProps {
  difficulty: DifficultyLevel;
  onChangeDifficulty: (level: DifficultyLevel) => void;
  onChoiceSelect: (choice: Choice) => void;
  gameActive: boolean;
  loadingResult: boolean;
  energy: number;
  playerChoice: Choice | null;
  hasEnergyCredits?: boolean;
}

const GameControls: React.FC<GameControlsProps> = ({
  difficulty,
  onChangeDifficulty,
  onChoiceSelect,
  gameActive,
  loadingResult,
  energy,
  playerChoice,
  hasEnergyCredits = false
}) => {
  // Calculate if player has any kind of energy available
  const hasAvailableEnergy = energy > 0 || hasEnergyCredits;
  return (
    <div className="flex gap-2 items-start">
      {/* Difficulty selection */}
      <div style={{
        borderColor: '#E5E7EB',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderRadius: '0.75rem',
        padding: '0.5rem 0.25rem',
        backgroundColor: '#F9FAFB',
        width: '25%',
        minWidth: '80px',
        height: '90px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
      }}>
        <div className="flex flex-col gap-0.5" style={{ flex: 1, justifyContent: 'space-between' }}>
          {(['easy', 'medium', 'hard'] as DifficultyLevel[]).map((level) => {
            // Different colors for each difficulty level
            const getLevelColors = () => {
              if (level === 'easy') {
                return {
                  bg: difficulty === level ? '#DCFCE7' : 'transparent',
                  border: '#86EFAC',
                  text: difficulty === level ? '#16A34A' : '#4ADE80',
                  activeShadow: '0 2px 6px rgba(74, 222, 128, 0.3)'
                };
              } else if (level === 'medium') {
                return {
                  bg: difficulty === level ? '#FEF3C7' : 'transparent',
                  border: '#FCD34D',
                  text: difficulty === level ? '#D97706' : '#F59E0B',
                  activeShadow: '0 2px 6px rgba(245, 158, 11, 0.3)'
                };
              } else { // hard
                return {
                  bg: difficulty === level ? '#FEE2E2' : 'transparent',
                  border: '#FECACA',
                  text: difficulty === level ? '#DC2626' : '#EF4444',
                  activeShadow: '0 2px 6px rgba(239, 68, 68, 0.3)'
                };
              }
            };
            
            const colors = getLevelColors();
            
            return (
              <button
                key={level}
                onClick={() => onChangeDifficulty(level)}
                disabled={!gameActive || loadingResult || playerChoice !== null}
                className="transition-colors duration-200"
                style={{
                  fontSize: '0.7rem',
                  fontWeight: '600',
                  textTransform: 'capitalize',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '0.375rem',
                  width: '100%',
                  minHeight: '22px',
                  transition: 'all 200ms',
                  backgroundColor: colors.bg,
                  borderColor: difficulty === level ? colors.border : 'transparent',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  boxShadow: difficulty === level ? colors.activeShadow : 'none',
                  color: (!gameActive || loadingResult || playerChoice !== null) ? 'var(--rps-text-muted)' : colors.text,
                  opacity: (!gameActive || loadingResult || playerChoice !== null) ? 0.6 : 1,
                  cursor: (!gameActive || loadingResult || playerChoice !== null) ? 'not-allowed' : 'pointer'
                }}
              >
                {level}
              </button>
            );
          })}
        </div>
      </div>

      {/* Player choice buttons */}
      <div style={{
        borderColor: '#E5E7EB',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderRadius: '0.75rem',
        padding: '0.5rem',
        backgroundColor: '#F9FAFB',
        width: '75%',
        height: '90px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div className="grid grid-cols-3 gap-2" style={{ flex: 1 }}>
          {(['rock', 'paper', 'scissors'] as Choice[]).map((choice) => {
            // Different background colors for each choice
            const getChoiceColors = () => {
              if (choice === 'rock') {
                return {
                  bg: '#FEF3C7',
                  activeBg: '#FDE68A',
                  border: '#FCD34D',
                  activeBorder: '#F59E0B',
                  selectedBg: 'rgba(245, 158, 11, 0.15)',
                  textColor: '#B45309'
                };
              } else if (choice === 'paper') {
                return {
                  bg: '#DBEAFE',
                  activeBg: '#BFDBFE',
                  border: '#93C5FD',
                  activeBorder: '#3B82F6',
                  selectedBg: 'rgba(59, 130, 246, 0.15)',
                  textColor: '#1D4ED8'
                };
              } else { // scissors
                return {
                  bg: '#F5F3FF',
                  activeBg: '#DDD6FE',
                  border: '#C4B5FD',
                  activeBorder: '#8B5CF6',
                  selectedBg: 'rgba(139, 92, 246, 0.15)',
                  textColor: '#6D28D9'
                };
              }
            };
            
            const colors = getChoiceColors();
            
            return (
              <button
                key={choice}
                onClick={() => onChoiceSelect(choice)}
                disabled={!gameActive || loadingResult || !hasAvailableEnergy}
                className={`transform transition-all duration-200 ${gameActive && !loadingResult ? 'hover:scale-110 active:scale-95' : ''}`}
                style={{
                  padding: '0.375rem 0',
                  borderRadius: '0.75rem',
                  transition: 'all 200ms',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  backgroundColor: !gameActive || loadingResult
                    ? 'var(--rps-choice-bg)'
                    : playerChoice === choice
                      ? colors.activeBg
                      : colors.bg,
                  borderColor: !gameActive || loadingResult
                    ? 'var(--rps-choice-border)'
                    : playerChoice === choice
                      ? colors.activeBorder
                      : colors.border,
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  boxShadow: playerChoice === choice
                    ? '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)'
                    : gameActive && !loadingResult
                      ? '0 4px 6px -1px rgba(0,0,0,0.1)'
                      : 'none',
                  opacity: !gameActive && playerChoice !== choice ? '0.6' : '1',
                  cursor: !gameActive || loadingResult || !hasAvailableEnergy ? 'not-allowed' : 'pointer',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {playerChoice === choice && !loadingResult && (
                  <div style={{
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    right: '0',
                    bottom: '0',
                    backgroundColor: colors.selectedBg,
                    borderRadius: '0.75rem',
                    zIndex: '0'
                  }} />
                )}
                <span className="text-3xl mb-1 relative z-10" style={{
                  filter: gameActive && !loadingResult
                    ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))'
                    : 'none'
                }}>
                  {choice === 'rock' ? '✊' : choice === 'paper' ? '✋' : '✌️'}
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  textTransform: 'capitalize',
                  position: 'relative',
                  zIndex: '10',
                  color: playerChoice === choice && gameActive && !loadingResult
                    ? colors.textColor
                    : playerChoice === choice ? 'var(--rps-primary-text)' : 'var(--rps-text-main)'
                }}>{choice}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default GameControls;