'use client';

import React from 'react';
import { Result } from '../types';

interface StatusBarProps {
  result: Result;
  loadingResult: boolean;
  playerChoice: React.ReactNode;
  computerChoice: React.ReactNode;
  getStatusMessage: () => string;
  getStatusStyle: () => React.CSSProperties;
}

const StatusBar: React.FC<StatusBarProps> = ({
  result,
  loadingResult,
  playerChoice,
  computerChoice,
  getStatusMessage,
  getStatusStyle
}) => {
  // Generate appropriate status message based on game state
  const getMessage = () => {
    if (result && !loadingResult) {
      return getStatusMessage();
    } else if (loadingResult && computerChoice) {
      return "Calculating result...";
    } else if (loadingResult && playerChoice) {
      return "Waiting for opponent...";
    } else if (playerChoice) {
      return "Ready for another round!";
    } else {
      return "Make your move!";
    }
  };

  return (
    <div
      className="w-full py-2 text-center font-medium text-sm rounded-lg z-10 text-white"
      style={{
        ...getStatusStyle(),
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        textShadow: '0 1px 1px rgba(0,0,0,0.2)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Decorative glow effect */}
      <div style={{
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        background: 'linear-gradient(to bottom, rgba(255,255,255,0.15), rgba(255,255,255,0))',
        pointerEvents: 'none',
        zIndex: 0
      }}></div>
      {getMessage()}
    </div>
  );
};

export default StatusBar;