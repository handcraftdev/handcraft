'use client';

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

// Default values
export const MAX_ENERGY = 10;

interface EnergyContextType {
  energy: number;
  maxEnergy: number;
  timeUntilNextEnergy: number | null;
  isLoading: boolean;
  consumeEnergy: (amount?: number) => Promise<boolean>;
  refreshEnergy: () => Promise<void>;
}

const EnergyContext = createContext<EnergyContextType | undefined>(undefined);

export const EnergyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: session } = useSession();
  const [energy, setEnergy] = useState<number>(MAX_ENERGY);
  const [maxEnergy, setMaxEnergy] = useState<number>(MAX_ENERGY);
  const [timeUntilNextEnergy, setTimeUntilNextEnergy] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Track in-flight requests to prevent duplicates
  const requestInProgress = React.useRef<Promise<void> | null>(null);
  const lastRequestTime = React.useRef<number>(0);
  const MIN_REQUEST_INTERVAL = 5000; // 5 seconds minimum between requests

  // Refresh energy data from the server
  const refreshEnergy = useCallback(async () => {
    // Check if session is available and if the user is authenticated
    if (!session || !session.user) {
      // If not logged in, use default values
      setEnergy(MAX_ENERGY);
      setMaxEnergy(MAX_ENERGY);
      setTimeUntilNextEnergy(null);
      setIsLoading(false);
      return;
    }

    // If a request is already in progress, wait for it to complete
    if (requestInProgress.current) {
      console.log('Energy data refresh already in progress, waiting...');
      await requestInProgress.current;
      return;
    }

    // Throttle requests to prevent excessive API calls
    const now = Date.now();
    if (now - lastRequestTime.current < MIN_REQUEST_INTERVAL) {
      console.log('Energy data was fetched recently, skipping');
      return;
    }

    // Create a new request promise
    const requestPromise = (async () => {
      try {
        lastRequestTime.current = Date.now();

        // Try to get energy data
        let response = await fetch('/api/energy', {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });

        // If energy data not found (404), try to initialize energy
        if (response.status === 404) {
          console.log('Energy data not found, initializing...');

          // Try to initialize energy
          const initResponse = await fetch('/api/energy/initialize', {
            method: 'POST',
          });

          if (!initResponse.ok) {
            throw new Error(`Energy initialization failed: ${initResponse.status}`);
          }

          // Fetch energy data again after initialization
          response = await fetch('/api/energy', {
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
        }

        if (!response.ok) {
          throw new Error(`Energy fetch failed: ${response.status}`);
        }

        const data = await response.json();

        setEnergy(data.energyAmount);
        setMaxEnergy(data.maxEnergy);
        setTimeUntilNextEnergy(data.timeUntilNextEnergy);
      } catch (error) {
        console.error('Error fetching energy:', error);
      } finally {
        setIsLoading(false);
        // Clear the request promise when done
        requestInProgress.current = null;
      }
    })();

    // Store the request promise
    requestInProgress.current = requestPromise;

    // Wait for the request to complete
    await requestPromise;
  }, [session]);

  // Consume energy function
  const consumeEnergy = useCallback(async (amount: number = 1): Promise<boolean> => {
    // Check if session is available and if the user is authenticated
    if (!session || !session.user) return false;

    try {
      const response = await fetch('/api/energy/consume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Energy consumption failed:', data.error);
        return false;
      }

      // Update local state with server response
      setEnergy(data.remainingEnergy);

      // Set or update the timer for next energy
      if (data.nextEnergyAt) {
        const nextEnergyTime = new Date(data.nextEnergyAt).getTime();
        setTimeUntilNextEnergy(Math.max(0, nextEnergyTime - Date.now()));
      }

      return true;
    } catch (error) {
      console.error('Error consuming energy:', error);
      return false;
    }
  }, [session]);

  // Initialize energy data on mount or when session changes
  useEffect(() => {
    // Only fetch data if we have an authenticated user
    if (session?.user) {
      refreshEnergy();
    } else {
      // Reset to default values for unauthenticated users
      setEnergy(MAX_ENERGY);
      setMaxEnergy(MAX_ENERGY);
      setTimeUntilNextEnergy(null);
      setIsLoading(false);
    }
  }, [session, refreshEnergy]);

  // No need for polling since we refresh when timer ends

  // Update countdown timer for next energy
  useEffect(() => {
    if (timeUntilNextEnergy === null) return;

    const timer = setInterval(() => {
      setTimeUntilNextEnergy(prev => {
        if (prev === null) return null;

        const newTime = prev - 1000;

        // If countdown finished, refresh energy data
        if (newTime <= 0) {
          refreshEnergy();
          return null;
        }

        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeUntilNextEnergy, refreshEnergy]);

  return (
    <EnergyContext.Provider
      value={{
        energy,
        maxEnergy,
        timeUntilNextEnergy,
        isLoading,
        consumeEnergy,
        refreshEnergy
      }}
    >
      {children}
    </EnergyContext.Provider>
  );
};

export const useEnergy = (): EnergyContextType => {
  const context = useContext(EnergyContext);
  if (context === undefined) {
    throw new Error('useEnergy must be used within an EnergyProvider');
  }
  return context;
};