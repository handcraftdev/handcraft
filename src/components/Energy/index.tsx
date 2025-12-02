'use client';

import { useEffect, useState } from 'react';
import { useEnergy } from '@/contexts/EnergyContext';

interface EnergyProps {
  variant?: 'default' | 'compact';
  className?: string;
}

export const Energy = ({ variant = 'default', className = '' }: EnergyProps) => {
  const { energy, maxEnergy, timeUntilNextEnergy, isLoading } = useEnergy();
  const [formattedTime, setFormattedTime] = useState<string>('');
  
  // Format the time for display
  useEffect(() => {
    if (timeUntilNextEnergy === null) {
      setFormattedTime('');
      return;
    }
    
    const formatTime = (ms: number): string => {
      if (ms <= 0) return 'Ready';
      
      const seconds = Math.floor((ms / 1000) % 60);
      const minutes = Math.floor((ms / (1000 * 60)) % 60);
      
      return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };
    
    setFormattedTime(formatTime(timeUntilNextEnergy));
  }, [timeUntilNextEnergy]);
  
  if (variant === 'compact') {
    // Compact view - just show energy as icon and number
    return (
      <div className={`flex items-center ${className}`} style={{
        padding: '0.25rem 0.5rem',
        borderRadius: '9999px',
        backgroundColor: '#f0f0f0',
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
        // iOS Safari specific fixes
        minWidth: '2.8rem',
        maxHeight: '1.6rem',
        zIndex: 1,
        marginRight: '0.35rem'
      }}>
        <span role="img" aria-label="Energy" style={{
          fontSize: '0.875rem',
          marginRight: '0.25rem',
          display: 'inline-flex'
        }}>⚡</span>
        {isLoading ? (
          <span style={{ fontWeight: '600', fontSize: '0.8rem' }}>...</span>
        ) : (
          <span style={{ fontWeight: '600', fontSize: '0.8rem', lineHeight: 1 }}>{energy}/{maxEnergy}</span>
        )}
      </div>
    );
  }
  
  // Default view with progress bar
  return (
    <div className={`flex flex-col items-center ${className}`} style={{
      marginBottom: '0.75rem',
      backgroundColor: '#f0f0f0',
      borderRadius: '0.5rem',
      padding: '0.5rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '0.25rem'
      }}>
        <div style={{
          fontSize: '0.75rem',
          fontWeight: '600',
          color: '#6e36b5',
          marginRight: '0.5rem'
        }}>
          Energy
        </div>
        
        {isLoading ? (
          <div style={{ fontSize: '0.75rem', color: '#777' }}>Loading...</div>
        ) : (
          <div style={{
            display: 'flex',
            gap: '0.25rem'
          }}>
            {Array.from({ length: maxEnergy }).map((_, i) => (
              <div 
                key={i}
                style={{
                  width: '0.75rem',
                  height: '0.75rem',
                  borderRadius: '50%',
                  backgroundColor: i < energy ? '#ffdc5c' : '#e0e0e0',
                  boxShadow: i < energy ? '0 0 3px rgba(255, 220, 92, 0.6)' : 'none',
                  transition: 'all 0.3s ease'
                }}
              />
            ))}
          </div>
        )}
      </div>
      
      {!isLoading && timeUntilNextEnergy !== null && (
        <div style={{
          fontSize: '0.65rem',
          color: '#777',
          textAlign: 'center'
        }}>
          Next energy in: {formattedTime}
        </div>
      )}
    </div>
  );
};