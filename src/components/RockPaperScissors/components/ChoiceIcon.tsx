'use client';

import { clsx } from 'clsx';

// Types
type Choice = 'rock' | 'paper' | 'scissors';

type ChoiceIconProps = {
  choice: Choice | null;
  size?: 'md' | 'lg' | 'xl';
};

// Choice icons for visual representation
export const ChoiceIcon = ({ choice, size = 'lg' }: ChoiceIconProps) => {
  if (!choice) return null;
  
  const icons = {
    rock: '✊',
    paper: '✋',
    scissors: '✌️',
  };

  const sizeClasses = {
    md: 'text-3xl',
    lg: 'text-5xl',
    xl: 'text-7xl',
  };
  
  return (
    <span 
      className={clsx(sizeClasses[size], "transition-all duration-300")} 
      role="img" 
      aria-label={choice}
    >
      {icons[choice]}
    </span>
  );
};

export default ChoiceIcon;