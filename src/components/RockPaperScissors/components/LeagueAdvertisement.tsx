import React from 'react';

interface LeagueAdvertisementProps {
  seasonNumber: number;
  seasonName: string;
  onJoinLeague: () => void;
}

const LeagueAdvertisement: React.FC<LeagueAdvertisementProps> = ({
  seasonNumber,
  seasonName,
  onJoinLeague
}) => {
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.9) 0%, rgba(67, 56, 202, 0.9) 100%)',
      borderRadius: '0.75rem',
      padding: '1rem',
      color: 'white',
      boxShadow: '0 4px 12px -1px rgba(79, 70, 229, 0.4), 0 2px 6px -1px rgba(79, 70, 229, 0.3)',
      position: 'relative',
      overflow: 'hidden',
      marginBottom: '1rem',
      border: '2px solid rgba(122, 104, 255, 0.8)'
    }}>
      {/* Decorative background element */}
      <div style={{
        position: 'absolute',
        top: '-20px',
        right: '-20px',
        width: '100px',
        height: '100px',
        background: 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 70%)',
        opacity: 0.3,
        borderRadius: '50%',
        zIndex: 1
      }}></div>
      
      {/* Season header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '0.5rem'
      }}>
        <span style={{
          fontSize: '1.25rem',
          fontWeight: 'bold'
        }}>🏆</span>
        <h3 style={{
          fontSize: '1.125rem',
          fontWeight: 'bold',
          margin: 0
        }}>Season {seasonNumber}: {seasonName}</h3>
      </div>
      
      {/* Description */}
      <p style={{
        fontSize: '0.9rem',
        marginBottom: '0.75rem',
        lineHeight: 1.4
      }}>
        Join the League now to compete for rewards! Earn points, rise through the ranks, and unlock energy credits.
      </p>

      {/* Benefits grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '0.5rem',
        marginBottom: '0.75rem'
      }}>
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          padding: '0.5rem',
          borderRadius: '0.375rem',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '0.875rem',
            fontWeight: 'bold',
            marginBottom: '0.125rem'
          }}>⚡ Energy Credits</div>
          <div style={{
            fontSize: '0.75rem'
          }}>Play more games</div>
        </div>
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          padding: '0.5rem',
          borderRadius: '0.375rem',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '0.875rem',
            fontWeight: 'bold',
            marginBottom: '0.125rem'
          }}>🏅 Rank Up</div>
          <div style={{
            fontSize: '0.75rem'
          }}>Compete on leaderboard</div>
        </div>
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          padding: '0.5rem',
          borderRadius: '0.375rem',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '0.875rem',
            fontWeight: 'bold',
            marginBottom: '0.125rem'
          }}>🎁 Rewards</div>
          <div style={{
            fontSize: '0.75rem'
          }}>Win special items</div>
        </div>
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          padding: '0.5rem',
          borderRadius: '0.375rem',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '0.875rem',
            fontWeight: 'bold',
            marginBottom: '0.125rem'
          }}>🔥 Top Player Prize</div>
          <div style={{
            fontSize: '0.75rem'
          }}>More rewards for top players</div>
        </div>
      </div>
      
      {/* Call to action button */}
      <button
        onClick={onJoinLeague}
        style={{
          backgroundColor: 'white',
          color: '#4f46e5',
          border: 'none',
          padding: '0.75rem 1rem',
          borderRadius: '0.5rem',
          fontWeight: 'bold',
          fontSize: '1rem',
          cursor: 'pointer',
          boxShadow: '0 2px 5px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          transition: 'all 0.2s ease',
          position: 'relative',
          overflow: 'hidden'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
        }}
      >
        <span style={{ marginRight: '0.5rem', fontSize: '1.2rem' }}>🏆</span>
        Join League Now!
        <span style={{ marginLeft: '0.5rem' }}>→</span>
      </button>
    </div>
  );
};

export default LeagueAdvertisement;