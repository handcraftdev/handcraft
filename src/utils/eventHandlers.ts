'use client';

import { MiniKit } from '@worldcoin/minikit-js';

/**
 * Register global event handlers for MiniKit
 * 
 * This utility adds direct event handlers to the MiniKit object.
 * Should be called early in the application lifecycle.
 */
export function registerGlobalEventHandlers() {
  if (typeof window === 'undefined') return;

  // Get the original trigger function to add our handler
  const originalTrigger = (MiniKit as any).trigger;
  
  if (!originalTrigger) return;

  // Patch the MiniKit.trigger function to handle the miniapp-get-permissions event
  (MiniKit as any).trigger = function(eventName: string, payload: any) {
    // Handle the miniapp-get-permissions event
    if (eventName === 'miniapp-get-permissions') {
      try {
        // Try to manually parse permissions data and store for debugging and direct use
        if (payload && payload.permissions) {
          // Store permissions in window object for direct use by our context
          (window as any)._debug_permissions = payload.permissions;
          (window as any)._debug_permissions_timestamp = new Date().toISOString();

          // Set a flag to indicate we have received permissions directly
          (window as any)._permissions_received_via_event = true;

          // Also store the raw event for reference
          (window as any)._last_permissions_payload = payload;

          // HACK: Since our API call times out, let's manually simulate its completion
          // This is a workaround until we can figure out why the API call isn't returning
          if ((window as any)._permissions_promise_resolver) {
            try {
              (window as any)._permissions_promise_resolver(payload);
              // Clear the resolver after use
              (window as any)._permissions_promise_resolver = null;
            } catch (e) {
              console.error('Error manually resolving permissions promise:', e);
            }
          }
        }
      } catch (error) {
        console.error('Error processing debug permissions:', error);
      }

      // We're handling this with our own permissions context, so don't need to do anything else
      return true;
    }

    // Call the original trigger for other events
    return originalTrigger.call(this, eventName, payload);
  };
  
  // Global MiniKit event handlers registered
}