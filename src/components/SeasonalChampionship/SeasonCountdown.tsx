'use client';

import React, { useState, useEffect } from 'react';

interface SeasonCountdownProps {
  endDate: Date;
}

const SeasonCountdown: React.FC<SeasonCountdownProps> = ({ endDate }) => {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });
  
  useEffect(() => {
    // Function to calculate time left
    const calculateTimeLeft = () => {
      const difference = +new Date(endDate) - +new Date();
      
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        });
      } else {
        // Season has ended
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };
    
    // Initial calculation
    calculateTimeLeft();
    
    // Set up interval to update countdown
    const timer = setInterval(calculateTimeLeft, 1000);
    
    // Clean up interval on unmount
    return () => clearInterval(timer);
  }, [endDate]);
  
  return (
    <div style={{
      backgroundColor: '#eff6ff',
      border: '1px solid #dbeafe',
      borderRadius: '0.375rem',
      padding: '0.5rem 0.5rem 0.35rem',
      marginBottom: '0.5rem',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '0.7rem', color: '#3b82f6', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
        Season Ends In
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.25rem', textAlign: 'center' }}>
        <div style={{ backgroundColor: '#dbeafe', borderRadius: '0.25rem', padding: '0.25rem 0.15rem' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e40af', lineHeight: '1.2' }}>{timeLeft.days}</div>
          <div style={{ fontSize: '0.65rem', color: '#3b82f6', lineHeight: '1.2' }}>Days</div>
        </div>
        <div style={{ backgroundColor: '#dbeafe', borderRadius: '0.25rem', padding: '0.25rem 0.15rem' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e40af', lineHeight: '1.2' }}>{timeLeft.hours}</div>
          <div style={{ fontSize: '0.65rem', color: '#3b82f6', lineHeight: '1.2' }}>Hours</div>
        </div>
        <div style={{ backgroundColor: '#dbeafe', borderRadius: '0.25rem', padding: '0.25rem 0.15rem' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e40af', lineHeight: '1.2' }}>{timeLeft.minutes}</div>
          <div style={{ fontSize: '0.65rem', color: '#3b82f6', lineHeight: '1.2' }}>Min</div>
        </div>
        <div style={{ backgroundColor: '#dbeafe', borderRadius: '0.25rem', padding: '0.25rem 0.15rem' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e40af', lineHeight: '1.2' }}>{timeLeft.seconds}</div>
          <div style={{ fontSize: '0.65rem', color: '#3b82f6', lineHeight: '1.2' }}>Sec</div>
        </div>
      </div>
    </div>
  );
};

export default SeasonCountdown;