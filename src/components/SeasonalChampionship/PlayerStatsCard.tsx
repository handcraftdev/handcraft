'use client';

import React from 'react';
import { PlayerSeasonStats, TierType } from '@/repositories';

interface PlayerStatsCardProps {
  playerStats: PlayerSeasonStats | null;
  playerRank: { rank: number; points: number; tier: TierType } | null;
  reserveEnergy: number;
  energy: number;
}

const PlayerStatsCard: React.FC<PlayerStatsCardProps> = ({
  playerStats,
  playerRank,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  reserveEnergy,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  energy
}) => {
  // Get tier badge emoji
  const getTierBadge = (tier: TierType) => {
    switch (tier) {
      case 'bronze': return '🥉';
      case 'silver': return '🥈';
      case 'gold': return '🥇';
      case 'platinum': return '💎';
      case 'diamond': return '💠';
      default: return '🏅';
    }
  };
  
  // Calculate win rate
  const winRate = playerStats && playerStats.gamesPlayed > 0
    ? Math.round((playerStats.gamesWon / playerStats.gamesPlayed) * 100)
    : 0;
  
  // Calculate next tier
  const getNextTier = (tier: TierType): { tier: TierType; threshold: number } | null => {
    switch (tier) {
      case 'bronze':
        return { tier: 'silver', threshold: 101 };
      case 'silver':
        return { tier: 'gold', threshold: 251 };
      case 'gold':
        return { tier: 'platinum', threshold: 501 };
      case 'platinum':
        return { tier: 'diamond', threshold: 1000 };
      case 'diamond':
        return null; // No next tier
      default:
        return null;
    }
  };
  
  // Calculate points to next tier
  const nextTier = playerRank ? getNextTier(playerRank.tier) : null;
  const pointsToNextTier = nextTier && playerRank
    ? nextTier.threshold - playerRank.points
    : null;
  
  // Calculate progress percentage
  const getProgressPercentage = (): number => {
    if (!playerRank || !nextTier) return 100;
    
    // Determine current tier min points
    const currentTierMin = (() => {
      switch (playerRank.tier) {
        case 'bronze': return 0;
        case 'silver': return 101;
        case 'gold': return 251;
        case 'platinum': return 501;
        case 'diamond': return 1000;
        default: return 0;
      }
    })();
    
    const tierRange = nextTier.threshold - currentTierMin;
    const progress = playerRank.points - currentTierMin;
    
    return Math.min(Math.round((progress / tierRange) * 100), 100);
  };
  
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '0.5rem',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      border: '1px solid #e5e7eb',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '0.5rem',
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#f8fafc',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{
          fontSize: '0.875rem',
          fontWeight: 700,
          color: '#1e40af',
          margin: 0
        }}>Your Stats</h3>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: '#1e40af',
        }}>
          <span style={{ marginRight: '0.25rem' }}>🏆</span>
          {playerRank?.points || 0} pts
        </div>
      </div>

      <div style={{ padding: '0.75rem' }}>
        {/* Stats grid - more compact */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '0.5rem',
          marginBottom: '0.75rem'
        }}>
          <div style={{
            backgroundColor: '#f1f5f9',
            borderRadius: '0.375rem',
            padding: '0.4rem 0.5rem',
            border: '1px solid #e2e8f0',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '0.7rem',
              color: '#6b7280',
              textTransform: 'uppercase',
              marginBottom: '0.1rem',
              fontWeight: 500
            }}>GAMES</div>
            <div style={{ fontSize: '1rem', fontWeight: 600 }}>{playerStats?.gamesPlayed || 0}</div>
          </div>
          <div style={{
            backgroundColor: '#f1f5f9',
            borderRadius: '0.375rem',
            padding: '0.4rem 0.5rem',
            border: '1px solid #e2e8f0',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '0.7rem',
              color: '#6b7280',
              textTransform: 'uppercase',
              marginBottom: '0.1rem',
              fontWeight: 500
            }}>WINS</div>
            <div style={{ fontSize: '1rem', fontWeight: 600 }}>{playerStats?.gamesWon || 0}</div>
          </div>
          <div style={{
            backgroundColor: '#f1f5f9',
            borderRadius: '0.375rem',
            padding: '0.4rem 0.5rem',
            border: '1px solid #e2e8f0',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '0.7rem',
              color: '#6b7280',
              textTransform: 'uppercase',
              marginBottom: '0.1rem',
              fontWeight: 500
            }}>WIN %</div>
            <div style={{ fontSize: '1rem', fontWeight: 600 }}>{winRate}%</div>
          </div>
        </div>

        {/* Next tier progress - more compact */}
        {playerRank && nextTier && (
          <div style={{ marginBottom: '0.5rem' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.15rem',
              fontSize: '0.7rem'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                fontWeight: 500
              }}>
                <span style={{ marginRight: '0.15rem', fontSize: '0.7rem' }}>{getTierBadge(playerRank.tier)}</span>
                <span style={{
                  textTransform: 'capitalize',
                  color: '#1e40af'
                }}>{playerRank.tier}</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '0.7rem',
                fontWeight: 500
              }}>
                <span style={{
                  textTransform: 'capitalize',
                  color: '#1e40af'
                }}>{nextTier.tier}</span>
                <span style={{ marginLeft: '0.15rem', fontSize: '0.7rem' }}>{getTierBadge(nextTier.tier)}</span>
              </div>
            </div>
            <div style={{
              width: '100%',
              backgroundColor: '#e5e7eb',
              borderRadius: '9999px',
              height: '0.35rem'
            }}>
              <div
                style={{
                  backgroundColor: '#2563eb',
                  height: '0.35rem',
                  borderRadius: '9999px',
                  width: `${getProgressPercentage()}%`
                }}
              ></div>
            </div>
            {pointsToNextTier && (
              <div style={{
                textAlign: 'right',
                fontSize: '0.6rem',
                color: '#6b7280',
                marginTop: '0.15rem'
              }}>
                {pointsToNextTier} pts to {nextTier.tier}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default PlayerStatsCard;