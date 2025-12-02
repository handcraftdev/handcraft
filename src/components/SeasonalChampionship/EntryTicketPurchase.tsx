'use client';

import React, { useState } from 'react';
import { MiniKit } from '@worldcoin/minikit-js';
import { Season } from '@/repositories';
import { useWorldPayment, PAYMENT_TIERS } from '@/hooks/useWorldPayment';
import { useSeasonalChampionship } from '@/contexts/SeasonalChampionshipContext';
import PaymentNotificationOverlay from '@/components/PaymentNotificationOverlay';

interface ElementalEssencesForUI {
  rockEssence: number;
  paperEssence: number;
  scissorsEssence: number;
}

interface EntryTicketPurchaseProps {
  season: Season;
  onPurchase: () => Promise<boolean>;
  essences: ElementalEssencesForUI;
}

type PaymentMethod = 'essence' | 'world';

const EntryTicketPurchase: React.FC<EntryTicketPurchaseProps> = ({
  season,
  onPurchase,
  essences
}) => {
  // Entry fee is 15 of each essence - approximately 2 days of casual play
  const entryFee = {
    rock: 15,
    paper: 15,
    scissors: 15
  };
  
  // State for payment method and purchase processing
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('world');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayMessage, setOverlayMessage] = useState('');

  // World payment integration
  const { paymentState, processPayment, resetPaymentState } = useWorldPayment();
  const isWorldAppAvailable = typeof MiniKit !== 'undefined';

  // Get championship context for direct refresh
  const championship = useSeasonalChampionship();
  
  // Check if player has enough essence
  const hasEnoughEssence = 
    essences.rockEssence >= entryFee.rock &&
    essences.paperEssence >= entryFee.paper &&
    essences.scissorsEssence >= entryFee.scissors;
  
  // Determine if player can proceed with purchase
  const canPurchase = paymentMethod === 'world' ? isWorldAppAvailable : hasEnoughEssence;
  
  // Handle purchase button click
  const handlePurchaseClick = async () => {
    setIsPurchasing(true);

    try {
      let success = false;

      if (paymentMethod === 'world' && isWorldAppAvailable) {
        // Process with World payment
        setOverlayMessage(`League Entry Ticket - Season: ${season.name}`);
        setShowOverlay(true);

        const description = `League Entry Ticket - Season: ${season.name}`;
        const result = await processPayment('leagueEntry', '', description);
        success = result.success;

        // For WLD payments, we need to manually handle refreshing data after transaction is verified
        // This makes it behave the same as essence payments, which trigger data refresh
        if (success && result.transactionId) {
          // Create a function to poll transaction status with progressive backoff
          const pollTransactionStatus = async (transactionId: string, maxAttempts = 6) => {
            // Checking transaction status with progressive backoff

            for (let attempt = 0; attempt < maxAttempts; attempt++) {
              try {
                // Check transaction status
                const statusResponse = await fetch(`/api/payment-status?transactionId=${transactionId}`, {
                  headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                  }
                });

                if (!statusResponse.ok) {
                  // Error checking transaction status
                  // Use exponential backoff: 1s, 2s, 4s, 8s, etc.
                  const backoffTime = Math.min(Math.pow(2, attempt) * 1000, 8000); // Cap at 8 seconds
                  await new Promise(resolve => setTimeout(resolve, backoffTime));
                  continue;
                }

                const statusData = await statusResponse.json();
                // Transaction status check

                // If transaction is verified, refresh championship data and exit
                if (statusData.status === 'verified') {
                  // Transaction verified, refreshing data
                  await championship.refreshData();
                  return true;
                }

                // If transaction failed, stop polling
                if (statusData.status === 'failed') {
                  // Transaction failed
                  return false;
                }

                // Transaction is still pending, wait with exponential backoff and try again
                const backoffTime = Math.min(Math.pow(2, attempt) * 1000, 8000); // Cap at 8 seconds
                // Transaction still pending, waiting before next check
                await new Promise(resolve => setTimeout(resolve, backoffTime));
              } catch (_error) {
                // Error polling transaction status
                // Use exponential backoff on errors too
                const backoffTime = Math.min(Math.pow(2, attempt) * 1000, 8000);
                await new Promise(resolve => setTimeout(resolve, backoffTime));
              }
            }

            // If we reach here, we've exceeded max attempts
            // Max attempts reached, forcing refresh anyway
            await championship.refreshData();
            return false;
          };

          // Start polling after a short delay to let UI show success
          setTimeout(() => {
            pollTransactionStatus(result.transactionId!).catch(_error => {
              // Error in polling process
            });
          }, 500);
        }
      } else {
        // Process with essence payment - this calls refreshData internally
        success = await onPurchase();
      }

      return success;
    } finally {
      setIsPurchasing(false);
    }
  };
  
  // Render the payment methods section
  const renderPaymentMethods = () => {
    if (!isWorldAppAvailable) {
      return null; // Only show essence payment if World App is not available
    }

    return (
      <div style={{
        width: '100%',
        marginTop: '0.75rem',
        marginBottom: '0.75rem',
        padding: '0.5rem',
        backgroundColor: '#f5f7f9',
        borderRadius: '0.5rem',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: '#e5e7eb'
      }}>
        <div style={{
          fontSize: '0.75rem',
          fontWeight: 'bold',
          color: '#4b5563',
          marginBottom: '0.5rem',
          textAlign: 'center'
        }}>
          PAYMENT METHOD
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '0.5rem'
        }}>
          <button
            onClick={() => setPaymentMethod('world')}
            style={{
              fontSize: '0.8rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontWeight: 'medium',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              width: '50%',
              justifyContent: 'center',
              borderWidth: '2px',
              borderStyle: 'solid',
              borderColor: paymentMethod === 'world' ? '#2563eb' : '#e5e7eb',
              backgroundColor: paymentMethod === 'world' ? '#eff6ff' : '#f9fafb',
              color: paymentMethod === 'world' ? '#1e40af' : '#374151',
              boxShadow: paymentMethod === 'world' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
              position: 'relative'
            }}
          >
            <span style={{ fontSize: '1rem' }}>🌍</span>
            <span>World Pay</span>
            {paymentMethod === 'world' && (
              <span style={{
                position: 'absolute',
                top: '-8px',
                right: '-8px',
                backgroundColor: '#2563eb',
                color: 'white',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 'bold'
              }}>✓</span>
            )}
          </button>
          <button
            onClick={() => setPaymentMethod('essence')}
            style={{
              fontSize: '0.8rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontWeight: 'medium',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              width: '50%',
              justifyContent: 'center',
              borderWidth: '2px',
              borderStyle: 'solid',
              borderColor: paymentMethod === 'essence' ? '#2563eb' : '#e5e7eb',
              backgroundColor: paymentMethod === 'essence' ? '#eff6ff' : '#f9fafb',
              color: paymentMethod === 'essence' ? '#1e40af' : '#374151',
              boxShadow: paymentMethod === 'essence' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
              position: 'relative'
            }}
          >
            <span style={{ fontSize: '1rem' }}>💎</span>
            <span>Essence</span>
            {paymentMethod === 'essence' && (
              <span style={{
                position: 'absolute',
                top: '-8px',
                right: '-8px',
                backgroundColor: '#2563eb',
                color: 'white',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 'bold'
              }}>✓</span>
            )}
          </button>
        </div>
      </div>
    );
  };
  
  // Render the entry fee section based on payment method
  const renderEntryFeeSection = () => {
    if (paymentMethod === 'world' && isWorldAppAvailable) {
      // World payment price
      return (
        <div style={{
          flex: '1',
          padding: '0.5rem 0.75rem',
          backgroundColor: '#eff6ff',
          borderRadius: '0.5rem',
          border: '1px solid #bfdbfe',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <div style={{
            fontWeight: '600',
            color: '#1e40af',
            fontSize: '0.7rem',
            margin: '0 0 0.25rem 0',
            textAlign: 'center'
          }}>Entry Fee</div>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: '0.8rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '0.15rem', fontSize: '0.9rem' }}>🪙</span>
              <span style={{ color: '#1d4ed8' }}>
                {PAYMENT_TIERS.leagueEntry.wldAmount} WLD
              </span>
            </div>
          </div>
        </div>
      );
    } else {
      // Essence payment
      return (
        <div style={{
          flex: '1',
          padding: '0.5rem 0.75rem',
          backgroundColor: '#eff6ff',
          borderRadius: '0.5rem',
          border: '1px solid #bfdbfe',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <div style={{
            fontWeight: '600',
            color: '#1e40af',
            fontSize: '0.7rem',
            margin: '0 0 0.25rem 0',
            textAlign: 'center'
          }}>Entry Fee</div>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '0.15rem', fontSize: '0.9rem' }}>✊</span>
              <span style={{
                color: essences.rockEssence < entryFee.rock ? '#ef4444' : '#1d4ed8',
                fontWeight: essences.rockEssence < entryFee.rock ? '600' : '500',
                fontSize: '0.85rem'
              }}>
                {entryFee.rock}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '0.15rem', fontSize: '0.9rem' }}>✋</span>
              <span style={{
                color: essences.paperEssence < entryFee.paper ? '#ef4444' : '#1d4ed8',
                fontWeight: essences.paperEssence < entryFee.paper ? '600' : '500',
                fontSize: '0.85rem'
              }}>
                {entryFee.paper}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '0.15rem', fontSize: '0.9rem' }}>✌️</span>
              <span style={{
                color: essences.scissorsEssence < entryFee.scissors ? '#ef4444' : '#1d4ed8',
                fontWeight: essences.scissorsEssence < entryFee.scissors ? '600' : '500',
                fontSize: '0.85rem'
              }}>
                {entryFee.scissors}
              </span>
            </div>
          </div>
        </div>
      );
    }
  };
  
  // Handle closing the overlay
  const handleCloseOverlay = () => {
    setShowOverlay(false);
    resetPaymentState();
  };

  // Render the purchase button based on payment state
  const renderPurchaseButton = () => {
    const buttonStyle = {
      width: '100%',
      padding: '0.75rem',
      borderRadius: '0.5rem',
      fontWeight: 'bold' as const,
      fontSize: '0.9rem',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      transition: 'all 0.2s ease',
      backgroundColor: canPurchase ? '#2563eb' : '#d1d5db',
      color: canPurchase ? 'white' : '#6b7280',
      cursor: canPurchase ? 'pointer' : 'not-allowed',
      border: 'none',
      outline: 'none',
      position: 'relative' as const,
      overflow: 'hidden'
    };

    // Regular purchase button (overlay will handle payment state display)
    return (
      <button
        onClick={handlePurchaseClick}
        disabled={!canPurchase || isPurchasing || (paymentMethod === 'world' && paymentState === 'pending')}
        style={{
          ...buttonStyle,
          backgroundColor: (!canPurchase || isPurchasing || (paymentMethod === 'world' && paymentState === 'pending')) ? '#d1d5db' : '#2563eb',
          color: (!canPurchase || isPurchasing || (paymentMethod === 'world' && paymentState === 'pending')) ? '#6b7280' : 'white',
          cursor: (!canPurchase || isPurchasing || (paymentMethod === 'world' && paymentState === 'pending')) ? 'not-allowed' : 'pointer'
        }}
        onMouseOver={(e) => {
          if (canPurchase && !isPurchasing && !(paymentMethod === 'world' && paymentState === 'pending')) {
            e.currentTarget.style.backgroundColor = '#1d4ed8';
            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }
        }}
        onMouseOut={(e) => {
          if (canPurchase && !isPurchasing && !(paymentMethod === 'world' && paymentState === 'pending')) {
            e.currentTarget.style.backgroundColor = '#2563eb';
            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
            e.currentTarget.style.transform = 'translateY(0)';
          }
        }}
      >
        {canPurchase ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
            <span>🏆</span>
            <span>Join League Now</span>
            <span>🏆</span>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.25rem' }}>
            <span>🙅‍♂️</span>
            <span>
              {paymentMethod === 'world'
                ? 'World App Required'
                : 'Not Enough Essence'}
            </span>
          </div>
        )}
      </button>
    );
  };
  
  // Render the footer message based on payment method and status
  const renderFooterMessage = () => {
    // For World App payment
    if (paymentMethod === 'world') {
      if (!isWorldAppAvailable) {
        return (
          <div style={{
            marginTop: '0.75rem',
            padding: '0.4rem 0.5rem',
            backgroundColor: '#fef2f2',
            borderRadius: '0.25rem',
            border: '1px solid #fee2e2'
          }}>
            <p style={{
              fontSize: '0.7rem',
              color: '#dc2626',
              margin: 0,
              lineHeight: 1.3
            }}>
              World App is required for this payment method.
              Please open this app in the World App to use this feature.
            </p>
          </div>
        );
      }
      
      if (canPurchase) {
        return (
          <p style={{
            marginTop: '0.75rem',
            fontSize: '0.7rem',
            color: '#4b5563',
            lineHeight: 1.3
          }}>
            Click the button above to join the league using World Pay!
          </p>
        );
      }
    }
    
    // For Essence payment
    if (paymentMethod === 'essence') {
      if (!hasEnoughEssence) {
        return (
          <div style={{
            marginTop: '0.75rem',
            padding: '0.4rem 0.5rem',
            backgroundColor: '#fef2f2',
            borderRadius: '0.25rem',
            border: '1px solid #fee2e2'
          }}>
            <p style={{
              fontSize: '0.7rem',
              color: '#dc2626',
              margin: 0,
              lineHeight: 1.3
            }}>
              You don&apos;t have enough essence to purchase an entry ticket.
              Play more games to earn essence or use World Pay!
            </p>
          </div>
        );
      }
      
      if (hasEnoughEssence) {
        return (
          <p style={{
            marginTop: '0.75rem',
            fontSize: '0.7rem',
            color: '#4b5563',
            lineHeight: 1.3
          }}>
            Click the button above to join the league and start competing!
          </p>
        );
      }
    }
    
    return null;
  };
  
  return (
    <div style={{
      padding: '1rem',
      backgroundColor: 'white',
      borderRadius: '0.5rem',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      border: '2px solid #60a5fa',
      textAlign: 'center',
      position: 'relative',
      marginTop: '0.5rem'
    }}>
      {/* Payment notification overlay */}
      <PaymentNotificationOverlay
        state={paymentState}
        visible={showOverlay}
        message={overlayMessage}
        onClose={handleCloseOverlay}
      />
      <div style={{
        position: 'absolute',
        top: '-0.75rem',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#2563eb',
        color: 'white',
        padding: '0.25rem 1rem',
        borderRadius: '9999px',
        fontSize: '0.875rem',
        fontWeight: 'bold',
        zIndex: 10
      }}>
        Join Now!
      </div>

      <div style={{
        padding: '0.5rem 0.75rem',
        background: 'linear-gradient(to right, #2563eb, #7c3aed)',
        color: 'white',
        borderRadius: '0.5rem',
        marginBottom: '0.75rem'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 'bold', margin: 0 }}>
              {season.name}
            </h3>
            {season.description && (
              <p style={{
                fontSize: '0.75rem',
                color: '#bfdbfe',
                marginTop: '0.125rem',
                marginBottom: 0
              }}>
                {season.description}
              </p>
            )}
          </div>
          <div style={{ fontSize: '1.75rem' }}>🏆</div>
        </div>
        <p style={{
          color: '#93c5fd',
          margin: '0.5rem 0 0 0',
          fontSize: '0.7rem',
          fontWeight: '500'
        }}>
          Join the league now and climb the ranks to win rewards!
        </p>
      </div>

      {/* Payment methods section */}
      {renderPaymentMethods()}

      {/* Season ends and entry fee section - side by side */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        width: '100%',
        marginBottom: '0.75rem',
        justifyContent: 'center'
      }}>
        {/* Season end timer - left column */}
        <div style={{
          flex: '1',
          backgroundColor: '#eff6ff',
          border: '1px solid #dbeafe',
          borderRadius: '0.5rem',
          padding: '0.5rem 0.75rem 0.35rem',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.7rem', color: '#1e40af', fontWeight: '600' }}>
            Season Ends In
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.25rem',
            marginTop: '0.25rem',
            color: '#1e40af',
            fontSize: '0.8rem',
            fontWeight: '600'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{
                backgroundColor: 'white',
                borderRadius: '0.25rem',
                padding: '0.25rem 0.3rem',
                minWidth: '1.5rem'
              }}>{Math.floor((new Date(season.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}</span>
              <span style={{ fontSize: '0.6rem', marginTop: '0.125rem' }}>Days</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{
                backgroundColor: 'white',
                borderRadius: '0.25rem',
                padding: '0.25rem 0.3rem',
                minWidth: '1.5rem'
              }}>{Math.floor((new Date(season.endDate).getTime() - new Date().getTime()) % (1000 * 60 * 60 * 24) / (1000 * 60 * 60))}</span>
              <span style={{ fontSize: '0.6rem', marginTop: '0.125rem' }}>Hrs</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{
                backgroundColor: 'white',
                borderRadius: '0.25rem',
                padding: '0.25rem 0.3rem',
                minWidth: '1.5rem'
              }}>{Math.floor((new Date(season.endDate).getTime() - new Date().getTime()) % (1000 * 60 * 60) / (1000 * 60))}</span>
              <span style={{ fontSize: '0.6rem', marginTop: '0.125rem' }}>Min</span>
            </div>
          </div>
        </div>

        {/* Entry fee section - right column */}
        {renderEntryFeeSection()}
      </div>

      <div style={{
        marginBottom: '0.75rem',
        padding: '0.5rem 0.75rem',
        backgroundColor: '#f0f9ff',
        borderRadius: '0.5rem',
        border: '1px solid #bae6fd',
        textAlign: 'center',
        fontSize: '0.75rem',
        width: '100%'
      }}>
        <h4 style={{
          fontWeight: '600',
          color: '#0369a1',
          marginBottom: '0.25rem',
          fontSize: '0.7rem',
          textAlign: 'center'
        }}>League Rewards</h4>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.25rem',
          fontSize: '0.7rem',
          width: '100%',
          margin: '0 auto'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,215,0,0.1)',
            padding: '0.25rem',
            borderRadius: '0.25rem',
            border: '1px solid rgba(255,215,0,0.3)'
          }}>
            <span style={{ marginRight: '0.25rem', fontSize: '0.8rem' }}>🥇</span>
            <span>Top Player Prizes</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(229,228,226,0.1)',
            padding: '0.25rem',
            borderRadius: '0.25rem',
            border: '1px solid rgba(229,228,226,0.3)'
          }}>
            <span style={{ marginRight: '0.25rem', fontSize: '0.8rem' }}>💎</span>
            <span>Tier Rewards</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(34,197,94,0.1)',
            padding: '0.25rem',
            borderRadius: '0.25rem',
            border: '1px solid rgba(34,197,94,0.3)'
          }}>
            <span style={{ marginRight: '0.25rem', fontSize: '0.8rem' }}>🏆</span>
            <span>Special Titles</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(59,130,246,0.1)',
            padding: '0.25rem',
            borderRadius: '0.25rem',
            border: '1px solid rgba(59,130,246,0.3)'
          }}>
            <span style={{ marginRight: '0.25rem', fontSize: '0.8rem' }}>📈</span>
            <span>Rank Progress</span>
          </div>
        </div>
      </div>

      {/* Purchase button */}
      {renderPurchaseButton()}

      {/* Footer message */}
      {renderFooterMessage()}
    </div>
  );
};

export default EntryTicketPurchase;