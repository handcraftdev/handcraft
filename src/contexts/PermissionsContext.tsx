'use client';

import { MiniKit } from '@worldcoin/minikit-js';
import { useMiniKit } from '@worldcoin/minikit-js/minikit-provider';
import { 
  ReactNode, 
  createContext, 
  useCallback, 
  useContext, 
  useEffect, 
  useState 
} from 'react';

// Define the structure of permissions
interface Permissions {
  notifications: boolean;
  contacts: boolean;
}

// Define the context value type
interface PermissionsContextType {
  permissions: Permissions;
  isLoading: boolean;
  requestNotificationsPermission: () => Promise<boolean>;
  requestContactsPermission: () => Promise<boolean>;
}

// Create context with default values
const PermissionsContext = createContext<PermissionsContextType>({
  permissions: {
    notifications: false,
    contacts: false,
  },
  isLoading: true,
  requestNotificationsPermission: async () => false,
  requestContactsPermission: async () => false,
});

// Provider props type
interface PermissionsProviderProps {
  children: ReactNode;
}

/**
 * PermissionsProvider manages World App permissions for the mini app
 * It handles:
 * 1. Fetching current permissions from World App
 * 2. Storing the current permission state
 * 3. Providing methods to request permissions
 */
export function PermissionsProvider({ children }: PermissionsProviderProps) {
  // Track loading state
  const [isLoading, setIsLoading] = useState(true);
  
  // Store permissions state
  const [permissions, setPermissions] = useState<Permissions>({
    notifications: false,
    contacts: false,
  });
  
  // Get MiniKit installation status
  const { isInstalled } = useMiniKit();

  // Helper function to try to get permissions from window debug object
  // This acts as a fallback mechanism in case the regular fetch doesn't work
  const tryGetDebugPermissions = () => {
    if (typeof window === 'undefined') return null;

    try {
      // Try to access the debug permissions that might have been set by our patched event handler
      if ((window as any)._debug_permissions) {
        const perms = (window as any)._debug_permissions;

        if (typeof perms === 'object' &&
            (typeof perms.notifications === 'boolean' || perms.notifications === null) &&
            (typeof perms.contacts === 'boolean' || perms.contacts === null)) {

          return {
            notifications: Boolean(perms.notifications),
            contacts: Boolean(perms.contacts)
          };
        }
      }
    } catch (error) {
      console.error('Failed to read debug permissions:', error);
    }

    return null;
  };

  // Fetch permissions when MiniKit is installed
  useEffect(() => {
    if (typeof window === 'undefined' || !isInstalled) {
      setIsLoading(false);
      return;
    }

    // First try to use debug permissions if available
    const debugPerms = tryGetDebugPermissions();
    if (debugPerms) {
      setPermissions(debugPerms);
      setIsLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      try {
        // Initialize event handler for debug purposes
        const handleDebugMessage = (_event: MessageEvent) => {
          // Silent handler
        };
        window.addEventListener('message', handleDebugMessage);

        let permissionResponse = null;
        let timedOut = false;

        // Create a promise that will be resolved/rejected when the API call completes
        const resultPromise = new Promise<any>((resolve, reject) => {
          // Store the resolver in the window object so our event handler can manually resolve it
          // This is a workaround for when the API call times out but we receive the data via events
          (window as any)._permissions_promise_resolver = resolve;

          // Set up a timeout to avoid waiting forever
          const timeoutId = setTimeout(() => {
            timedOut = true;
            console.warn('⚠️ Permission fetch timed out after 20 seconds');
            // Remove the debug event listener after timeout
            window.removeEventListener('message', handleDebugMessage);

            // Check if we got permissions from the event in the meantime
            if ((window as any)._permissions_received_via_event) {
              console.log('🎯 Using permissions from event after timeout');
              // Use the last permissions payload received via event
              const eventPayload = (window as any)._last_permissions_payload;

              // Resolve with the event payload instead
              if (eventPayload) {
                permissionResponse = eventPayload;
                resolve(eventPayload);
              } else {
                // Still reject if no event data is available
                reject(new Error('Permission fetch timed out and no event data available'));
              }
            } else {
              // No event data available - don't reject here - we'll continue with the API call
              console.log('No event data available after timeout - continuing with API call');
            }

            // Clear the resolver reference
            (window as any)._permissions_promise_resolver = null;
          }, 20000); // Increased timeout for waiting

          // Make the actual API call
          MiniKit.commandsAsync.getPermissions()
            .then(result => {
              clearTimeout(timeoutId);
              window.removeEventListener('message', handleDebugMessage);
              permissionResponse = result;

              // Clear the resolver reference since we've resolved successfully
              (window as any)._permissions_promise_resolver = null;

              resolve(result);
            })
            .catch(err => {
              clearTimeout(timeoutId);
              window.removeEventListener('message', handleDebugMessage);

              // Check if we got permissions from the event in the meantime
              if ((window as any)._permissions_received_via_event) {
                // Use the last permissions payload received via event
                const eventPayload = (window as any)._last_permissions_payload;

                // Resolve with the event payload instead
                if (eventPayload) {
                  permissionResponse = eventPayload;
                  resolve(eventPayload);
                } else {
                  // Still reject if no event data is available
                  reject(err);
                }
              } else {
                // No event data, reject with original error
                reject(err);
              }

              // Clear the resolver reference
              (window as any)._permissions_promise_resolver = null;
            });
        });
        
        try {
          // Await the API call with a timeout
          await resultPromise;
        } catch (error) {
          console.error('❌ Error fetching permissions:', error);
          setPermissions({
            notifications: false,
            contacts: false,
          });
          setIsLoading(false);
          return;
        }
        
        // Even if we timed out, we'll process the result if we got one
        if (permissionResponse) {
          // Explicitly cast to any to avoid type errors with external API responses
          const response = permissionResponse as any;

          try {
            // Check for direct response structure (per docs)
            if (response.status === 'success' && response.permissions) {
              const perms = response.permissions || {};

              // Set permissions with appropriate type conversion
              setPermissions({
                notifications: Boolean(perms.notifications),
                contacts: Boolean(perms.contacts),
              });
            }
            // For backward compatibility, also check for finalPayload structure
            else if (response.finalPayload && response.finalPayload.status === 'success') {
              // Try to extract permissions
              const perms = response.finalPayload.permissions || {};

              // Set permissions with appropriate type conversion
              setPermissions({
                notifications: Boolean(perms.notifications),
                contacts: Boolean(perms.contacts),
              });
            } else {
              // Default permissions on failure

              // Use default permissions on failure
              setPermissions({
                notifications: false,
                contacts: false,
              });
            }
          } catch (_parseError) {
            // Use default permissions on parse error
            setPermissions({
              notifications: false,
              contacts: false,
            });
          }
        } else if (timedOut) {
          // Use default permissions on timeout
          setPermissions({
            notifications: false,
            contacts: false,
          });
        }
      } catch (_error) {

        // Use default permissions on error
        setPermissions({
          notifications: false,
          contacts: false,
        });
      } finally {
        setIsLoading(false);
      }
    };

    // Fetch permissions on mount and whenever MiniKit installation changes
    fetchPermissions();

    // Add window event handler for permission changes
    const handleMessage = (event: MessageEvent) => {
      // Check if the message is from MiniKit and contains data
      if (event.data && typeof event.data === 'object') {
        // Handle permission update events
        if (event.data.type === 'miniapp-get-permissions') {

          // Direct payload structure as documented
          if (event.data.status === 'success' && event.data.permissions) {
            try {
              const perms = event.data.permissions;

              // Set permissions with appropriate type conversion
              setPermissions({
                notifications: Boolean(perms.notifications),
                contacts: Boolean(perms.contacts),
              });

              setIsLoading(false);
              return; // We've handled this event
            } catch (error) {
              console.error('Error processing direct permissions from event:', error);
            }
          }

          // Legacy format with payload property
          if (event.data.payload) {
            // Check for direct format within payload
            if (event.data.payload.status === 'success' && event.data.payload.permissions) {
              try {
                const perms = event.data.payload.permissions;

                // Set permissions with appropriate type conversion
                setPermissions({
                  notifications: Boolean(perms.notifications),
                  contacts: Boolean(perms.contacts),
                });

                setIsLoading(false);
              } catch (error) {
                console.error('Error processing permissions from event:', error);
                setIsLoading(false);
              }
            } else if (event.data.payload.permissions) {
              // Try plain payload.permissions
              try {
                const perms = event.data.payload.permissions;

                // Set permissions with appropriate type conversion
                setPermissions({
                  notifications: Boolean(perms.notifications),
                  contacts: Boolean(perms.contacts),
                });

                setIsLoading(false);
              } catch (error) {
                console.error('Error processing permissions from event:', error);
                setIsLoading(false);
              }
            } else {
              setIsLoading(false);
            }
          } else {
            setIsLoading(false);
          }
        }
        
        // Handle permission change events
        if (
          (event.data.type === 'miniapp-request-permission' ||
           event.data.type === 'miniapp-permission-changed') &&
          event.data.payload
        ) {
          // Track which permission was changed
          const permissionChanged = event.data.payload.permission;
          
          // Trigger a refresh of permissions - use Promise chain instead of async/await
          // Create a promise with timeout for the refresh
          // We'll use the Promise.race below to handle timeouts
          new Promise<null>((resolve) => {
            setTimeout(() => {
              resolve(null);
            }, 5000);
          });

          // Start the MiniKit call
          MiniKit.commandsAsync.getPermissions()
            .then(result => {
              // Cast result to any to handle different response structures
              const resultData = result as any;

              // Check for direct response structure (per docs)
              if (resultData.status === 'success' && resultData.permissions) {
                const perms = resultData.permissions || {};

                // Update all permissions
                setPermissions({
                  notifications: Boolean(perms.notifications),
                  contacts: Boolean(perms.contacts),
                });
              }
              // For backward compatibility, also check for finalPayload structure
              else if (resultData.finalPayload && resultData.finalPayload.status === 'success') {
                const perms = resultData.finalPayload.permissions || {};

                // Update all permissions
                setPermissions({
                  notifications: Boolean(perms.notifications),
                  contacts: Boolean(perms.contacts),
                });
              } else {

                // If we know which permission was changed, update just that one from the event
                updatePermissionFromEvent(permissionChanged, event.data.payload.value);
              }
            })
            .catch(_error => {
              // Try to update from event if we have the data
              updatePermissionFromEvent(permissionChanged, event.data.payload.value);
            })
            .finally(() => {
              setIsLoading(false);
            });
            
          // Helper function to update a single permission from the event
          function updatePermissionFromEvent(permission: string, value: any) {
            if (permission && (permission === 'notifications' || permission === 'contacts')) {
              if (typeof value === 'boolean') {
                // Update just the changed permission
                setPermissions(prev => ({
                  ...prev,
                  [permission]: value
                }));
              }
            }
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [isInstalled]);

  // Request notifications permission
  const requestNotificationsPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !isInstalled) {
      return false;
    }

    try {
      // Using any for MiniKit types to handle potential API changes
      const result = await MiniKit.commandsAsync.requestPermission({
        permission: 'notifications' as any,
      });

      if (result.finalPayload.status === 'success') {
        // Update local permissions state
        setPermissions(prev => ({
          ...prev,
          notifications: true,
        }));
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to request notifications permission:', error);
      return false;
    }
  }, [isInstalled]);

  // Request contacts permission
  const requestContactsPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !isInstalled) {
      return false;
    }

    try {
      // Using any for MiniKit types to handle potential API changes
      const result = await MiniKit.commandsAsync.requestPermission({
        permission: 'contacts' as any,
      });

      if (result.finalPayload.status === 'success') {
        // Update local permissions state
        setPermissions(prev => ({
          ...prev,
          contacts: true,
        }));
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to request contacts permission:', error);
      return false;
    }
  }, [isInstalled]);

  // Create context value
  const value = {
    permissions,
    isLoading,
    requestNotificationsPermission,
    requestContactsPermission,
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

// Custom hook to use permissions
export function usePermissions() {
  const context = useContext(PermissionsContext);
  
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  
  return context;
}