'use client';

import React from 'react';

interface GameHeaderProps {
  title: string;
}

const GameHeader: React.FC<GameHeaderProps> = ({ title }) => {
  return (
    <div 
      style={{
        position: 'absolute',
        top: '-1.9rem',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#6e36b5',
        backgroundImage: 'linear-gradient(135deg, #6e36b5 0%, #8243d8 100%)',
        borderRadius: '1.5rem',
        padding: '0.5rem 1.5rem',
        zIndex: 1, /* Lower z-index to appear behind tabs */
        borderColor: '#8243d8',
        borderWidth: '2px',
        borderStyle: 'solid',
        boxShadow: '0 4px 10px -1px rgba(0,0,0,0.3)',
        minWidth: '60%',
        textAlign: 'center'
      }}
    >
      <h2 style={{
        fontSize: '1.1rem',
        fontWeight: '700',
        color: 'white',
        textShadow: '0 1px 2px rgba(0,0,0,0.2)',
        letterSpacing: '0.03em',
        margin: 0,
        lineHeight: '1.5rem'
      }}>
        {title}
      </h2>
    </div>
  );
};

export default GameHeader;