'use client';

import React from 'react';
import { LeaderboardEntry, TierType } from '@/repositories';

interface LeaderboardTableProps {
  leaderboard: LeaderboardEntry[];
  neighborhoodPlayers: LeaderboardEntry[];
  playerId: string;
  getTierColor: (tier: TierType) => string;
}

const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  leaderboard,
  neighborhoodPlayers,
  playerId,
  getTierColor
}) => {
  // Leaderboard table component for displaying championship rankings
  // Ensure we have arrays to work with
  const safeLeaderboard = Array.isArray(leaderboard) ? leaderboard : [];
  const safeNeighborhood = Array.isArray(neighborhoodPlayers) ? neighborhoodPlayers : [];
  
  // Process leaderboard data safely to handle potential undefined values
  
  // Merge and deduplicate entries
  const allEntries = [...safeLeaderboard];
  
  // Add neighborhood players if they're not already in the top entries
  safeNeighborhood.forEach(neighbor => {
    if (!allEntries.some(entry => entry.playerId === neighbor.playerId)) {
      allEntries.push(neighbor);
    }
  });
  
  // Sort by rank
  allEntries.sort((a, b) => a.rank - b.rank);
  
  // All entries merged and sorted by rank for display
  
  // Render medal for top 3 with inline styles
  const renderRankMedal = (rank: number) => {
    switch (rank) {
      case 1:
        return <span style={{ fontSize: '1.25rem' }}>🥇</span>;
      case 2:
        return <span style={{ fontSize: '1.25rem' }}>🥈</span>;
      case 3:
        return <span style={{ fontSize: '1.25rem' }}>🥉</span>;
      default:
        return <span style={{ fontWeight: 600, color: '#4b5563' }}>{rank}</span>;
    }
  };
  
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
  
  // Render the table with completely inline styles (no class names)
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '0.5rem',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      border: '1px solid #e5e7eb',
      overflowX: 'hidden',
      padding: 0,
      marginBottom: '1rem'
    }}>
      <div style={{
        padding: '0.4rem 0.5rem',
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#f8fafc',
      }}>
        <h3 style={{
          fontSize: '0.875rem',
          fontWeight: '600',
          margin: 0,
          color: '#1f2937'
        }}>
          Leaderboard
        </h3>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          backgroundColor: 'white',
          fontSize: '0.75rem' // Global font size reduction
        }}>
          <thead style={{ backgroundColor: '#f3f4f6' }}>
            <tr>
              <th style={{
                padding: '0.4rem 0.5rem',
                textAlign: 'left',
                fontSize: '0.65rem',
                fontWeight: '600',
                color: '#4b5563',
                textTransform: 'uppercase',
                letterSpacing: '0.03em'
              }}>
                #
              </th>
              <th style={{
                padding: '0.4rem 0.5rem',
                textAlign: 'left',
                fontSize: '0.65rem',
                fontWeight: '600',
                color: '#4b5563',
                textTransform: 'uppercase',
                letterSpacing: '0.03em'
              }}>
                Player
              </th>
              <th style={{
                padding: '0.4rem 0.5rem',
                textAlign: 'left',
                fontSize: '0.65rem',
                fontWeight: '600',
                color: '#4b5563',
                textTransform: 'uppercase',
                letterSpacing: '0.03em'
              }}>
                Tier
              </th>
              <th style={{
                padding: '0.4rem 0.5rem',
                textAlign: 'right',
                fontSize: '0.65rem',
                fontWeight: '600',
                color: '#4b5563',
                textTransform: 'uppercase',
                letterSpacing: '0.03em'
              }}>
                Pts
              </th>
            </tr>
          </thead>
          <tbody>
            {allEntries.map((entry) => (
              <tr
                key={entry.playerId}
                style={{
                  backgroundColor: entry.playerId === playerId ? '#eff6ff' : 'white',
                  borderTop: '1px solid #e5e7eb',
                  transition: 'background-color 0.2s ease'
                }}
              >
                <td style={{
                  padding: '0.4rem 0.5rem',
                  whiteSpace: 'nowrap',
                  fontSize: '0.75rem',
                  color: '#374151'
                }}>
                  {renderRankMedal(entry.rank)}
                </td>
                <td style={{
                  padding: '0.4rem 0.5rem',
                  whiteSpace: 'nowrap',
                  fontSize: '0.75rem',
                  color: '#374151'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {entry.playerId === playerId && (
                      <span style={{ marginRight: '0.15rem', color: '#3b82f6', fontSize: '0.7rem' }}>→</span>
                    )}
                    <span style={{
                      fontWeight: entry.playerId === playerId ? '600' : 'normal'
                    }}>
                      {entry.playerName || 'Anonymous'}
                    </span>
                  </div>
                </td>
                <td style={{
                  padding: '0.4rem 0.5rem',
                  whiteSpace: 'nowrap',
                  fontSize: '0.75rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ marginRight: '0.15rem', fontSize: '0.75rem' }}>{getTierBadge(entry.tier)}</span>
                    <span
                      style={{
                        textTransform: 'capitalize',
                        color: getTierColor(entry.tier),
                        fontWeight: '500',
                        fontSize: '0.7rem'
                      }}
                    >
                      {entry.tier}
                    </span>
                  </div>
                </td>
                <td style={{
                  padding: '0.4rem 0.5rem',
                  whiteSpace: 'nowrap',
                  textAlign: 'right',
                  fontWeight: '600',
                  fontSize: '0.75rem',
                  color: '#111827'
                }}>
                  {entry.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{
        padding: '0.35rem 0.5rem',
        fontSize: '0.65rem',
        color: '#6b7280',
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center'
      }}>
        <span>Updated {safeLeaderboard.length > 0 && safeLeaderboard[0].snapshotDate 
          ? new Date(safeLeaderboard[0].snapshotDate).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }) 
          : 'auto'}</span>
      </div>
    </div>
  );
};

export default LeaderboardTable;