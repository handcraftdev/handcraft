import { createSupabaseBrowserClient, createSupabaseServerClient } from '@/utils/supabase';

// Constants for energy system
export const DEFAULT_MAX_ENERGY = 10;
export const DEFAULT_ENERGY_REPLENISH_MINUTES = 10;

export type EnergyData = {
  id: string;
  userId: string;
  energyAmount: number;
  maxEnergy: number;
  lastConsumedAt: Date | null;
  lastRefreshedAt: Date | null;
  energyReplenishRate: number; // in minutes
  createdAt: Date;
  updatedAt: Date;
};

export class EnergyRepository {
  /**
   * Get user's energy data with auto-refreshed calculation based on time passed
   * @param walletAddressOrId User ID or wallet address to get energy for
   * @returns Calculated current energy data
   */
  async getUserEnergy(walletAddressOrId: string): Promise<EnergyData | null> {
    // Use server client when running on server, browser client when on client
    const supabase = typeof window === 'undefined'
      ? createSupabaseServerClient()
      : createSupabaseBrowserClient();
    
    try {
      // Determine if this is a wallet address (starts with 0x) or a UUID
      const isWalletAddress = walletAddressOrId.startsWith('0x');
      
      // If it's a wallet address, we need to get the user's UUID first
      let userId = walletAddressOrId;
      
      if (isWalletAddress) {
        // Get the user record by wallet address
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('wallet_address', walletAddressOrId)
          .single();
        
        if (userError) {
          console.error('Error fetching user by wallet address:', userError);
          return null;
        }
        
        if (!userData) {
          console.error('User not found for wallet address:', walletAddressOrId);
          return null;
        }
        
        userId = userData.id;
      }
      
      // Get user's energy data using the UUID
      const { data, error } = await supabase
        .from('energy')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        console.error('Error fetching energy data:', error);
        return null;
      }
      
      if (!data) {
        return null;
      }
      
      // Calculate current energy based on time passed since last refresh
      const calculatedEnergy = this.calculateCurrentEnergy(data);
      
      return {
        id: data.id,
        userId: data.user_id,
        energyAmount: calculatedEnergy.currentEnergy,
        maxEnergy: data.max_energy,
        lastConsumedAt: data.last_consumed_at ? new Date(data.last_consumed_at) : null,
        lastRefreshedAt: calculatedEnergy.newLastRefreshedAt 
          ? new Date(calculatedEnergy.newLastRefreshedAt) 
          : (data.last_refreshed_at ? new Date(data.last_refreshed_at) : null),
        energyReplenishRate: data.energy_replenish_rate,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };
    } catch (error) {
      console.error('Error in getUserEnergy:', error);
      return null;
    }
  }
  
  /**
   * Calculate the current energy based on time passed
   * @param energyData Raw energy data from database
   * @returns Calculated current energy and new last refreshed timestamp
   */
  private calculateCurrentEnergy(energyData: any): { 
    currentEnergy: number; 
    newLastRefreshedAt: string | null;
  } {
    const now = new Date();
    let currentEnergy = energyData.energy_amount;
    let newLastRefreshedAt: string | null = energyData.last_refreshed_at;
    
    // If we have a timestamp for last refresh and energy is not at max
    if (energyData.last_refreshed_at && currentEnergy < energyData.max_energy) {
      const lastRefreshed = new Date(energyData.last_refreshed_at);
      const minutesPassed = Math.floor((now.getTime() - lastRefreshed.getTime()) / (60 * 1000));
      
      // Calculate how many energy points should be regenerated
      const energyToAdd = Math.floor(minutesPassed / energyData.energy_replenish_rate);
      
      if (energyToAdd > 0) {
        // Update energy (capped at max_energy)
        currentEnergy = Math.min(energyData.max_energy, currentEnergy + energyToAdd);
        
        // Calculate new last_refreshed_at time
        const minutesUsed = energyToAdd * energyData.energy_replenish_rate;
        newLastRefreshedAt = new Date(lastRefreshed.getTime() + (minutesUsed * 60 * 1000)).toISOString();
        
        // If we've calculated energy changes, update the database
        this.updateEnergyAfterCalculation(energyData.id, currentEnergy, newLastRefreshedAt);
      }
    }
    
    return { currentEnergy, newLastRefreshedAt };
  }
  
  /**
   * Update energy data in database after calculation
   * (Fire and forget - doesn't affect the current operation)
   */
  private async updateEnergyAfterCalculation(
    energyId: string, 
    newAmount: number, 
    newLastRefreshedAt: string | null
  ): Promise<void> {
    // Use server client when running on server, browser client when on client
    const supabase = typeof window === 'undefined'
      ? createSupabaseServerClient()
      : createSupabaseBrowserClient();
    
    try {
      await supabase
        .from('energy')
        .update({
          energy_amount: newAmount,
          last_refreshed_at: newLastRefreshedAt
        })
        .eq('id', energyId);
    } catch (error) {
      console.error('Error updating energy after calculation:', error);
    }
  }
  
  /**
   * Consume energy for a user
   * @param walletAddressOrId User ID or wallet address
   * @param amount Amount of energy to consume (default: 1)
   * @returns Success flag and remaining energy
   */
  async consumeEnergy(walletAddressOrId: string, amount: number = 1): Promise<{
    success: boolean;
    remainingEnergy: number;
    nextEnergyAt: Date | null;
  }> {
    // Use server client when running on server, browser client when on client
    const supabase = typeof window === 'undefined'
      ? createSupabaseServerClient()
      : createSupabaseBrowserClient();
    
    try {
      // Get latest energy data first using the wallet address or user ID
      const energyData = await this.getUserEnergy(walletAddressOrId);
      
      if (!energyData) {
        return { 
          success: false, 
          remainingEnergy: 0,
          nextEnergyAt: null
        };
      }
      
      // Check if user has enough energy
      if (energyData.energyAmount < amount) {
        return { 
          success: false, 
          remainingEnergy: energyData.energyAmount,
          nextEnergyAt: this.calculateNextEnergyTime(energyData)
        };
      }
      
      // Calculate new amount
      const newAmount = energyData.energyAmount - amount;
      const now = new Date().toISOString();
      
      // Update last_consumed_at and energy_amount
      // If this is first consumption or at full energy, also update last_refreshed_at
      const updateData: any = {
        energy_amount: newAmount,
        last_consumed_at: now
      };
      
      // If at max energy before consumption, start the refresh timer
      if (energyData.energyAmount === energyData.maxEnergy) {
        updateData.last_refreshed_at = now;
      }
      
      // Update the database
      const { error } = await supabase
        .from('energy')
        .update(updateData)
        .eq('id', energyData.id);
      
      if (error) {
        console.error('Error consuming energy:', error);
        return { 
          success: false, 
          remainingEnergy: energyData.energyAmount,
          nextEnergyAt: null
        };
      }
      
      // Calculate next energy time
      const nextEnergyTime = updateData.last_refreshed_at 
        ? new Date(new Date(updateData.last_refreshed_at).getTime() + (energyData.energyReplenishRate * 60 * 1000))
        : energyData.lastRefreshedAt 
          ? new Date(energyData.lastRefreshedAt.getTime() + (energyData.energyReplenishRate * 60 * 1000))
          : null;
      
      return { 
        success: true, 
        remainingEnergy: newAmount,
        nextEnergyAt: nextEnergyTime
      };
    } catch (error) {
      console.error('Error in consumeEnergy:', error);
      return { 
        success: false, 
        remainingEnergy: 0,
        nextEnergyAt: null
      };
    }
  }
  
  /**
   * Calculate when the next energy point will be available
   */
  private calculateNextEnergyTime(energyData: EnergyData): Date | null {
    // If at max energy, no next energy time
    if (energyData.energyAmount >= energyData.maxEnergy) {
      return null;
    }
    
    // If we have a last refresh time, calculate based on that
    if (energyData.lastRefreshedAt) {
      return new Date(
        energyData.lastRefreshedAt.getTime() + 
        (energyData.energyReplenishRate * 60 * 1000)
      );
    }
    
    return null;
  }
  
  /**
   * Initialize energy for a new user
   * @param walletAddressOrId User ID or wallet address
   * @returns Success flag
   */
  async initializeUserEnergy(walletAddressOrId: string): Promise<boolean> {
    const supabase = createSupabaseServerClient();
    
    try {
      // Determine if this is a wallet address (starts with 0x) or a UUID
      const isWalletAddress = walletAddressOrId.startsWith('0x');
      
      // If it's a wallet address, we need to get the user's UUID first
      let userId = walletAddressOrId;
      
      if (isWalletAddress) {
        // Get the user record by wallet address
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('wallet_address', walletAddressOrId)
          .single();
        
        if (userError || !userData) {
          console.error('Error fetching user by wallet address:', userError);
          return false;
        }
        
        userId = userData.id;
      }
      
      const { error } = await supabase
        .from('energy')
        .insert({
          user_id: userId,
          energy_amount: DEFAULT_MAX_ENERGY,
          max_energy: DEFAULT_MAX_ENERGY,
          energy_replenish_rate: DEFAULT_ENERGY_REPLENISH_MINUTES
        });
      
      if (error) {
        console.error('Error initializing energy:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error in initializeUserEnergy:', error);
      return false;
    }
  }
  
  /**
   * Admin function to refill energy for a user
   * @param walletAddressOrId User ID or wallet address
   * @param amount Amount to refill (defaults to max)
   * @returns Success flag
   */
  async refillEnergy(walletAddressOrId: string, amount?: number): Promise<boolean> {
    const supabase = createSupabaseServerClient();
    
    try {
      // Get current energy data
      const energyData = await this.getUserEnergy(walletAddressOrId);
      
      if (!energyData) {
        return false;
      }
      
      // Determine refill amount 
      const refillAmount = amount !== undefined ? amount : energyData.maxEnergy;
      const newAmount = Math.min(energyData.maxEnergy, refillAmount);
      
      // Update database
      const { error } = await supabase
        .from('energy')
        .update({
          energy_amount: newAmount,
          last_refreshed_at: null // Reset refresh timer
        })
        .eq('id', energyData.id);
      
      if (error) {
        console.error('Error refilling energy:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error in refillEnergy:', error);
      return false;
    }
  }
}