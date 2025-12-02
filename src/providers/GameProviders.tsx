'use client';
import { ReactNode } from 'react';
import { EnergyProvider } from '@/contexts/EnergyContext';
import { ElementalEssencesProvider } from '@/contexts/ElementalEssencesContext';
import { SeasonalChampionshipProvider } from '@/contexts/SeasonalChampionshipContext';

interface GameProvidersProps {
  children: ReactNode;
}

/**
 * GameProviders wraps the protected parts of the app with game-specific providers.
 * These providers are only loaded when the user is authenticated and on game-related pages.
 */
export default function GameProviders({
  children,
}: GameProvidersProps) {
  return (
    <EnergyProvider>
      <ElementalEssencesProvider>
        <SeasonalChampionshipProvider>
          {children}
        </SeasonalChampionshipProvider>
      </ElementalEssencesProvider>
    </EnergyProvider>
  );
}