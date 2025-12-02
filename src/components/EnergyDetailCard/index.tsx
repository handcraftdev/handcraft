'use client';

import { useEffect, useState } from 'react';
import { useEnergy } from '@/contexts/EnergyContext';
import { useSession } from 'next-auth/react';

export const EnergyDetailCard = () => {
  const { data: session } = useSession();
  const { energy, maxEnergy, timeUntilNextEnergy, isLoading, refreshEnergy } = useEnergy();
  const [formattedTime, setFormattedTime] = useState<string>('');
  
  // Format the time for display in MM:SS format
  useEffect(() => {
    if (timeUntilNextEnergy === null) {
      setFormattedTime('');
      return;
    }
    
    const updateFormattedTime = (ms: number) => {
      if (ms <= 0) {
        setFormattedTime('Ready');
        return;
      }
      
      const seconds = Math.floor((ms / 1000) % 60);
      const minutes = Math.floor((ms / (1000 * 60)) % 60);
      
      setFormattedTime(`${minutes}:${seconds < 10 ? '0' : ''}${seconds}`);
    };
    
    // Initial update
    updateFormattedTime(timeUntilNextEnergy);
    
    // Update every second
    const interval = setInterval(() => {
      if (timeUntilNextEnergy > 0) {
        const remaining = timeUntilNextEnergy - 1000;
        if (remaining <= 0) {
          refreshEnergy();
        } else {
          updateFormattedTime(remaining);
        }
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [timeUntilNextEnergy, refreshEnergy]);
  
  // Determine status text
  const getStatusText = () => {
    if (energy === maxEnergy) return 'Full';
    if (energy === 0) return 'Empty';
    if (timeUntilNextEnergy !== null) return 'Replenishing';
    return 'Ready';
  };
  
  // Determine color based on energy level
  const getEnergyColor = () => {
    if (energy === maxEnergy) return '#4ade80'; // Green for full
    if (energy <= 1) return '#ef4444'; // Red for critical
    if (energy <= 3) return '#f97316'; // Orange for low
    return '#ffdc5c'; // Yellow for normal
  };
  
  // If not logged in or loading, return minimal component
  if (!session || isLoading) {
    return null;
  }
  
  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-lg shadow-sm overflow-hidden p-3">
      {/* Single line with all elements */}
      <div className="flex items-center justify-between">
        {/* Left side: Energy icon, energy buttons, and count */}
        <div className="flex items-center">
          <span role="img" aria-label="Energy" className="text-lg mr-2">⚡</span>
          
          {/* Energy dots as buttons in a line */}
          <div className="flex space-x-1 mr-2">
            {Array.from({ length: maxEnergy }).map((_, i) => (
              <div 
                key={i}
                className="transition-all duration-300"
                style={{
                  width: '0.75rem',
                  height: '0.75rem',
                  borderRadius: '50%',
                  backgroundColor: i < energy ? getEnergyColor() : '#e0e0e0',
                  boxShadow: i < energy ? `0 0 4px ${getEnergyColor()}90` : 'none',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: i < energy ? getEnergyColor() : '#d0d0d0',
                }}
              />
            ))}
          </div>
          
          <span className="text-xs font-medium text-gray-700">
            {energy}/{maxEnergy}
          </span>
        </div>
        
        {/* Right side: Status and timer */}
        <div className="flex items-center">
          {/* Timer */}
          {timeUntilNextEnergy !== null && (
            <div className="flex items-center mr-2">
              <span className="text-xs font-medium" style={{ color: getEnergyColor() }}>
                {formattedTime}
              </span>
            </div>
          )}
          
          {/* Status label */}
          <span className="text-xs font-medium px-2 py-0.5 rounded" style={{
            color: getEnergyColor(),
            backgroundColor: `${getEnergyColor()}15`,
            border: `1px solid ${getEnergyColor()}30`,
          }}>
            {getStatusText()}
          </span>
        </div>
      </div>
    </div>
  );
};