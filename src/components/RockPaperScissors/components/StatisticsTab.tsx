'use client';

import React from 'react';
import { GameStats } from '../types';

interface StatisticsTabProps {
  gameStats: {
    easy: GameStats;
    medium: GameStats;
    hard: GameStats;
  };
  selectedStatsTab: string;
  onStatsTabChange: (tab: string) => void;
  onReset?: () => void; // Optional callback to reset stats
}

const StatisticsTab: React.FC<StatisticsTabProps> = ({
  gameStats,
  selectedStatsTab,
  onStatsTabChange,
  onReset
}) => {
  // No need for internal state as it's managed by the parent now

  // Stats will be computed based on selected difficulty

  // Calculate all-difficulty totals
  const allWins = gameStats.easy.wins + gameStats.medium.wins + gameStats.hard.wins;
  const allDraws = gameStats.easy.draws + gameStats.medium.draws + gameStats.hard.draws;
  const allLosses = gameStats.easy.losses + gameStats.medium.losses + gameStats.hard.losses;
  const allGames = allWins + allDraws + allLosses;

  const StatBar = ({ label, value, total, color }: { label: string; value: number; total: number; color: string }) => {
    const percentage = total > 0 ? (value / total) * 100 : 0;

    return (
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155', textTransform: 'uppercase' }}>{label}</span>
          <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>{value} ({percentage.toFixed(0)}%)</span>
        </div>
        <div style={{ width: '100%', backgroundColor: '#e2e8f0', borderRadius: '0.25rem', height: '0.5rem', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${percentage}%`,
              backgroundColor: color,
              transition: 'width 0.5s ease-out',
              boxShadow: percentage > 30 ? `0 1px 2px ${color}40` : 'none'
            }}
          ></div>
        </div>
      </div>
    );
  };

  // If no games played at any difficulty, show placeholder - League inspired
  if (allGames === 0) {
    return (
      <div style={{ padding: '0.5rem', textAlign: 'center', maxWidth: '400px', margin: '0 auto' }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e5e7eb',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📊</div>
          <h3 style={{
            fontSize: '1rem',
            fontWeight: 600,
            marginBottom: '0.5rem',
            color: '#334155',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            No Statistics Yet
          </h3>
          <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
            Play some games to see your statistics!
          </p>
          <div style={{
            marginTop: '1rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid #f1f5f9',
            width: '100%'
          }}>
            <div style={{
              width: '100%',
              backgroundColor: '#e2e8f0',
              borderRadius: '0.25rem',
              height: '0.5rem',
              marginBottom: '0.5rem',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                animation: 'statsPulse 1.5s infinite ease-in-out',
                backgroundColor: '#cbd5e1',
                width: '30%'
              }}></div>
            </div>
            <div style={{
              width: '100%',
              backgroundColor: '#e2e8f0',
              borderRadius: '0.25rem',
              height: '0.5rem',
              marginBottom: '0.5rem',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                animation: 'statsPulse 1.5s infinite ease-in-out',
                backgroundColor: '#cbd5e1',
                width: '20%',
                animationDelay: '0.2s'
              }}></div>
            </div>
            <div style={{
              width: '100%',
              backgroundColor: '#e2e8f0',
              borderRadius: '0.25rem',
              height: '0.5rem',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                animation: 'statsPulse 1.5s infinite ease-in-out',
                backgroundColor: '#cbd5e1',
                width: '10%',
                animationDelay: '0.4s'
              }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Compute selected stats based on difficulty
  const selectedStats = selectedStatsTab === 'all'
    ? { wins: allWins, draws: allDraws, losses: allLosses }
    : gameStats[selectedStatsTab as keyof typeof gameStats] || { wins: 0, draws: 0, losses: 0 };

  const selectedTotalGames = selectedStatsTab === 'all'
    ? allGames
    : selectedStats.wins + selectedStats.losses + selectedStats.draws;

  const selectedWinRate = selectedTotalGames > 0
    ? Math.round((selectedStats.wins / selectedTotalGames) * 100)
    : 0;

  return (
    <div className="p-2 text-center" style={{ maxWidth: '400px', margin: '0 auto' }}>
      {/* Difficulty Tabs - League Inspired */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #e2e8f0',
        marginBottom: '1rem',
        backgroundColor: '#f8fafc',
        borderRadius: '0.5rem 0.5rem 0 0',
        overflow: 'hidden'
      }}>
        {['all', 'easy', 'medium', 'hard'].map(diff => {
          const isActive = selectedStatsTab === diff;

          return (
            <button
              key={diff}
              onClick={() => onStatsTabChange(diff)}
              style={{
                flex: 1,
                padding: '0.35rem 0',
                fontSize: '0.75rem',
                fontWeight: isActive ? '600' : '500',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                border: 'none',
                borderBottom: isActive ? `2px solid ${
                  diff === 'all' ? '#8B5CF6' :
                  diff === 'easy' ? '#16A34A' :
                  diff === 'medium' ? '#D97706' :
                  '#DC2626'
                }` : 'none',
                backgroundColor: isActive ? (
                  diff === 'all' ? '#F5F3FF' :
                  diff === 'easy' ? '#DCFCE7' :
                  diff === 'medium' ? '#FEF3C7' :
                  '#FEE2E2'
                ) : 'transparent',
                color: isActive ? (
                  diff === 'all' ? '#8B5CF6' :
                  diff === 'easy' ? '#16A34A' :
                  diff === 'medium' ? '#D97706' :
                  '#DC2626'
                ) : '#64748b',
                textTransform: 'uppercase'
              }}
            >
              {diff}
            </button>
          );
        })}
      </div>

      {/* Stats Display - Summary Cards - League Inspired */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '0.75rem',
        marginBottom: '1rem'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          padding: '0.75rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e5e7eb',
          textAlign: 'center'
        }}>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase' }}>TOTAL GAMES</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3b82f6' }}>{selectedTotalGames}</p>
        </div>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          padding: '0.75rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e5e7eb',
          textAlign: 'center'
        }}>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase' }}>WIN RATE</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3b82f6' }}>{selectedWinRate}%</p>
        </div>
      </div>

      {/* Stats Bars - League Inspired */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        padding: '1rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: '1px solid #e5e7eb',
        marginBottom: '1rem'
      }}>
        <StatBar
          label="Wins"
          value={selectedStats.wins}
          total={selectedTotalGames}
          color="#3b82f6" // League blue color for all
        />
        <StatBar
          label="Draws"
          value={selectedStats.draws}
          total={selectedTotalGames}
          color="#64748b" // Slate color for draws
        />
        <StatBar
          label="Losses"
          value={selectedStats.losses}
          total={selectedTotalGames}
          color="#f87171" // League red color for losses
        />
      </div>

      

      {/* Reset Button - League Inspired */}
      {onReset && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
          <button
            onClick={onReset}
            style={{
              padding: '0.5rem 1rem',
              color: '#ef4444',
              fontSize: '0.75rem',
              fontWeight: '600',
              textTransform: 'uppercase',
              border: '1px solid #fca5a5',
              borderRadius: '0.5rem',
              backgroundColor: '#fee2e2',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              letterSpacing: '0.025em'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.color = '#dc2626';
              e.currentTarget.style.backgroundColor = '#fecaca';
              e.currentTarget.style.border = '1px solid #f87171';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = '#ef4444';
              e.currentTarget.style.backgroundColor = '#fee2e2';
              e.currentTarget.style.border = '1px solid #fca5a5';
            }}
          >
            Reset Statistics
          </button>
        </div>
      )}
    </div>
  );
};

export default StatisticsTab;