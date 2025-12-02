import React from 'react';

interface PlayerEssencesProps {
  essences: {
    rock: number;
    paper: number;
    scissors: number;
  };
  championshipEnergyCredits?: number;
  showChampionshipCredits?: boolean;
}

const PlayerEssences: React.FC<PlayerEssencesProps> = ({
  essences,
  championshipEnergyCredits = 0,
  showChampionshipCredits = false
}) => {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      padding: '0.5rem',
      marginBottom: '0.5rem',
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      borderRadius: '0.5rem',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
      border: '1px solid rgba(229, 231, 235, 0.8)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem'
      }}>
        {/* Rock essence */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.25rem 0.5rem',
          backgroundColor: '#fff9ee',
          borderRadius: '0.5rem',
          boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)'
        }}>
          <span style={{ fontSize: '1rem' }}>✊</span>
          <span style={{ fontWeight: 600, color: '#a6752e' }}>{essences.rock}</span>
        </div>
        
        {/* Paper essence */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.25rem 0.5rem',
          backgroundColor: '#f0faff',
          borderRadius: '0.5rem',
          boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)'
        }}>
          <span style={{ fontSize: '1rem' }}>✋</span>
          <span style={{ fontWeight: 600, color: '#3a7ca8' }}>{essences.paper}</span>
        </div>
        
        {/* Scissors essence */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.25rem 0.5rem',
          backgroundColor: '#f8f5ff',
          borderRadius: '0.5rem',
          boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)'
        }}>
          <span style={{ fontSize: '1rem' }}>✌️</span>
          <span style={{ fontWeight: 600, color: '#8257db' }}>{essences.scissors}</span>
        </div>
        
        {/* Energy credits (only shown for championship players) */}
        {showChampionshipCredits && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.25rem 0.5rem',
            backgroundColor: '#eeffee',
            borderRadius: '0.5rem',
            boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)'
          }}>
            <span style={{ fontSize: '1rem' }}>⚡</span>
            <span style={{ fontWeight: 600, color: '#047857' }}>{championshipEnergyCredits} Credits</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerEssences;