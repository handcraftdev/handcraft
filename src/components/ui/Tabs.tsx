'use client';

import React from 'react';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: string;
}

interface TabsProps<T extends string> {
  activeTab: T;
  tabs: TabItem<T>[];
  onTabChange: (tab: T) => void;
  variant?: 'default' | 'colored' | 'league';
}

/**
 * A reusable Tabs component that supports different styling variants:
 * - default: Basic tabs with consistent color scheme
 * - colored: Each tab has a different color (like the RockPaperScissors game)
 * - league: Styled like the League tabs with blue accent and pastel theme
 */
export function Tabs<T extends string>({ 
  activeTab, 
  tabs, 
  onTabChange, 
  variant = 'default'
}: TabsProps<T>) {
  // Colors for each tab in "colored" variant
  const getTabColors = (index: number) => {
    const colors = [
      { active: '#2d9d78', border: '#25876a', text: 'white' }, // Green
      { active: '#3b7dd8', border: '#3269b7', text: 'white' }, // Blue
      { active: '#e67e22', border: '#d35400', text: 'white' }, // Orange
      { active: '#8e44ad', border: '#7d3c98', text: 'white' }, // Purple
      { active: '#e74c3c', border: '#c0392b', text: 'white' }, // Red
    ];

    return colors[index % colors.length];
  };

  // Styles for the League variant
  const leagueStyles = {
    tabContainer: {
      display: 'flex',
      borderBottom: '1px solid #e2e8f0',
      marginBottom: '0.5rem',
      backgroundColor: '#f8fafc',
      borderRadius: '0.5rem 0.5rem 0 0',
      overflow: 'hidden',
    },
    tab: (isActive: boolean) => ({
      flex: 1,
      padding: '0.35rem 0',
      fontSize: '0.75rem',
      fontWeight: isActive ? '600' : '500',
      textAlign: 'center' as const,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      border: 'none',
      borderBottom: isActive ? '2px solid #3b82f6' : 'none',
      backgroundColor: isActive ? '#eff6ff' : 'transparent',
      color: isActive ? '#3b82f6' : '#64748b',
    }),
  };

  // Default styles
  const defaultStyles = {
    tabContainer: {
      display: 'flex',
      borderBottom: '1px solid #e0e0e0',
      position: 'relative' as const,
      zIndex: 5,
      borderTopLeftRadius: '0.5rem',
      borderTopRightRadius: '0.5rem',
      overflow: 'hidden',
    },
    tab: (isActive: boolean) => ({
      flex: 1,
      padding: '0.35rem 0',
      backgroundColor: isActive ? '#6e36b5' : '#f0f0f0',
      color: isActive ? 'white' : '#333',
      border: 'none',
      borderBottom: isActive ? '2px solid #5d28a8' : 'none',
      fontWeight: isActive ? 600 : 400,
      fontSize: '0.75rem',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      position: 'relative' as const,
      boxShadow: isActive ? 'inset 0 -1px 3px rgba(0,0,0,0.15)' : 'none',
      letterSpacing: '0.01em',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
  };

  // Return the appropriate styling based on the variant
  const getStyles = () => {
    switch (variant) {
      case 'league':
        return leagueStyles;
      case 'default':
        return defaultStyles;
      case 'colored':
        return defaultStyles; // We'll modify the tab colors in the render loop
      default:
        return defaultStyles;
    }
  };

  const styles = getStyles();

  return (
    <div style={styles.tabContainer}>
      {tabs.map((tab, index) => {
        const isActive = activeTab === tab.id;
        
        // Base styles from the selected variant
        let tabStyle = styles.tab(isActive);
        
        // For colored variant, override with specific colors
        if (variant === 'colored') {
          const colors = getTabColors(index);
          tabStyle = {
            ...tabStyle,
            backgroundColor: isActive ? colors.active : '#f0f0f0',
            color: isActive ? colors.text : '#333',
            borderBottom: isActive ? `2px solid ${colors.border}` : 'none',
          };
        }

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={tabStyle}
          >
            {tab.icon && (
              <span style={{ marginRight: '0.25rem', fontSize: '0.85rem' }}>
                {tab.icon}
              </span>
            )}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}