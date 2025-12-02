'use server';

import { createSupabaseServerClient } from '@/utils/supabase';

export interface PermissionData {
  notifications: boolean;
  contacts: boolean;
}

/**
 * Get permissions for a user
 * 
 * @param userId User ID from Supabase
 * @returns Permissions for the user
 */
export async function getPermissions(userId: string): Promise<PermissionData | null> {
  const supabase = createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from('permissions')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 is the "no rows returned" error
    console.error('Error fetching permissions:', error);
    throw new Error(`Failed to fetch permissions: ${error.message}`);
  }
  
  if (!data) return null;
  
  return {
    notifications: data.notifications,
    contacts: data.contacts
  };
}

/**
 * Update permissions for a user
 * 
 * @param userId User ID from Supabase
 * @param permissions Permission data to update
 * @returns Updated permissions
 */
export async function updatePermissions(userId: string, permissions: Partial<PermissionData>) {
  const supabase = createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from('permissions')
    .update({
      notifications: permissions.notifications !== undefined ? permissions.notifications : undefined,
      contacts: permissions.contacts !== undefined ? permissions.contacts : undefined,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating permissions:', error);
    throw new Error(`Failed to update permissions: ${error.message}`);
  }
  
  return {
    notifications: data.notifications,
    contacts: data.contacts
  };
}

/**
 * Set notification permission
 * 
 * @param userId User ID from Supabase
 * @param enabled Whether to enable or disable notifications
 * @returns Updated permissions
 */
export async function setNotificationPermission(userId: string, enabled: boolean) {
  return updatePermissions(userId, { notifications: enabled });
}

/**
 * Set contacts permission
 * 
 * @param userId User ID from Supabase
 * @param enabled Whether to enable or disable contacts access
 * @returns Updated permissions
 */
export async function setContactsPermission(userId: string, enabled: boolean) {
  return updatePermissions(userId, { contacts: enabled });
}