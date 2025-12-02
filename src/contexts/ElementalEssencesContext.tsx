'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useSession } from 'next-auth/react';

// Define types
export type EssenceType = 'rock' | 'paper' | 'scissors';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

// Define the essences data structure for the context
export interface Essences {
  rock: number;
  paper: number;
  scissors: number;
  isLoading: boolean;
}

// Define the context interface
interface ElementalEssencesContextType {
  essences: Essences;
  addEssence: (walletIdOrType: string | EssenceType, typeOrAmount: EssenceType | number, amount?: number) => Promise<boolean>;
  useEssence: (walletIdOrType: string | EssenceType, typeOrAmount: EssenceType | number, amount?: number) => Promise<{ success: boolean; remainingAmount?: number }>;
  calculateReward: (type: EssenceType, difficulty: DifficultyLevel) => number;
  refreshEssences: () => Promise<void>;
}

// Create the context with a default value
const ElementalEssencesContext = createContext<ElementalEssencesContextType>({
  essences: { rock: 0, paper: 0, scissors: 0, isLoading: true },
  addEssence: async () => false,
  useEssence: async () => ({ success: false }),
  calculateReward: () => 0,
  refreshEssences: async () => {},
});

// Custom hook to use the context
export const useElementalEssences = () => useContext(ElementalEssencesContext);

// Storage key for local persistence (fallback)
const STORAGE_KEY = 'elemental-essences-local';

