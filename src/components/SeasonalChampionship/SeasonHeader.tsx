'use client';

import React from 'react';
import { Season, TierType } from '@/repositories';

interface SeasonHeaderProps {
  season: Season;
  playerRank: { rank: number; points: number; tier: TierType } | null;
}

const SeasonHeader: React.FC<SeasonHeaderProps> = ({ season, playerRank }) => {
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
  
  return (
    <div style={{
      padding: '0.75rem',
      background: 'linear-gradient(to right, #2563eb, #7c3aed)',
      color: 'white',
      borderRadius: '0.5rem',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      marginBottom: '0.5rem'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
      }}>
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 'bold', margin: 0 }}>{season.name}</h2>
          {season.description && (
            <p style={{
              fontSize: '0.75rem',
              color: '#bfdbfe',
              marginTop: '0.125rem',
              marginBottom: 0
            }}>{season.description}</p>
          )}
        </div>
        <div style={{ fontSize: '1.75rem' }}>🏆</div>
      </div>

      {playerRank && (
        <div style={{
          marginTop: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.35rem'
        }}>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '9999px',
            padding: '0.2rem 0.5rem',
            fontSize: '0.75rem',
            fontWeight: '500'
          }}>
            Rank #{playerRank.rank}
          </div>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '9999px',
            padding: '0.2rem 0.5rem',
            fontSize: '0.75rem',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center'
          }}>
            <span style={{ marginRight: '0.25rem' }}>{getTierBadge(playerRank.tier)}</span>
            <span style={{ textTransform: 'capitalize' }}>{playerRank.tier}</span>
          </div>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '9999px',
            padding: '0.2rem 0.5rem',
            fontSize: '0.75rem',
            fontWeight: '500'
          }}>
            {playerRank.points} pts
          </div>
        </div>
      )}
    </div>
  );
};

export default SeasonHeader;