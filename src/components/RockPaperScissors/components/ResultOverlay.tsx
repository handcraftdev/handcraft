'use client';

import React from 'react';
import { Result, EssenceAward, ChampionshipAward } from '../types';

interface ResultOverlayProps {
  active: boolean;
  energy: number;
  result: Result;
  essenceAwarded: EssenceAward | null;
  championshipAwarded?: ChampionshipAward | null; // New prop for championship points
  loadingResult: boolean;
  onReset: () => void;
  championship?: any; // Add league context to check player status
  onOpenLeague?: () => void; // Function to open the league tab
}

const ResultOverlay: React.FC<ResultOverlayProps> = ({
  active,
  energy,
  result,
  essenceAwarded,
  championshipAwarded,
  loadingResult,
  onReset,
  championship,
  onOpenLeague
}) => {
  // Check if player is a league player
  const isLeaguePlayer = championship &&
    championship.currentSeason &&
    championship.playerStats &&
    championship.playerStats.hasEntryTicket;

  // Check if player has energy credits available
  const hasEnergyCredits = isLeaguePlayer &&
    championship.playerStats.reserveEnergy > 0;

  // Don't show any overlay while the result is still loading
  if (loadingResult) return null;

  // Don't show overlay in these cases:
  // 1. Not active and energy is not depleted
  // 2. Energy is depleted but player has energy credits (can still play)
  if (!(active || (energy <= 0 && !hasEnergyCredits))) return null;

  // Define keyframes for animations
  const animationKeyframes = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes appearFromBottom {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
  `;

  return (
    <div>
      {/* Add our animation keyframes */}
      <style dangerouslySetInnerHTML={{ __html: animationKeyframes }} />
      <div
        className="flex items-center justify-center transition-opacity duration-300"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 10, // Lower than tab navigation (zIndex: 5) but still above content
          position: 'absolute',
          top: '1.75rem', // Start below the tab navigation
          left: 0,
          right: 0,
          bottom: 0,
          borderBottomLeftRadius: '1rem',
          borderBottomRightRadius: '1rem',
          padding: '2rem'
        }}
        onClick={onReset}
      >
        <div className="text-center">
          {result ? (
            /* When round is complete - ALWAYS show this first if a result exists */
            <div className="flex flex-col items-center animate-[fadeIn_0.4s_ease-in_forwards]">
              <div className="text-6xl mb-3 animate-[appearFromBottom_0.5s_ease-out_forwards]">
                {result === 'win' ? '🎉' : result === 'lose' ? '😢' : '🤝'}
              </div>
              <div className="text-3xl font-bold mb-2 animate-[appearFromBottom_0.6s_ease-out_forwards]" style={{
                color: result === 'win'
                  ? '#4ade80'
                  : result === 'lose'
                    ? '#ef4444'
                    : '#f3f4f6'
              }}>
                {result === 'win'
                  ? 'Victory!'
                  : result === 'lose'
                    ? 'Defeat!'
                    : 'Draw!'}
              </div>

              {/* Show essence reward when player wins */}
              {result === 'win' && essenceAwarded && (
                <div className="flex flex-col items-center mb-3 animate-[appearFromBottom_0.8s_ease-out_forwards]">
                  <div className="text-lg font-bold mb-1.5" style={{ color: '#f59e0b', textShadow: '0 1px 1px rgba(0,0,0,0.3)' }}>Element Acquired!</div>
                  <div className="flex items-center">
                    <span className="text-3xl mr-2">
                      {essenceAwarded.type === 'rock' ? '✊' :
                       essenceAwarded.type === 'paper' ? '✋' : '✌️'}
                    </span>
                    <span style={{
                      color: essenceAwarded.type === 'rock' ? '#ffc87c' :
                             essenceAwarded.type === 'paper' ? '#7cd8ff' : '#d8a0ff',
                      fontWeight: '700',
                      fontSize: '1.1rem',
                      textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                    }}>
                      +{essenceAwarded.amount} {essenceAwarded.type.charAt(0).toUpperCase() + essenceAwarded.type.slice(1)} Essence
                    </span>
                  </div>
                </div>
              )}

              {/* Show league points when in league */}
              {(result === 'win' || result === 'draw') && championshipAwarded && championshipAwarded.isInChampionship && (
                <div className="flex flex-col items-center mb-3 animate-[appearFromBottom_0.9s_ease-out_forwards]">
                  <div className="text-lg font-bold mb-1.5" style={{ color: '#3b82f6', textShadow: '0 1px 1px rgba(0,0,0,0.3)' }}>League Reward!</div>
                  <div className="flex items-center">
                    <span className="text-3xl mr-2">🏆</span>
                    <span style={{
                      color: '#93c5fd',
                      fontWeight: '700',
                      fontSize: '1.1rem',
                      textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                    }}>
                      +{championshipAwarded.points} League Points
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-3 animate-[appearFromBottom_1s_ease-out_forwards]" style={{
                color: '#86efac',
                fontWeight: '600',
                fontSize: '0.9rem',
                textShadow: '0 1px 2px rgba(0,0,0,0.5)'
              }}>
                Tap to play again
                

                {/* More detailed message for non-loss results */}
                {energy <= 0 && !hasEnergyCredits && result !== 'lose' && (
                  <div style={{
                    color: '#ff4646',
                    marginTop: '0.5rem',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                  }}>
                    ⚠️ Out of energy - wait for recharge
                    {isLeaguePlayer && (
                      <div style={{ color: '#4ade80', marginTop: '0.25rem', fontSize: '0.85rem' }}>
                        Purchase energy credits in the Energy tab
                      </div>
                    )}
                    {!isLeaguePlayer && (
                      <div style={{ color: '#4ade80', marginTop: '0.25rem', fontSize: '0.85rem' }}>
                        Join League to use energy credits
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : energy <= 0 ? (
            /* When out of energy and no result to show */
            <div className="flex flex-col items-center">
              <div className="text-5xl mb-3">⚠️</div>
              <div className="text-2xl font-bold mb-2" style={{ color: '#ff4646', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                Out of Energy
              </div>

              {isLeaguePlayer ? (
                <div className="flex flex-col items-center">
                  {championship.playerStats.reserveEnergy > 0 ? (
                    <div className="text-md font-semibold mb-2" style={{ color: '#4ade80', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                      You have {championship.playerStats.reserveEnergy} energy credits available!
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      {/* Promotional banner for energy credits */}
                      <div style={{
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.8) 0%, rgba(5, 150, 105, 0.8) 100%)',
                        borderRadius: '0.75rem',
                        padding: '0.75rem 1rem',
                        marginBottom: '0.75rem',
                        marginTop: '0.5rem',
                        border: '1px solid rgba(5, 150, 105, 0.5)',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2), 0 0 8px rgba(16, 185, 129, 0.4)',
                        maxWidth: '280px'
                      }}>
                        <div style={{
                          fontSize: '1rem',
                          fontWeight: 700,
                          color: 'white',
                          textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          marginBottom: '0.5rem'
                        }}>
                          <span>⚡</span> Continue Playing Now! <span>⚡</span>
                        </div>
                        <p style={{
                          color: 'white',
                          fontSize: '0.85rem',
                          textAlign: 'center',
                          margin: 0,
                          padding: 0
                        }}>
                          Get energy credits with your essences and keep playing without waiting!
                        </p>
                      </div>

                      {/* Button to energy tab */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent triggering the parent onClick
                          if (onOpenLeague) {
                            onOpenLeague(); // Open the league tab where they can get energy
                          } else {
                            onReset(); // Fallback to regular reset
                          }
                        }}
                        style={{
                          background: 'linear-gradient(to right, #10b981, #059669)',
                          color: 'white',
                          fontWeight: 600,
                          padding: '0.5rem 1.25rem',
                          borderRadius: '2rem',
                          cursor: 'pointer',
                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.15)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          marginTop: '0.5rem',
                          marginBottom: '0.75rem',
                          transition: 'all 0.2s ease',
                          animation: 'pulse 2s infinite'
                        }}
                      >
                        Buy Energy Credits
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="text-sm mb-3" style={{ color: '#f0f0f0', textShadow: '0 1px 1px rgba(0,0,0,0.3)' }}>
                    Wait for energy to recharge <span style={{ color: '#ff9999' }}>OR</span>
                  </div>

                  {/* Championship Promo Banner */}
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.8) 0%, rgba(147, 51, 234, 0.8) 100%)',
                    borderRadius: '0.75rem',
                    padding: '0.75rem 1rem',
                    marginBottom: '0.75rem',
                    border: '1px solid rgba(139, 92, 246, 0.5)',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2), 0 0 8px rgba(139, 92, 246, 0.4)'
                  }}>
                    <div style={{
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      color: 'white',
                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem'
                    }}>
                      <span>🏆</span> League Bonus <span>🏆</span>
                    </div>
                  </div>

                  <div style={{
                    color: '#ffd166',
                    fontWeight: 600,
                    fontSize: '1rem',
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                    marginBottom: '0.5rem'
                  }}>
                    Keep playing without waiting!
                  </div>

                  <ul style={{
                    color: '#4ade80',
                    fontWeight: 500,
                    fontSize: '0.85rem',
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.4)',
                    textAlign: 'center',
                    listStyleType: 'none',
                    padding: 0,
                    marginBottom: '0.75rem'
                  }}>
                    <li style={{ marginBottom: '0.25rem' }}>✓ Purchase energy credits with essences</li>
                    <li style={{ marginBottom: '0.25rem' }}>✓ Play more games anytime</li>
                    <li>✓ Compete for seasonal League rewards</li>
                  </ul>

                  <div
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent triggering the parent onClick
                      if (onOpenLeague) {
                        onOpenLeague(); // Open the league tab
                      } else {
                        onReset(); // Fallback to regular reset
                      }
                    }}
                    style={{
                      background: 'linear-gradient(to right, #4ade80, #22c55e)',
                      color: 'white',
                      fontWeight: 600,
                      padding: '0.5rem 1.25rem',
                      borderRadius: '2rem',
                      cursor: 'pointer',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.15)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      marginTop: '0.5rem',
                      transition: 'all 0.2s ease',
                      animation: 'pulse 2s infinite'
                    }}
                  >
                    Join League Now
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ResultOverlay;