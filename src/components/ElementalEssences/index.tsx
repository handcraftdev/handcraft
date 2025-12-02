'use client';

import { useElementalEssences } from '@/contexts/ElementalEssencesContext';
import { useEffect } from 'react';

export const ElementalEssencesDisplay = () => {
  const { essences, refreshEssences } = useElementalEssences();
  
  // Refresh essences when component mounts
  useEffect(() => {
    refreshEssences();
  }, [refreshEssences]);
  
  // Get color for each element type
  const getElementColor = (type: 'rock' | 'paper' | 'scissors') => {
    switch(type) {
      case 'rock': return '#ffc87c';
      case 'paper': return '#7cd8ff';
      case 'scissors': return '#d8a0ff';
    }
  };
  
  // Get emoji for each element type
  const getElementEmoji = (type: 'rock' | 'paper' | 'scissors') => {
    switch(type) {
      case 'rock': return '✊';
      case 'paper': return '✋';
      case 'scissors': return '✌️';
    }
  };
  
  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-lg shadow-sm overflow-hidden p-3">
      
      <div className="flex justify-between items-center">
        {/* Rock element */}
        <div className="flex-1 flex flex-col items-center mx-1">
          <span role="img" aria-label="Rock" className="text-2xl mb-1" style={{ color: getElementColor('rock') }}>
            {getElementEmoji('rock')}
          </span>
          <span className="text-sm font-bold" style={{ color: getElementColor('rock') }}>
            {essences.isLoading ? "..." : essences.rock}
          </span>
        </div>
        
        {/* Paper element */}
        <div className="flex-1 flex flex-col items-center mx-1">
          <span role="img" aria-label="Paper" className="text-2xl mb-1" style={{ color: getElementColor('paper') }}>
            {getElementEmoji('paper')}
          </span>
          <span className="text-sm font-bold" style={{ color: getElementColor('paper') }}>
            {essences.isLoading ? "..." : essences.paper}
          </span>
        </div>
        
        {/* Scissors element */}
        <div className="flex-1 flex flex-col items-center mx-1">
          <span role="img" aria-label="Scissors" className="text-2xl mb-1" style={{ color: getElementColor('scissors') }}>
            {getElementEmoji('scissors')}
          </span>
          <span className="text-sm font-bold" style={{ color: getElementColor('scissors') }}>
            {essences.isLoading ? "..." : essences.scissors}
          </span>
        </div>
      </div>
      
      <div className="mt-1 text-xs text-center text-gray-500">
        Win with a move to collect its essence.<br />Essence is valuable resources.<br />
        Those who hold the essence will be rewarded.
      </div>
    </div>
  );
};