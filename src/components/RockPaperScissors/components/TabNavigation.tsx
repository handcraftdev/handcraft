'use client';

import React from 'react';
import { Tabs, TabItem } from '@/components/ui/Tabs';

export type TabType = 'play' | 'history' | 'statistics' | 'championship' | 'energy';

interface TabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  showChampionship?: boolean;
  isChampionshipPlayer?: boolean; // Keep original prop name for API compatibility
}

const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  onTabChange,
  showChampionship = false,
  isChampionshipPlayer = false
}) => {
  // Create base tabs
  const baseTabs: TabItem<TabType>[] = [
    { id: 'play', label: 'Play' },
    { id: 'history', label: 'History' },
    { id: 'statistics', label: 'Statistics' },
  ];

  // Add energy tab only for championship players
  if (isChampionshipPlayer) {
    baseTabs.push({ id: 'energy', label: 'Credit', icon: '⚡' });
  }

  // Add championship tab if enabled
  const tabs = showChampionship
    ? [...baseTabs, { id: 'championship' as TabType, label: 'League', icon: '🏆' }]
    : baseTabs;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 5,
        borderTopLeftRadius: '1rem',
        borderTopRightRadius: '1rem',
        overflow: 'hidden',
      }}
    >
      <Tabs
        activeTab={activeTab}
        tabs={tabs}
        onTabChange={onTabChange}
        variant="colored"
      />
    </div>
  );
};

export default TabNavigation;