// Provider component
export const ElementalEssencesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Get the user session
  const { data: session } = useSession();
  
  // State for essences data
  const [essences, setEssences] = useState<Essences>({
    rock: 0,
    paper: 0,
    scissors: 0,
    isLoading: true
  });

  // Initialize the context
  useEffect(() => {}, []);

  // Track in-flight requests to prevent duplicates
  const requestInProgress = React.useRef<Promise<void> | null>(null);
  const lastRequestTime = React.useRef<number>(0);
  const MIN_REQUEST_INTERVAL = 5000; // 5 seconds minimum between requests

  // Refresh essences from the API
  const refreshEssences = useCallback(async (): Promise<void> => {
    // If not logged in, try to load from localStorage and return
    if (!session?.user) {
      if (typeof window !== 'undefined') {
        try {
          const localData = localStorage.getItem(STORAGE_KEY);
          if (localData) {
            const parsedData = JSON.parse(localData);
            setEssences({
              rock: parsedData.rock || 0,
              paper: parsedData.paper || 0,
              scissors: parsedData.scissors || 0,
              isLoading: false
            });
          } else {
            setEssences(prev => ({ ...prev, isLoading: false }));
          }
        } catch (error) {
          console.warn('Error loading from localStorage:', error);
          setEssences(prev => ({ ...prev, isLoading: false }));
        }
      }
      return;
    }

    // If a request is already in progress, wait for it to complete
    if (requestInProgress.current) {
      console.log('Essences data refresh already in progress, waiting...');
      await requestInProgress.current;
      return;
    }

    // Throttle requests to prevent excessive API calls
    const now = Date.now();
    if (now - lastRequestTime.current < MIN_REQUEST_INTERVAL) {
      console.log('Essences data was fetched recently, skipping');
      return;
    }

    // Create a new request promise
    const requestPromise = (async () => {
      try {
        lastRequestTime.current = Date.now();

        // Try to get essences data from API
        let response = await fetch('/api/essences', {
          // Use proper cache control headers
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });

        // If essences data not found (404), try to initialize essences
        if (response.status === 404) {
          console.log('Essences data not found, initializing...');

          // Try to initialize essences
          const initResponse = await fetch('/api/essences/initialize', {
            method: 'POST',
          });

          if (!initResponse.ok) {
            throw new Error(`Essences initialization failed: ${initResponse.status}`);
          }

          // Fetch essences data again after initialization
          response = await fetch('/api/essences', {
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
        }
      
        if (!response.ok) {
          throw new Error(`Essences fetch failed: ${response.status}`);
        }

        const data = await response.json();

        // Update state with data from API
        setEssences({
          rock: data.rockEssence,
          paper: data.paperEssence,
          scissors: data.scissorsEssence,
          isLoading: false
        });

        // Also update localStorage as fallback
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            rock: data.rockEssence,
            paper: data.paperEssence,
            scissors: data.scissorsEssence
          }));
        }
      } catch (error) {
        console.error('Error fetching essences:', error);

        // Try to load from localStorage as fallback
        if (typeof window !== 'undefined') {
          try {
            const localData = localStorage.getItem(STORAGE_KEY);
            if (localData) {
              const parsedData = JSON.parse(localData);
              setEssences({
                rock: parsedData.rock || 0,
                paper: parsedData.paper || 0,
                scissors: parsedData.scissors || 0,
                isLoading: false
              });
            } else {
              setEssences(prev => ({ ...prev, isLoading: false }));
            }
          } catch (storageError) {
            console.warn('Error loading from localStorage:', storageError);
            setEssences(prev => ({ ...prev, isLoading: false }));
          }
        } else {
          setEssences(prev => ({ ...prev, isLoading: false }));
        }
      } finally {
        // Clear the request promise when done
        requestInProgress.current = null;
      }
    })();

    // Store the request promise
    requestInProgress.current = requestPromise;

    // Wait for the request to complete
    await requestPromise;
  }, [session]);
  
  // Load essences when session changes, but only when authenticated
  useEffect(() => {
    // Only fetch data if we have an authenticated user, otherwise load from localStorage
    if (session?.user) {
      refreshEssences();
    } else {
      // Load from localStorage for unauthenticated users
      if (typeof window !== 'undefined') {
        try {
          const localData = localStorage.getItem(STORAGE_KEY);
          if (localData) {
            const parsedData = JSON.parse(localData);
            setEssences({
              rock: parsedData.rock || 0,
              paper: parsedData.paper || 0,
              scissors: parsedData.scissors || 0,
              isLoading: false
            });
          } else {
            setEssences(prev => ({ ...prev, isLoading: false }));
          }
        } catch (error) {
          console.warn('Error loading from localStorage:', error);
          setEssences(prev => ({ ...prev, isLoading: false }));
        }
      }
    }
  }, [session, refreshEssences]);

  // Add essence to the inventory
  // This function handles both direct calls (type, amount) and championship calls (walletId, type, amount)
  const addEssence = useCallback(async (
    walletIdOrType: string | EssenceType,
    typeOrAmount: EssenceType | number,
    amountParam?: number
  ): Promise<boolean> => {
    // Handle overloaded function signature
    let type: EssenceType;
    let amount: number;
    let walletId: string | null = null;

    // Check if first parameter is wallet ID
    if (typeof walletIdOrType === 'string' &&
        (walletIdOrType.startsWith('0x') ||
         /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(walletIdOrType))) {
      // This is the 3-param version (walletId, type, amount)
      walletId = walletIdOrType;
      type = typeOrAmount as EssenceType;
      amount = amountParam as number;
    } else {
      // This is the 2-param version (type, amount)
      type = walletIdOrType as EssenceType;
      amount = typeOrAmount as number;
    }

    if (amount <= 0) return false;

    console.info(`Adding ${amount} ${type} essence${walletId ? ` for wallet ${walletId}` : ''}`);

    // If we're using the internal context version without wallet ID
    if (!walletId) {
      // If not logged in, just update localStorage
      if (!session?.user) {
        setEssences(prev => ({
          ...prev,
          [type]: prev[type] + amount
        }));

        if (typeof window !== 'undefined') {
          try {
            const localData = localStorage.getItem(STORAGE_KEY);
            const currentData = localData ? JSON.parse(localData) : { rock: 0, paper: 0, scissors: 0 };
            currentData[type] += amount;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentData));
          } catch (error) {
            console.warn('Error saving to localStorage:', error);
          }
        }

        return true;
      }

      try {
        // Optimistically update the UI
        setEssences(prev => ({
          ...prev,
          [type]: prev[type] + amount
        }));

        // Send request to API
        const response = await fetch('/api/essences/add', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ type, amount }),
        });

        const data = await response.json();

        if (!response.ok) {
          console.error('Adding essence failed:', data.error);

          // Rollback optimistic update
          setEssences(prev => ({
            ...prev,
            [type]: prev[type] - amount
          }));

          return false;
        }

        // Update with the correct value from server
        setEssences(prev => ({
          ...prev,
          [type]: data.updatedAmount
        }));

        // Also update localStorage for fallback
        if (typeof window !== 'undefined') {
          try {
            const localData = localStorage.getItem(STORAGE_KEY);
            const currentData = localData ? JSON.parse(localData) : { rock: 0, paper: 0, scissors: 0 };
            currentData[type] = data.updatedAmount;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentData));
          } catch (error) {
            console.warn('Error saving to localStorage:', error);
          }
        }

        return true;
      } catch (error) {
        console.error('Error adding essence:', error);

        // Keep the optimistic update since we're in "offline" mode
        // and save to localStorage
        if (typeof window !== 'undefined') {
          try {
            const localData = localStorage.getItem(STORAGE_KEY);
            const currentData = localData ? JSON.parse(localData) : { rock: 0, paper: 0, scissors: 0 };
            currentData[type] = essences[type]; // Use the current state value
            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentData));
          } catch (storageError) {
            console.warn('Error saving to localStorage:', storageError);
          }
        }

        return true; // Still return true for "offline" mode
      }
    } else {
      // This is the championship case where a walletId was explicitly provided
      try {
        // When using a specific wallet ID (for championship or admin functions),
        // we'll use the repository directly through the API, but still update our local state

        // Send request to API
        const response = await fetch('/api/essences/add', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type,
            amount,
            walletId: walletId // Pass the wallet ID to override the session
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          console.error('Adding essence with wallet ID failed:', data.error);
          return false;
        }

        // If this is our own wallet, update our state (otherwise don't)
        if (session?.user?.id === walletId || session?.user?.walletAddress === walletId) {
          setEssences(prev => ({
            ...prev,
            [type]: data.updatedAmount
          }));

          // Also update localStorage
          if (typeof window !== 'undefined') {
            try {
              const localData = localStorage.getItem(STORAGE_KEY);
              const currentData = localData ? JSON.parse(localData) : { rock: 0, paper: 0, scissors: 0 };
              currentData[type] = data.updatedAmount;
              localStorage.setItem(STORAGE_KEY, JSON.stringify(currentData));
            } catch (error) {
              console.warn('Error saving to localStorage:', error);
            }
          }
        }

        return true;
      } catch (error) {
        console.error(`Error adding essence with wallet ID ${walletId}:`, error);
        return false;
      }
    }
  }, [session, essences]);

  // Use essence from the inventory
  // This function handles both direct calls (type, amount) and championship calls (walletId, type, amount)
  const useEssence = useCallback(async (
    walletIdOrType: string | EssenceType,
    typeOrAmount: EssenceType | number,
    amountParam?: number
  ): Promise<{ success: boolean; remainingAmount?: number }> => {
    // Handle overloaded function signature
    let type: EssenceType;
    let amount: number;
    let walletId: string | null = null;

    // Check if first parameter is wallet ID
    if (typeof walletIdOrType === 'string' &&
        (walletIdOrType.startsWith('0x') ||
         /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(walletIdOrType))) {
      // This is the 3-param version (walletId, type, amount)
      walletId = walletIdOrType;
      type = typeOrAmount as EssenceType;
      amount = amountParam as number;
    } else {
      // This is the 2-param version (type, amount)
      type = walletIdOrType as EssenceType;
      amount = typeOrAmount as number;
    }

    if (amount <= 0) return { success: true, remainingAmount: essences[type] };

    // If we're using the internal context version without wallet ID
    if (!walletId) {
      if (essences[type] < amount) return { success: false, remainingAmount: essences[type] };

      console.info(`Using ${amount} ${type} essence`);

      // If not logged in, just update localStorage
      if (!session?.user) {
        setEssences(prev => ({
          ...prev,
          [type]: prev[type] - amount
        }));

        if (typeof window !== 'undefined') {
          try {
            const localData = localStorage.getItem(STORAGE_KEY);
            const currentData = localData ? JSON.parse(localData) : { rock: 0, paper: 0, scissors: 0 };
            currentData[type] -= amount;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentData));
          } catch (error) {
            console.warn('Error saving to localStorage:', error);
          }
        }

        return { success: true, remainingAmount: essences[type] - amount };
      }

      try {
        // Optimistically update the UI
        setEssences(prev => ({
          ...prev,
          [type]: prev[type] - amount
        }));

        // Send request to API
        const response = await fetch('/api/essences/use', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ type, amount }),
        });

        const data = await response.json();

        if (!response.ok) {
          console.error('Using essence failed:', data.error);

          // Rollback optimistic update
          setEssences(prev => ({
            ...prev,
            [type]: prev[type] + amount
          }));

          return { success: false, remainingAmount: data.remainingAmount };
        }

        // Update with the correct value from server
        setEssences(prev => ({
          ...prev,
          [type]: data.remainingAmount
        }));

        // Also update localStorage for fallback
        if (typeof window !== 'undefined') {
          try {
            const localData = localStorage.getItem(STORAGE_KEY);
            const currentData = localData ? JSON.parse(localData) : { rock: 0, paper: 0, scissors: 0 };
            currentData[type] = data.remainingAmount;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentData));
          } catch (error) {
            console.warn('Error saving to localStorage:', error);
          }
        }

        return { success: true, remainingAmount: data.remainingAmount };
      } catch (error) {
        console.error('Error using essence:', error);

        // Keep the optimistic update since we're in "offline" mode
        // and save to localStorage
        if (typeof window !== 'undefined') {
          try {
            const localData = localStorage.getItem(STORAGE_KEY);
            const currentData = localData ? JSON.parse(localData) : { rock: 0, paper: 0, scissors: 0 };
            currentData[type] = essences[type]; // Use the current state value
            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentData));
          } catch (storageError) {
            console.warn('Error saving to localStorage:', storageError);
          }
        }

        return { success: true, remainingAmount: essences[type] }; // Still return true for "offline" mode
      }
    } else {
      // This is the championship case where a walletId was explicitly provided
      try {
        // When using a specific wallet ID (for championship or admin functions),
        // we'll use the repository directly through the API, but still update our local state

        // Send request to API
        const response = await fetch('/api/essences/use', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type,
            amount,
            walletId: walletId // Pass the wallet ID to override the session
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          console.error('Using essence with wallet ID failed:', data.error);
          return { success: false, remainingAmount: data.remainingAmount };
        }

        // If this is our own wallet, update our state (otherwise don't)
        if (session?.user?.id === walletId || session?.user?.walletAddress === walletId) {
          setEssences(prev => ({
            ...prev,
            [type]: data.remainingAmount
          }));

          // Also update localStorage
          if (typeof window !== 'undefined') {
            try {
              const localData = localStorage.getItem(STORAGE_KEY);
              const currentData = localData ? JSON.parse(localData) : { rock: 0, paper: 0, scissors: 0 };
              currentData[type] = data.remainingAmount;
              localStorage.setItem(STORAGE_KEY, JSON.stringify(currentData));
            } catch (error) {
              console.warn('Error saving to localStorage:', error);
            }
          }
        }

        return { success: true, remainingAmount: data.remainingAmount };
      } catch (error) {
        console.error(`Error using essence with wallet ID ${walletId}:`, error);
        return { success: false };
      }
    }
  }, [session, essences]);

  // Calculate reward based on difficulty
  const calculateReward = useCallback((type: EssenceType, difficulty: DifficultyLevel): number => {
    // Base reward: 1 essence for a win on Easy
    const baseReward = 1;
    
    // Difficulty multipliers
    const difficultyMultiplier = {
      easy: 1,     // 1x reward on Easy
      medium: 2,   // 2x reward on Medium
      hard: 3,     // 3x reward on Hard
    };
    
    const reward = baseReward * difficultyMultiplier[difficulty];
    console.info(`Calculated ${reward} ${type} essence reward for ${difficulty} difficulty`);
    return reward;
  }, []);

  // Context value
  const value = {
    essences,
    addEssence,
    useEssence,
    calculateReward,
    refreshEssences
  };

  return (
    <ElementalEssencesContext.Provider value={value}>
      {children}
    </ElementalEssencesContext.Provider>
  );
};