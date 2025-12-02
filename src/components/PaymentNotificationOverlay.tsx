'use client';

import React, { useEffect } from 'react';
import { LiveFeedback } from '@worldcoin/mini-apps-ui-kit-react';

export type PaymentState = 'idle' | 'pending' | 'success' | 'failed';

interface PaymentNotificationOverlayProps {
  state: PaymentState;
  visible: boolean;
  message?: string;
  onClose?: () => void;
  autoCloseDelay?: number; // Time in ms before auto-closing on success
}

const PaymentNotificationOverlay: React.FC<PaymentNotificationOverlayProps> = ({
  state,
  visible,
  message,
  onClose,
  autoCloseDelay = 2000, // Default to 2 seconds for success state
}) => {
  useEffect(() => {
    // Auto-close the notification on success after delay
    if (state === 'success' && visible && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDelay);
      
      return () => clearTimeout(timer);
    }
  }, [state, visible, onClose, autoCloseDelay]);

  if (!visible || state === 'idle') return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '1rem',
        transition: 'opacity 0.3s ease'
      }}
      onClick={state !== 'pending' ? onClose : undefined}
    >
      <div 
        style={{
          backgroundColor: 'white',
          borderRadius: '1rem',
          padding: '1.5rem',
          width: '90%',
          maxWidth: '320px',
          textAlign: 'center',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
        }}
        onClick={e => e.stopPropagation()} // Prevent closing when clicking inside
      >
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
          {state === 'pending' && '⏳'}
          {state === 'success' && '✅'}
          {state === 'failed' && '❌'}
        </div>

        <div style={{ width: '100%', marginBottom: '1rem' }}>
          <LiveFeedback
            label={{
              failed: message || 'Payment failed',
              pending: message || 'Processing payment...',
              success: message || 'Payment successful!',
            }}
            state={state}
          >
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '2.5rem', 
            fontWeight: 'bold',
            color: state === 'failed' ? '#ef4444' : 
                  state === 'success' ? '#10b981' : 
                  '#6366f1'
          }}>
            {state === 'pending' && (
              <div style={{ 
                display: 'inline-block',
                width: '1.5rem',
                height: '1.5rem',
                borderWidth: '3px',
                borderStyle: 'solid',
                borderColor: 'rgba(99, 102, 241, 0.3)',
                borderTopColor: '#6366f1',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            )}
            <style dangerouslySetInnerHTML={{
              __html: `
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
              `
            }} />
          </div>
        </LiveFeedback>
        </div>

        {state === 'failed' && (
          <p style={{ 
            fontSize: '0.875rem', 
            color: '#dc2626', 
            marginTop: '0.5rem', 
            marginBottom: '1rem' 
          }}>
            Please try again
          </p>
        )}

        {state !== 'pending' && (
          <button
            onClick={onClose}
            style={{
              backgroundColor: state === 'success' ? '#10b981' : '#6366f1',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1.5rem',
              borderRadius: '0.5rem',
              fontWeight: 'bold',
              marginTop: '1rem',
              cursor: 'pointer'
            }}
          >
            {state === 'success' ? 'Continue' : 'Close'}
          </button>
        )}
      </div>
    </div>
  );
};

export default PaymentNotificationOverlay;