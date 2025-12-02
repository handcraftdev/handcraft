'use client';

import { Button as WorldButton } from '@worldcoin/mini-apps-ui-kit-react';
import { clsx } from 'clsx';
import { forwardRef } from 'react';
import { twMerge } from 'tailwind-merge';

// Simplified props to avoid type conflicts
interface WorldButtonProps {
  // Core props
  fullWidth?: boolean;
  className?: string;
  variant?: string;
  size?: string;
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  children?: React.ReactNode;
  type?: 'button' | 'submit' | 'reset';
  [key: string]: any; // Allow any additional props
}

/**
 * WorldButton is a wrapper around the WorldCoin UI Kit Button
 * that ensures consistent styling with our theme
 */
const StyledWorldButton = forwardRef<HTMLButtonElement, WorldButtonProps>(
  ({ variant = 'primary', size = 'md', fullWidth, className, ...props }, ref) => {
    // Map variant names if needed for consistency
    const mappedVariant = variant === 'default' ? 'primary' : variant;

    return (
      <WorldButton
        variant={mappedVariant}
        size={size}
        className={twMerge(
          clsx({
            'w-full': fullWidth,
          }),
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

StyledWorldButton.displayName = 'WorldButton';

export { StyledWorldButton as WorldButton };