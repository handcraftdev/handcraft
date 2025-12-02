'use client';

import { usePermissions } from '@/contexts/PermissionsContext';
import { WorldButton } from '@/components/ui/WorldButton';
import { ListItem } from '@worldcoin/mini-apps-ui-kit-react';
import { useMiniKit } from '@worldcoin/minikit-js/minikit-provider';

/**
 * This component displays user permissions and provides buttons to request permissions
 * It uses the PermissionsContext to manage and display current permissions
 * Read More: https://docs.world.org/mini-apps/commands/permissions
 */
export const ViewPermissions = () => {
  const { isInstalled } = useMiniKit();
  const { 
    permissions, 
    isLoading,
    requestNotificationsPermission,
    requestContactsPermission
  } = usePermissions();

  // Handler for requesting notifications permission
  const handleRequestNotifications = async () => {
    if (!isInstalled) return;
    
    const success = await requestNotificationsPermission();
    if (success) {
      console.log('Notifications permission granted');
    } else {
      console.error('Failed to get notifications permission');
    }
  };

  // Handler for requesting contacts permission
  const handleRequestContacts = async () => {
    if (!isInstalled) return;
    
    const success = await requestContactsPermission();
    if (success) {
      console.log('Contacts permission granted');
    } else {
      console.error('Failed to get contacts permission');
    }
  };

  return (
    <div className="card w-full">
      <div className="card-header bg-primary-50 dark:bg-primary-900">
        <h2 className="text-lg font-semibold text-primary-800 dark:text-primary-200">Permissions</h2>
      </div>
      
      <div className="card-body space-y-4">
        {!isInstalled ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Open in World App to view and manage permissions
          </p>
        ) : isLoading ? (
          <div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">Loading permissions...</p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500">
              If this takes too long, try refreshing the page
            </p>
          </div>
        ) : (
          <>
            <ListItem
              key="notifications"
              description={`Enabled: ${permissions.notifications ? 'Yes' : 'No'}`}
              label="Notifications"
            >
              {!permissions.notifications && (
                <WorldButton 
                  size="sm" 
                  variant="tertiary"
                  onClick={handleRequestNotifications}
                  disabled={!isInstalled}
                >
                  Request
                </WorldButton>
              )}
            </ListItem>
            
            <ListItem
              key="contacts"
              description={`Enabled: ${permissions.contacts ? 'Yes' : 'No'}`}
              label="Contacts"
            >
              {!permissions.contacts && (
                <WorldButton 
                  size="sm" 
                  variant="tertiary"
                  onClick={handleRequestContacts}
                  disabled={!isInstalled}
                >
                  Request
                </WorldButton>
              )}
            </ListItem>
          </>
        )}
        
        {!isInstalled && (
          <p className="text-sm text-neutral-500 mt-2 dark:text-neutral-400">
            Open in World App to manage permissions
          </p>
        )}
      </div>
    </div>
  );
};
