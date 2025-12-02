'use client';

import React from 'react';
import { LiveFeedback } from '@worldcoin/mini-apps-ui-kit-react';
import { Choice, VerificationState } from '../types';

interface VerificationOverlayProps {
  verifying: boolean;
  verificationChoice: Choice | null;
  verificationState: VerificationState;
  verificationError: string | null;
}

const VerificationOverlay: React.FC<VerificationOverlayProps> = ({
  verifying,
  verificationChoice,
  verificationState,
  verificationError
}) => {
  if (!verifying) return null;

  return (
    <div
      className="flex items-center justify-center transition-opacity duration-300"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.92)',
        backgroundImage: 'linear-gradient(to bottom, rgba(30, 64, 175, 0.1), rgba(0, 0, 0, 0.92))',
        backdropFilter: 'blur(12px)',
        zIndex: 100, /* Higher than game result overlay */
        position: 'absolute',
        top: '1.75rem', // Start below the tab navigation
        left: 0,
        right: 0,
        bottom: 0,
        borderBottomLeftRadius: '1rem',
        borderBottomRightRadius: '1rem',
        padding: '2rem',
        boxShadow: 'inset 0 0 50px rgba(59, 130, 246, 0.2)'
      }}
    >
      <div className="text-center max-w-xs">
        <div className="text-4xl mb-4" style={{ filter: 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.5))' }}>🔒</div>
        <h3 className="text-xl font-bold mb-4" style={{
          color: '#ffffff',
          textShadow: '0 0 10px rgba(255, 255, 255, 0.5)',
          background: 'linear-gradient(180deg, #ffffff 0%, #e2e8f0 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5))'
        }}>
          Verifying Your {verificationChoice && verificationChoice.charAt(0).toUpperCase() + verificationChoice.slice(1)} Move
        </h3>

        <div className="w-full mb-4" style={{
          color: verificationState === 'failed' ? '#ff6b6b' : // Brighter red for failed
                 verificationState === 'success' ? '#4ade80' : // Brighter green for success
                 '#f8fafc', // Brighter white for pending
          fontWeight: 600,
          fontSize: '16px',
          textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)',
          padding: '10px',
          backgroundColor: verificationState === 'failed' ? 'rgba(239, 68, 68, 0.2)' :
                          verificationState === 'success' ? 'rgba(16, 185, 129, 0.2)' :
                          'rgba(255, 255, 255, 0.1)',
          borderRadius: '8px'
        }}>
          <LiveFeedback
            label={{
              failed: verificationError || 'Verification failed',
              pending: `Verifying your ${verificationChoice} move...`,
              success: 'Identity verified! Processing your move...',
            }}
            state={verificationState}
          >
          <div className="flex justify-center items-center h-10">
            {verificationState === 'pending' && (
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-200 border-t-blue-500" style={{
                filter: 'drop-shadow(0 0 5px rgba(59, 130, 246, 0.5))'
              }}></div>
            )}
            {verificationState === 'failed' && (
              <div className="flex items-center justify-center" style={{
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                borderRadius: '50%',
                width: '40px',
                height: '40px'
              }}>
                <span className="text-3xl" style={{ color: '#ef4444' }}>⚠️</span>
              </div>
            )}
            {verificationState === 'success' && (
              <div className="flex items-center justify-center" style={{
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                borderRadius: '50%',
                width: '40px',
                height: '40px'
              }}>
                <span className="text-3xl" style={{ color: '#10b981' }}>✓</span>
              </div>
            )}
          </div>
        </LiveFeedback>
        </div>

        {verificationState === 'failed' && (
          <div className="mt-4 mb-4 max-w-xs mx-auto p-3 rounded-lg" style={{
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            boxShadow: '0 0 10px rgba(239, 68, 68, 0.2)'
          }}>
            <p className="text-sm font-semibold" style={{
              color: '#fca5a5',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)'
            }}>
              {verificationError}
            </p>
            <p className="text-sm font-medium mt-2" style={{
              color: '#fcd34d',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)'
            }}>
              You can try again in a moment
            </p>
          </div>
        )}

        <p className="text-sm mt-4 p-2 rounded-md" style={{
          color: verificationState === 'failed' ? '#f1f5f9' : // Brighter white for failed
                verificationState === 'success' ? '#d1fae5' : // Light green tint for success
                '#e2e8f0', // Light gray for pending
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
          fontWeight: 500
        }}>
          {verificationState === 'failed'
            ? "Don't worry! This doesn't affect your game progress."
            : "World ID verification is required for fair gameplay and to prevent cheating."}
        </p>
      </div>
    </div>
  );
};

export default VerificationOverlay;