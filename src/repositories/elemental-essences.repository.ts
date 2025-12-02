import { createSupabaseBrowserClient, createSupabaseServerClient } from '@/utils/supabase';

// Types for elemental essences
export type EssenceType = 'rock' | 'paper' | 'scissors';

export interface ElementalEssences {
  id: string;
  userId: string;
  rockEssence: number;
  paperEssence: number;
  scissorsEssence: number;
  createdAt: Date;
  updatedAt: Date;
}

export class ElementalEssencesRepository {
  /**
   * Get user's elemental essences
   * @param walletAddressOrId User ID or wallet address to get essences for
   * @returns Current essences data
   */
  async getUserEssences(walletAddressOrId: string): Promise<ElementalEssences | null> {
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
      
      // Get user's essences data using the UUID
      const { data, error } = await supabase
        .from('elemental_essences')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        console.error('Error fetching elemental essences data:', error);
        return null;
      }
      
      if (!data) {
        return null;
      }
      
      return {
        id: data.id,
        userId: data.user_id,
        rockEssence: data.rock_essence,
        paperEssence: data.paper_essence,
        scissorsEssence: data.scissors_essence,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };
    } catch (error) {
      console.error('Error in getUserEssences:', error);
      return null;
    }
  }
  
  /**
   * Add essence to user's inventory
   * @param walletAddressOrId User ID or wallet address
   * @param essenceType Type of essence to add
   * @param amount Amount of essence to add
   * @returns Success flag and updated essence amount
   */
  async addEssence(
    walletAddressOrId: string,
    essenceType: EssenceType,
    amount: number
  ): Promise<{
    success: boolean;
    updatedAmount: number;
  }> {
    if (amount <= 0) {
      return { success: false, updatedAmount: 0 };
    }
    
    // Use server client when running on server, browser client when on client
    const supabase = typeof window === 'undefined'
      ? createSupabaseServerClient()
      : createSupabaseBrowserClient();
    
    try {
      // Get latest essences data first using the wallet address or user ID
      const essencesData = await this.getUserEssences(walletAddressOrId);
      
      if (!essencesData) {
        return { 
          success: false, 
          updatedAmount: 0
        };
      }
      
      // Determine which essence to update
      const dbColumn = this.getDbColumnForEssenceType(essenceType);
      const currentAmount = essencesData[this.getEssencePropertyName(essenceType)];
      const newAmount = currentAmount + amount;
      
      // Update the database
      const { error } = await supabase
        .from('elemental_essences')
        .update({
          [dbColumn]: newAmount
        })
        .eq('id', essencesData.id);
      
      if (error) {
        console.error(`Error adding ${essenceType} essence:`, error);
        return { 
          success: false, 
          updatedAmount: currentAmount
        };
      }
      
      return { 
        success: true, 
        updatedAmount: newAmount
      };
    } catch (error) {
      console.error(`Error in addEssence (${essenceType}):`, error);
      return { 
        success: false, 
        updatedAmount: 0
      };
    }
  }
  
  /**
   * Use essence from user's inventory
   * @param walletAddressOrId User ID or wallet address
   * @param essenceType Type of essence to use
   * @param amount Amount of essence to use
   * @returns Success flag and remaining essence amount
   */
  async useEssence(
    walletAddressOrId: string,
    essenceType: EssenceType,
    amount: number
  ): Promise<{
    success: boolean;
    remainingAmount: number;
  }> {
    if (amount <= 0) {
      return { success: true, remainingAmount: 0 };
    }
    
    // Use server client when running on server, browser client when on client
    const supabase = typeof window === 'undefined'
      ? createSupabaseServerClient()
      : createSupabaseBrowserClient();
    
    try {
      // Get latest essences data first using the wallet address or user ID
      const essencesData = await this.getUserEssences(walletAddressOrId);
      
      if (!essencesData) {
        return { 
          success: false, 
          remainingAmount: 0
        };
      }
      
      // Determine which essence to update
      const dbColumn = this.getDbColumnForEssenceType(essenceType);
      const currentAmount = essencesData[this.getEssencePropertyName(essenceType)];
      
      // Check if user has enough essence
      if (currentAmount < amount) {
        return { 
          success: false, 
          remainingAmount: currentAmount
        };
      }
      
      // Calculate new amount
      const newAmount = currentAmount - amount;
      
      // Update the database
      const { error } = await supabase
        .from('elemental_essences')
        .update({
          [dbColumn]: newAmount
        })
        .eq('id', essencesData.id);
      
      if (error) {
        console.error(`Error using ${essenceType} essence:`, error);
        return { 
          success: false, 
          remainingAmount: currentAmount
        };
      }
      
      return { 
        success: true, 
        remainingAmount: newAmount
      };
    } catch (error) {
      console.error(`Error in useEssence (${essenceType}):`, error);
      return { 
        success: false, 
        remainingAmount: 0
      };
    }
  }
  
  /**
   * Initialize essences for a new user (called by database trigger)
   * @param walletAddressOrId User ID or wallet address
   * @returns Success flag
   */
  async initializeUserEssences(walletAddressOrId: string): Promise<boolean> {
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
        .from('elemental_essences')
        .insert({
          user_id: userId,
          rock_essence: 0,
          paper_essence: 0,
          scissors_essence: 0
        });
      
      if (error) {
        console.error('Error initializing elemental essences:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error in initializeUserEssences:', error);
      return false;
    }
  }
  
  /**
   * Admin function to reset all essences for a user
   * @param walletAddressOrId User ID or wallet address
   * @returns Success flag
   */
  async resetEssences(walletAddressOrId: string): Promise<boolean> {
    const supabase = createSupabaseServerClient();
    
    try {
      // Get current essences data
      const essencesData = await this.getUserEssences(walletAddressOrId);
      
      if (!essencesData) {
        return false;
      }
      
      // Update database to reset all essences
      const { error } = await supabase
        .from('elemental_essences')
        .update({
          rock_essence: 0,
          paper_essence: 0,
          scissors_essence: 0
        })
        .eq('id', essencesData.id);
      
      if (error) {
        console.error('Error resetting essences:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error in resetEssences:', error);
      return false;
    }
  }
  
  /**
   * Helper to convert essence type to database column name
   */
  private getDbColumnForEssenceType(type: EssenceType): string {
    switch (type) {
      case 'rock': return 'rock_essence';
      case 'paper': return 'paper_essence';
      case 'scissors': return 'scissors_essence';
    }
  }
  
  /**
   * Helper to convert essence type to object property name
   */
  private getEssencePropertyName(type: EssenceType): keyof Pick<ElementalEssences, 'rockEssence' | 'paperEssence' | 'scissorsEssence'> {
    switch (type) {
      case 'rock': return 'rockEssence';
      case 'paper': return 'paperEssence';
      case 'scissors': return 'scissorsEssence';
    }
  }
}