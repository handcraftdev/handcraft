'use client';

import React, { useState } from 'react';
import { useSeasonalChampionship } from '@/contexts/SeasonalChampionshipContext';
import { useElementalEssences } from '@/contexts/ElementalEssencesContext';
import { useEnergy } from '@/contexts/EnergyContext';
import { TierType } from '@/repositories';
import { Tabs } from '@/components/ui/Tabs';

// All styles now using inline styling - no need for external CSS

// Sub-components
import SeasonHeader from './SeasonHeader';
import LeaderboardTable from './LeaderboardTable';
import EntryTicketPurchase from './EntryTicketPurchase';
// Import is kept but marked as unused
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import ReserveEnergyPurchase from './ReserveEnergyPurchase';
import PlayerStatsCard from './PlayerStatsCard';
import SeasonCountdown from './SeasonCountdown';

// Tab types
type LeagueMainTabType = 'current' | 'history';
type LeagueSubTabType = 'leaderboard' | 'rewards';

export const SeasonalChampionship: React.FC = () => {
  // State for tab navigation
  const [activeMainTab, setActiveMainTab] = useState<LeagueMainTabType>('current');
  const [activeSubTab, setActiveSubTab] = useState<LeagueSubTabType>('leaderboard');
  
  // Access contexts
  const {
    currentSeason,
    isLoading,
    playerStats,
    leaderboard,
    neighborhoodPlayers,
    playerRank,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    refreshData,
    purchaseEntryTicket,
    purchaseReserveEnergy
  } = useSeasonalChampionship();

  const { essences } = useElementalEssences();
  const { energy } = useEnergy();

  // Championship component managing league data display and user interactions
  
  // Handle tab changes
  const handleMainTabChange = (tab: LeagueMainTabType) => {
    setActiveMainTab(tab);
  };
  
  const handleSubTabChange = (tab: LeagueSubTabType) => {
    setActiveSubTab(tab);
  };
  
  // Handle entry ticket purchase
  const handlePurchaseEntryTicket = async (): Promise<boolean> => {
    const success = await purchaseEntryTicket();
    if (success) {
      // Refresh data is called inside purchaseEntryTicket
      // Entry ticket purchased successfully
      return true;
    } else {
      // Failed to purchase entry ticket
      return false;
    }
  };
  
  // Handle reserve energy purchase
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handlePurchaseReserveEnergy = async (size: 'small' | 'medium' | 'large') => {
    const success = await purchaseReserveEnergy(size);
    if (success) {
      // Refresh data is called inside purchaseReserveEnergy
      // Reserve energy purchased successfully
    } else {
      // Failed to purchase reserve energy
    }
  };
  
  // Get tier color
  const getTierColor = (tier: TierType): string => {
    switch (tier) {
      case 'bronze': return '#CD7F32';
      case 'silver': return '#C0C0C0';
      case 'gold': return '#FFD700';
      case 'platinum': return '#E5E4E2';
      case 'diamond': return '#B9F2FF';
      default: return '#CCCCCC';
    }
  };
  
  // Custom keyframes for spinner animation
  const spinKeyframes = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;

  // Render loading state
  if (isLoading) {
    return (
      <div style={{
        padding: '1rem',
        textAlign: 'center',
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <style dangerouslySetInnerHTML={{ __html: spinKeyframes }} />
        <div style={{
          width: '2.5rem',
          height: '2.5rem',
          borderRadius: '50%',
          border: '2px solid #e5e7eb',
          borderTopColor: '#3b82f6',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 1rem'
        }}></div>
        <p>Loading league data...</p>
      </div>
    );
  }

  // No need to return early here - we'll use conditional rendering instead to allow History tab to be shown
  
  // Render entry ticket purchase for non-participants
  const renderEntryTicketPurchase = () => {
    // Only render if we have a valid season
    if (!currentSeason) {
      return (
        <div style={{ 
          padding: '1rem', 
          background: '#f9fafb', 
          borderRadius: '0.5rem',
          textAlign: 'center',
          color: '#6b7280'
        }}>
          No active league season available.
        </div>
      );
    }
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <EntryTicketPurchase
          season={currentSeason}
          onPurchase={handlePurchaseEntryTicket}
          essences={{
            rockEssence: essences.rock,
            paperEssence: essences.paper,
            scissorsEssence: essences.scissors
          }}
        />
      </div>
    );
  };

  // Render leaderboard tab content
  const renderLeaderboardContent = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Player stats card with tier progress */}
        <PlayerStatsCard
          playerStats={playerStats}
          playerRank={playerRank}
          reserveEnergy={playerStats?.reserveEnergy || 0}
          energy={energy}
        />

        {/* Leaderboard table */}
        <LeaderboardTable
          leaderboard={leaderboard || []}
          neighborhoodPlayers={neighborhoodPlayers || []}
          playerId={playerStats?.playerId || ''}
          getTierColor={getTierColor}
        />
      </div>
    );
  };

  // Render rewards tab content
  const renderRewardsContent = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {/* Legend/Key for rewards */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          padding: '0.4rem 0.6rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.65rem',
          color: '#4b5563'
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ fontWeight: '600', color: '#1e40af', marginRight: '0.4rem' }}>Rewards:</span>
            <span style={{ display: 'flex', alignItems: 'center', marginRight: '0.5rem' }}>
              <span style={{ color: '#a21caf', fontWeight: '500', marginRight: '0.2rem' }}>🪨</span>Rock
            </span>
            <span style={{ display: 'flex', alignItems: 'center', marginRight: '0.5rem' }}>
              <span style={{ color: '#0369a1', fontWeight: '500', marginRight: '0.2rem' }}>📄</span>Paper
            </span>
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ color: '#65a30d', fontWeight: '500', marginRight: '0.2rem' }}>✂️</span>Scissors
            </span>
          </div>
          <span style={{ 
            padding: '0.15rem 0.3rem', 
            backgroundColor: '#f0f9ff', 
            borderRadius: '0.25rem',
            color: '#0369a1',
            fontSize: '0.6rem',
            fontWeight: '500'
          }}>End of season</span>
        </div>

        {/* Main rewards card */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          padding: '0.5rem 0.75rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #f0f0f0',
            paddingBottom: '0.35rem',
            marginBottom: '0.5rem'
          }}>
            <h3 style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              margin: 0,
              color: '#1e40af'
            }}>Season Rewards</h3>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: '0.65rem',
              color: '#6b7280',
              backgroundColor: '#f9fafb',
              padding: '0.15rem 0.3rem',
              borderRadius: '0.25rem',
            }}>
              <span style={{ marginRight: '0.2rem', color: '#0284c7' }}>🧪</span>
              <span>Elemental Essence</span>
            </div>
          </div>

          <div style={{ marginBottom: '0.5rem' }}>
            {/* Top Players - More compact with essence description */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.35rem',
              marginBottom: '0.5rem'
            }}>
              <div style={{
                padding: '0.4rem',
                borderRadius: '0.35rem',
                border: '1px solid #fef3c7',
                background: 'linear-gradient(to bottom, #fffbeb, #fef3c7)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#b45309', marginBottom: '0.15rem' }}>🥇 1st Place</div>
                <div style={{ 
                  fontSize: '0.7rem', 
                  display: 'flex', 
                  flexDirection: 'column' 
                }}>
                  <span style={{ fontWeight: '500', color: '#1e3a8a' }}>100× each essence</span>
                  <span style={{ fontSize: '0.6rem', color: '#6b7280', marginTop: '0.1rem' }}>Champion Title Badge</span>
                </div>
              </div>
              <div style={{
                padding: '0.4rem',
                borderRadius: '0.35rem',
                border: '1px solid #e5e7eb',
                background: 'linear-gradient(to bottom, #f9fafb, #f3f4f6)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#4b5563', marginBottom: '0.15rem' }}>🥈 2nd Place</div>
                <div style={{ 
                  fontSize: '0.7rem', 
                  display: 'flex', 
                  flexDirection: 'column' 
                }}>
                  <span style={{ fontWeight: '500', color: '#1e3a8a' }}>75× each essence</span>
                  <span style={{ fontSize: '0.6rem', color: '#6b7280', marginTop: '0.1rem' }}>Runner-up Title Badge</span>
                </div>
              </div>
              <div style={{
                padding: '0.4rem',
                borderRadius: '0.35rem',
                border: '1px solid #fcd34d',
                background: 'linear-gradient(to bottom, #fef3c7, #fde68a)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#92400e', marginBottom: '0.15rem' }}>🥉 3rd Place</div>
                <div style={{ 
                  fontSize: '0.7rem', 
                  display: 'flex', 
                  flexDirection: 'column' 
                }}>
                  <span style={{ fontWeight: '500', color: '#1e3a8a' }}>50× each essence</span>
                  <span style={{ fontSize: '0.6rem', color: '#6b7280', marginTop: '0.1rem' }}>Finalist Title Badge</span>
                </div>
              </div>
            </div>

            {/* Tier description */}
            <div style={{
              fontSize: '0.65rem',
              color: '#4b5563',
              textAlign: 'center',
              marginBottom: '0.4rem',
              backgroundColor: '#f9fafb',
              padding: '0.2rem 0.3rem',
              borderRadius: '0.25rem',
              border: '1px solid #f0f0f0'
            }}>
              <span style={{ fontWeight: '500' }}>Tier rewards based on your final season rank</span>
            </div>

            {/* Tier Rewards - More compact with essence clarification */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(5, 1fr)', 
              gap: '0.25rem',
              fontSize: '0.65rem'
            }}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '0.3rem',
                borderRadius: '0.25rem',
                backgroundColor: 'rgba(185,242,255,0.2)',
                borderTop: `2px solid ${getTierColor('diamond')}`
              }}>
                <div style={{ fontWeight: '600', display: 'flex', alignItems: 'center' }}>
                  <span style={{ marginRight: '0.15rem', fontSize: '0.7rem' }}>💠</span>
                  Diamond
                </div>
                <div style={{ fontWeight: '500', color: '#1e3a8a' }}>40× each</div>
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '0.3rem',
                borderRadius: '0.25rem',
                backgroundColor: 'rgba(229,228,226,0.2)',
                borderTop: `2px solid ${getTierColor('platinum')}`
              }}>
                <div style={{ fontWeight: '600', display: 'flex', alignItems: 'center' }}>
                  <span style={{ marginRight: '0.15rem', fontSize: '0.7rem' }}>💎</span>
                  Platinum
                </div>
                <div style={{ fontWeight: '500', color: '#1e3a8a' }}>30× each</div>
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '0.3rem',
                borderRadius: '0.25rem',
                backgroundColor: 'rgba(255,215,0,0.2)',
                borderTop: `2px solid ${getTierColor('gold')}`
              }}>
                <div style={{ fontWeight: '600', display: 'flex', alignItems: 'center' }}>
                  <span style={{ marginRight: '0.15rem', fontSize: '0.7rem' }}>🥇</span>
                  Gold
                </div>
                <div style={{ fontWeight: '500', color: '#1e3a8a' }}>20× each</div>
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '0.3rem',
                borderRadius: '0.25rem',
                backgroundColor: 'rgba(192,192,192,0.2)',
                borderTop: `2px solid ${getTierColor('silver')}`
              }}>
                <div style={{ fontWeight: '600', display: 'flex', alignItems: 'center' }}>
                  <span style={{ marginRight: '0.15rem', fontSize: '0.7rem' }}>🥈</span>
                  Silver
                </div>
                <div style={{ fontWeight: '500', color: '#1e3a8a' }}>10× each</div>
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '0.3rem',
                borderRadius: '0.25rem',
                backgroundColor: 'rgba(205,127,50,0.2)',
                borderTop: `2px solid ${getTierColor('bronze')}`
              }}>
                <div style={{ fontWeight: '600', display: 'flex', alignItems: 'center' }}>
                  <span style={{ marginRight: '0.15rem', fontSize: '0.7rem' }}>🥉</span>
                  Bronze
                </div>
                <div style={{ fontWeight: '500', color: '#1e3a8a' }}>5× each</div>
              </div>
            </div>
          </div>

          <div style={{ 
            fontSize: '0.6rem', 
            color: '#6b7280', 
            textAlign: 'center',
            padding: '0.25rem',
            backgroundColor: '#f9fafb',
            borderRadius: '0.25rem'
          }}>
            Essence powers special moves & can be used for in-game purchases
          </div>
        </div>
      </div>
    );
  };

  // Render history view (for past seasons)
  const renderHistoryContent = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📜</div>
          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: 600,
            marginBottom: '0.5rem',
            color: '#1e40af'
          }}>Season History</h3>
          <p style={{ color: '#6b7280' }}>
            This is the first season! History will be available after the season ends.
          </p>
        </div>
      </div>
    );
  };

  // Render no active season message
  const renderNoActiveSeason = () => {
    return (
      <div style={{
        padding: '1rem',
        textAlign: 'center',
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🏆</div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>No Active Season</h2>
        <p style={{ color: '#4b5563', marginBottom: '1rem' }}>
          There is currently no active league season.
          Check back later for the next league!
        </p>
      </div>
    );
  };

  // Render content based on the tab selections
  const renderContent = () => {
    // Handle History tab first - it should be accessible regardless of season status
    if (activeMainTab === 'history') {
      return renderHistoryContent();
    }

    // For the Current tab - handle different states
    if (activeMainTab === 'current') {
      // If no active season, show the no active season message
      if (!currentSeason) {
        return renderNoActiveSeason();
      }
      
      // If player doesn't have entry ticket, show purchase option
      if (!playerStats || !playerStats.hasEntryTicket) {
        return renderEntryTicketPurchase();
      }
      
      // For users with entry tickets, handle sub-tabs
      switch (activeSubTab) {
        case 'leaderboard':
          return renderLeaderboardContent();
        case 'rewards':
          return renderRewardsContent();
        default:
          return renderLeaderboardContent();
      }
    }
    
    return null;
  };
  
  return (
    <div style={{
      width: '100%',
      maxWidth: '28rem',
      marginLeft: 'auto',
      marginRight: 'auto',
      marginTop: '0.75rem',
      marginBottom: '0.75rem'
    }}>
      {/* Main tab navigation - always shown regardless of season status */}
      <div style={{ marginBottom: '0.5rem' }}>
        <Tabs
          activeTab={activeMainTab}
          tabs={[
            { id: 'current', label: 'Current', icon: '🏆' },
            { id: 'history', label: 'History', icon: '📜' }
          ]}
          onTabChange={handleMainTabChange}
          variant="league"
        />
      </div>

      {/* Only show SeasonHeader and sub-tabs if on Current tab, there's an active season, and player has entry ticket */}
      {activeMainTab === 'current' && currentSeason && playerStats && playerStats.hasEntryTicket && (
        <>
          <SeasonHeader
            season={currentSeason}
            playerRank={playerRank}
          />

          {/* Centralized Season Countdown only shown for players with entry tickets */}
          <SeasonCountdown
            endDate={currentSeason.endDate}
          />
          
          {/* Sub-tab navigation for current league */}
          <div style={{ marginBottom: '0.5rem', marginTop: '0.5rem' }}>
            <Tabs
              activeTab={activeSubTab}
              tabs={[
                { id: 'leaderboard', label: 'Leaderboard' },
                { id: 'rewards', label: 'Rewards' }
              ]}
              onTabChange={handleSubTabChange}
              variant="league"
            />
          </div>
        </>
      )}

      {/* Render the content based on selected tabs */}
      {renderContent()}
    </div>
  );
};

export default SeasonalChampionship;