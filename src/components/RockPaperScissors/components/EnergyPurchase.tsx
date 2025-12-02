'use client';

import React, { useState } from 'react';
import { SeasonalChampionshipContextType, useSeasonalChampionship } from '@/contexts/SeasonalChampionshipContext';
import { useWorldPayment, PAYMENT_TIERS } from '@/hooks/useWorldPayment';
import { MiniKit } from '@worldcoin/minikit-js';
import PaymentNotificationOverlay from '@/components/PaymentNotificationOverlay';
import { Essences } from '@/contexts/ElementalEssencesContext';
import { useEnergy } from '@/contexts/EnergyContext';

interface EnergyPurchaseProps {
  onPurchase: (size: 'small' | 'medium' | 'large') => Promise<boolean>;
  essences: Essences;
  championship?: SeasonalChampionshipContextType;
}

// Inline CSS styles to avoid Tailwind dependencies
const styles = {
  container: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: '0.75rem',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e5e7eb',
    overflow: 'hidden'
  },
  header: {
    padding: '0.5rem 0.75rem',
    borderBottom: '1px solid #e5e7eb',
    background: 'linear-gradient(to right, #eef2ff, #f5f3ff)',
  },
  headerTitle: {
    fontWeight: 600,
    color: '#4338ca',
    fontSize: '0.9rem',
    marginBottom: '0.125rem'
  },
  headerSubtitle: {
    fontSize: '0.875rem',
    color: '#6366f1'
  },
  content: {
    padding: '0.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    backgroundColor: 'white'
  },
  packContainer: {
    padding: '0.5rem 0.75rem',
    borderRadius: '0.5rem',
    border: '1px solid #e5e7eb',
    backgroundColor: 'white',
    position: 'relative',
    transition: 'all 0.2s ease'
  },
  packContainerSelected: {
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  packHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '0.25rem',
    position: 'relative'
  },
  packInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem'
  },
  packNameContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    marginBottom: '-0.125rem'
  },
  packName: {
    fontWeight: 'bold',
    color: '#1f2937',
    fontSize: '0.85rem'
  },
  priceTag: {
    padding: '0.25rem 0.5rem',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 'medium'
  },
  priceTagSmall: {
    backgroundColor: '#dbeafe',
    color: '#1e40af'
  },
  priceTagMedium: {
    backgroundColor: '#ede9fe',
    color: '#5b21b6'
  },
  priceTagLarge: {
    backgroundColor: '#d1fae5',
    color: '#065f46'
  },
  energyAmount: {
    fontSize: '0.9rem',
    fontWeight: 500,
    marginTop: '0.125rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem'
  },
  energyAmountSmall: {
    color: '#1d4ed8'
  },
  energyAmountMedium: {
    color: '#7e22ce'
  },
  energyAmountLarge: {
    color: '#047857'
  },
  costBadge: {
    display: 'inline-flex',
    backgroundColor: '#f3f4f6',
    padding: '0.15rem 0.25rem',
    borderRadius: '0.25rem',
    fontSize: '0.8rem',
    fontWeight: 500,
    gap: '0.5rem'
  },
  costItem: {
    color: '#4b5563'
  },
  paymentMethods: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '0.5rem'
  },
  paymentMethod: {
    fontSize: '0.75rem',
    padding: '0.25rem 0.5rem',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    fontWeight: 500,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem'
  },
  paymentMethodSelected: {
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
  },
  worldPaymentMethod: {
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    color: '#374151'
  },
  essencePaymentMethod: {
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    color: '#374151'
  },
  worldPrice: {
    fontSize: '0.85rem',
    color: '#2563eb',
    fontWeight: 500,
    marginTop: '0.125rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.2rem'
  },
  valueText: {
    fontSize: '0.75rem',
    color: '#6b7280',
    marginTop: '0.5rem'
  },
  discountText: {
    fontSize: '0.7rem',
    fontWeight: 500,
    marginTop: '0.125rem'
  },
  discountTextMedium: {
    color: '#7e22ce'
  },
  discountTextLarge: {
    color: '#047857'
  },
  bestValueBadge: {
    position: 'absolute',
    top: '-0.25rem',
    right: '-0.25rem',
    backgroundColor: '#10b981',
    color: 'white',
    padding: '0.15rem 0.3rem',
    borderRadius: '0.25rem',
    fontSize: '0.6rem',
    fontWeight: 'bold',
    transform: 'rotate(10deg)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
    zIndex: 1
  },
  purchaseButton: {
    padding: '0.375rem 0.75rem',
    borderRadius: '0.375rem',
    fontSize: '0.75rem',
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.2s ease'
  },
  purchaseButtonSmall: {
    backgroundColor: '#2563eb',
    color: 'white',
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
  },
  purchaseButtonSmallHover: {
    backgroundColor: '#1d4ed8'
  },
  purchaseButtonMedium: {
    backgroundColor: '#7c3aed',
    color: 'white',
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
  },
  purchaseButtonMediumHover: {
    backgroundColor: '#6d28d9'
  },
  purchaseButtonLarge: {
    backgroundColor: '#10b981',
    color: 'white',
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
  },
  purchaseButtonLargeHover: {
    backgroundColor: '#059669'
  },
  purchaseButtonDisabled: {
    backgroundColor: '#e5e7eb',
    color: '#9ca3af',
    cursor: 'not-allowed',
    boxShadow: 'none'
  },
  footer: {
    padding: '0.5rem 0.75rem',
    borderTop: '1px solid #e5e7eb',
    background: 'linear-gradient(to right, #eef2ff, #f5f3ff)'
  },
  footerContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.75rem',
    color: '#4b5563'
  },
  balanceText: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem'
  },
  balanceNumbers: {
    fontWeight: 500,
    color: '#374151'
  },
  conversionText: {
    color: '#6d28d9',
    fontWeight: 500
  }
};

// Define keyframes for animation
const keyframes = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

type PaymentMethod = 'essence' | 'world';

const EnergyPurchase: React.FC<EnergyPurchaseProps> = ({
  onPurchase,
  essences,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  championship
}) => {
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [selectedPack, setSelectedPack] = useState<'small' | 'medium' | 'large' | null>(null);
  const [buttonHoverStates, setButtonHoverStates] = useState({
    small: false,
    medium: false,
    large: false
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('world');
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayMessage, setOverlayMessage] = useState('');

  // World payment integration
  const { paymentState, processPayment, resetPaymentState } = useWorldPayment();
  const isWorldAppAvailable = typeof MiniKit !== 'undefined';

  // Get contexts for direct refresh
  const championshipContext = useSeasonalChampionship();
  const energyContext = useEnergy();
  
  // Define energy packs
  const energyPacks = {
    small: {
      name: "Small Pack",
      amount: 50,
      cost: { rock: 15, paper: 15, scissors: 15 }, // 45 essence total
      discount: null
    },
    medium: {
      name: "Medium Pack",
      amount: 150,
      cost: { rock: 30, paper: 30, scissors: 30 }, // 90 essence total
      discount: "50% more energy"
    },
    large: {
      name: "Large Pack",
      amount: 300,
      cost: { rock: 45, paper: 45, scissors: 45 }, // 135 essence total
      discount: "BEST VALUE • 100% more energy"
    }
  };
  
  // Check if player has enough essence for each pack
  const canPurchasePack = (packSize: 'small' | 'medium' | 'large') => {
    // If using World payment, no essence required
    if (paymentMethod === 'world' && isWorldAppAvailable) {
      return true;
    }
    
    // If using essence payment, check essence balance
    const pack = energyPacks[packSize];
    return (
      essences.rock >= pack.cost.rock &&
      essences.paper >= pack.cost.paper &&
      essences.scissors >= pack.cost.scissors
    );
  };
  
  // Handle purchase
  const handlePurchase = async (packSize: 'small' | 'medium' | 'large') => {
    if (isPurchasing) return;

    setSelectedPack(packSize);
    setIsPurchasing(true);

    try {
      let success = false;

      if (paymentMethod === 'world' && isWorldAppAvailable) {
        // Process with World payment
        setOverlayMessage(`${energyPacks[packSize].amount} Energy Credits (${energyPacks[packSize].name})`);
        setShowOverlay(true);

        const description = `${energyPacks[packSize].amount} Energy Credits (${energyPacks[packSize].name})`;
        const result = await processPayment('energy', packSize, description);
        success = result.success;

        // For WLD payments, poll transaction status to ensure it's verified before refreshing
        if (success && result.transactionId) {
          // Create a function to poll transaction status with progressive backoff
          const pollTransactionStatus = async (transactionId: string, maxAttempts = 6) => {
            // Checking energy purchase transaction status with progressive backoff

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
                  // Error checking energy transaction status
                  // Use exponential backoff: 1s, 2s, 4s, 8s, etc.
                  const backoffTime = Math.min(Math.pow(2, attempt) * 1000, 8000); // Cap at 8 seconds
                  await new Promise(resolve => setTimeout(resolve, backoffTime));
                  continue;
                }

                const statusData = await statusResponse.json();
                // Energy transaction status check

                // If transaction is verified, refresh data and exit
                if (statusData.status === 'verified') {
                  // Energy transaction verified, refreshing data

                  // Refresh both championship and energy data
                  await Promise.all([
                    championshipContext.refreshData(),
                    energyContext.refreshEnergy()
                  ]);

                  return true;
                }

                // If transaction failed, stop polling
                if (statusData.status === 'failed') {
                  // Energy transaction failed
                  return false;
                }

                // Transaction is still pending, wait with exponential backoff and try again
                const backoffTime = Math.min(Math.pow(2, attempt) * 1000, 8000); // Cap at 8 seconds
                // Energy transaction still pending, waiting before next check
                await new Promise(resolve => setTimeout(resolve, backoffTime));
              } catch (_error) {
                // Error polling energy transaction status
                // Use exponential backoff on errors too
                const backoffTime = Math.min(Math.pow(2, attempt) * 1000, 8000);
                await new Promise(resolve => setTimeout(resolve, backoffTime));
              }
            }

            // If we reach here, we've exceeded max attempts
            // Max attempts reached for energy transaction, forcing refresh anyway
            await Promise.all([
              championshipContext.refreshData(),
              energyContext.refreshEnergy()
            ]);
            return false;
          };

          // Start polling
          pollTransactionStatus(result.transactionId!).catch(_error => {
            // Error in energy polling process
          });
        }
      } else {
        // Process with essence payment
        success = await onPurchase(packSize);
      }

      // Hide the selection UI after successful purchase
      if (success) {
        setTimeout(() => {
          setSelectedPack(null);
        }, 1000);
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  // Button hover handlers
  const handleButtonHover = (
    type: 'small' | 'medium' | 'large', 
    isHovering: boolean
  ) => {
    setButtonHoverStates(prev => ({
      ...prev,
      [type]: isHovering
    }));
  };
  
  // Render payment button based on state
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const renderPaymentButton = (packSize: 'small' | 'medium' | 'large') => {
    // Determine button style based on pack size
    const getBtnStyle = () => {
      switch (packSize) {
        case 'small':
          return {
            ...styles.purchaseButtonSmall,
            ...(buttonHoverStates.small ? styles.purchaseButtonSmallHover : {})
          };
        case 'medium':
          return {
            ...styles.purchaseButtonMedium,
            ...(buttonHoverStates.medium ? styles.purchaseButtonMediumHover : {})
          };
        case 'large':
          return {
            ...styles.purchaseButtonLarge,
            ...(buttonHoverStates.large ? styles.purchaseButtonLargeHover : {})
          };
      }
    };

    // Regular payment button (overlay will handle feedback now)
    return (
      <button
        onClick={() => handlePurchase(packSize)}
        disabled={!canPurchasePack(packSize) || isPurchasing || (paymentMethod === 'world' && paymentState === 'pending')}
        style={{
          ...styles.purchaseButton,
          ...(canPurchasePack(packSize) && !isPurchasing && !(paymentMethod === 'world' && paymentState === 'pending') ? getBtnStyle() : styles.purchaseButtonDisabled)
        }}
        onMouseEnter={() => handleButtonHover(packSize, true)}
        onMouseLeave={() => handleButtonHover(packSize, false)}
      >
        {isPurchasing && selectedPack === packSize && paymentMethod !== 'world' ? 'Buying...' : 'Purchase'}
      </button>
    );
  };
  
  // Render global payment method UI
  const renderPaymentMethodSelector = () => {
    if (!isWorldAppAvailable) {
      return null; // Only show essence payment if World App is not available
    }

    return (
      <div style={{
        width: '100%',
        padding: '0.25rem',
        backgroundColor: '#f5f7f9',
        borderRadius: '0.375rem',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: '#e5e7eb'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '0.5rem'
        }}>
          <button
            onClick={() => setPaymentMethod('world')}
            style={{
              fontSize: '0.75rem',
              padding: '0.375rem 0.5rem',
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
              boxShadow: paymentMethod === 'world' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
              position: 'relative'
            }}
          >
            <span style={{ fontSize: '0.85rem' }}>🌍</span>
            <span>World Pay</span>
            {paymentMethod === 'world' && (
              <span style={{
                position: 'absolute',
                top: '-6px',
                right: '-6px',
                backgroundColor: '#2563eb',
                color: 'white',
                borderRadius: '50%',
                width: '14px',
                height: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9px',
                fontWeight: 'bold'
              }}>✓</span>
            )}
          </button>
          <button
            onClick={() => setPaymentMethod('essence')}
            style={{
              fontSize: '0.75rem',
              padding: '0.375rem 0.5rem',
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
              boxShadow: paymentMethod === 'essence' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
              position: 'relative'
            }}
          >
            <span style={{ fontSize: '0.85rem' }}>💎</span>
            <span>Essence</span>
            {paymentMethod === 'essence' && (
              <span style={{
                position: 'absolute',
                top: '-6px',
                right: '-6px',
                backgroundColor: '#2563eb',
                color: 'white',
                borderRadius: '50%',
                width: '14px',
                height: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9px',
                fontWeight: 'bold'
              }}>✓</span>
            )}
          </button>
        </div>
      </div>
    );
  };
  
  // Render cost information based on payment method
  const renderCostInfo = (packSize: 'small' | 'medium' | 'large') => {
    if (paymentMethod === 'world' && isWorldAppAvailable) {
      // Show World payment price
      return (
        <div style={styles.worldPrice}>
          <span>🪙</span> {PAYMENT_TIERS.energy[packSize].wldAmount} WLD
        </div>
      );
    } else {
      // Show essence cost
      return (
        <div style={styles.costBadge}>
          <span style={styles.costItem}>✊ {energyPacks[packSize].cost.rock}</span>
          <span style={styles.costItem}>✋ {energyPacks[packSize].cost.paper}</span>
          <span style={styles.costItem}>✌️ {energyPacks[packSize].cost.scissors}</span>
        </div>
      );
    }
  };
  
  // Handle overlay close
  const handleCloseOverlay = () => {
    setShowOverlay(false);
    resetPaymentState();
  };

  return (
    <div style={{ ...styles.container, position: 'relative' as React.CSSProperties['position'] }}>
      {/* Add animation keyframes */}
      <style dangerouslySetInnerHTML={{ __html: keyframes }} />

      {/* Payment notification overlay */}
      <PaymentNotificationOverlay
        state={paymentState}
        visible={showOverlay}
        message={overlayMessage}
        onClose={handleCloseOverlay}
      />
      <div style={styles.header}>
        <h4 style={styles.headerTitle}>Energy Credits Packs</h4>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={styles.headerSubtitle}>
            Get more plays when your regular energy is depleted
          </p>
        </div>
      </div>
      <div style={{ ...styles.content, flexDirection: 'column' as React.CSSProperties['flexDirection'] }}>
        {/* Global payment method selector at the top */}
        {renderPaymentMethodSelector()}

        {/* Global purchase indicator */}
        <div style={{
          fontSize: '0.75rem',
          color: '#4b5563',
          textAlign: 'center',
          padding: '0.25rem',
          backgroundColor: '#f3f4f6',
          borderRadius: '0.375rem',
          marginBottom: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.25rem'
        }}>
          <span>👆</span>
          <span>Tap any pack to purchase</span>
        </div>
        {/* Small Pack */}
        <div
          onClick={() => canPurchasePack('small') && handlePurchase('small')}
          style={{
            ...styles.packContainer,
            position: 'relative' as React.CSSProperties['position'],
            animation: 'fadeIn 0.3s ease-out forwards',
            animationDelay: '0s',
            cursor: canPurchasePack('small') ? 'pointer' : 'not-allowed',
            opacity: 1, // Always full opacity
            transition: 'all 0.2s ease',
            ...(canPurchasePack('small') ? {
              ':hover': {
                borderColor: '#93c5fd',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }
            } : {})
          }}
          onMouseEnter={(e) => {
            if (canPurchasePack('small')) {
              e.currentTarget.style.borderColor = '#3b82f6';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.2)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }
          }}
          onMouseLeave={(e) => {
            if (canPurchasePack('small')) {
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }
          }}
        >
          {/* Disabled overlay */}
          {!canPurchasePack('small') && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(243, 244, 246, 0.85)',
              backdropFilter: 'blur(1px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              borderRadius: '0.5rem',
              padding: '0.5rem',
              textAlign: 'center'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8rem',
                color: '#ef4444'
              }}>
                <span style={{ fontSize: '1rem' }}>🙅‍♂️</span>
                {paymentMethod === 'essence' ? (
                  <span>
                    Need: <span style={{ fontWeight: 600 }}>{energyPacks.small.cost.rock}✊ {energyPacks.small.cost.paper}✋ {energyPacks.small.cost.scissors}✌️</span>
                  </span>
                ) : (
                  <span>World Pay unavailable</span>
                )}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' as React.CSSProperties['flexDirection'], gap: '0.25rem' }}>
            {/* Header with name, energy amount, and cost in one row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={styles.packName}>{energyPacks.small.name}</div>
                <div style={{ ...styles.energyAmount, ...styles.energyAmountSmall, margin: 0 }}>
                  <span>⚡</span> {energyPacks.small.amount} <span style={{ fontSize: '0.75rem' }}>credits</span>
                </div>
              </div>
              {renderCostInfo('small')}
            </div>

            {/* Buy indicator removed */}

          </div>
        </div>
        {/* Medium Pack */}
        <div
          onClick={() => canPurchasePack('medium') && handlePurchase('medium')}
          style={{
            ...styles.packContainer,
            position: 'relative' as React.CSSProperties['position'],
            animation: 'fadeIn 0.3s ease-out forwards',
            animationDelay: '0.1s',
            cursor: canPurchasePack('medium') ? 'pointer' : 'not-allowed',
            opacity: 1, // Always full opacity
            transition: 'all 0.2s ease',
            ...(canPurchasePack('medium') ? {
              ':hover': {
                borderColor: '#93c5fd',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }
            } : {})
          }}
          onMouseEnter={(e) => {
            if (canPurchasePack('medium')) {
              e.currentTarget.style.borderColor = '#3b82f6';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.2)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }
          }}
          onMouseLeave={(e) => {
            if (canPurchasePack('medium')) {
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }
          }}
        >
          {/* Disabled overlay */}
          {!canPurchasePack('medium') && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(243, 244, 246, 0.85)',
              backdropFilter: 'blur(1px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              borderRadius: '0.5rem',
              padding: '0.5rem',
              textAlign: 'center'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8rem',
                color: '#ef4444'
              }}>
                <span style={{ fontSize: '1rem' }}>🙅‍♂️</span>
                {paymentMethod === 'essence' ? (
                  <span>
                    Need: <span style={{ fontWeight: 600 }}>{energyPacks.medium.cost.rock}✊ {energyPacks.medium.cost.paper}✋ {energyPacks.medium.cost.scissors}✌️</span>
                  </span>
                ) : (
                  <span>World Pay unavailable</span>
                )}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' as React.CSSProperties['flexDirection'], gap: '0.25rem' }}>
            {/* Header with name, energy amount, cost, and discount in compact arrangement */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div>
                  <div style={styles.packName}>{energyPacks.medium.name}</div>
                  {energyPacks.medium.discount && (
                    <div style={{ ...styles.discountText, ...styles.discountTextMedium, marginTop: '0' }}>
                      {energyPacks.medium.discount}
                    </div>
                  )}
                </div>
                <div style={{ ...styles.energyAmount, ...styles.energyAmountMedium, margin: 0 }}>
                  <span>⚡</span> {energyPacks.medium.amount} <span style={{ fontSize: '0.75rem' }}>credits</span>
                </div>
              </div>
              {renderCostInfo('medium')}
            </div>

            {/* Buy indicator removed */}

          </div>
        </div>
        {/* Large Pack */}
        <div
          onClick={() => canPurchasePack('large') && handlePurchase('large')}
          style={{
            ...styles.packContainer,
            position: 'relative' as React.CSSProperties['position'],
            animation: 'fadeIn 0.3s ease-out forwards',
            animationDelay: '0.2s',
            cursor: canPurchasePack('large') ? 'pointer' : 'not-allowed',
            opacity: 1, // Always full opacity
            transition: 'all 0.2s ease',
            ...(canPurchasePack('large') ? {
              ':hover': {
                borderColor: '#93c5fd',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }
            } : {})
          }}
          onMouseEnter={(e) => {
            if (canPurchasePack('large')) {
              e.currentTarget.style.borderColor = '#3b82f6';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.2)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }
          }}
          onMouseLeave={(e) => {
            if (canPurchasePack('large')) {
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }
          }}
        >
          {/* Disabled overlay */}
          {!canPurchasePack('large') && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(243, 244, 246, 0.85)',
              backdropFilter: 'blur(1px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              borderRadius: '0.5rem',
              padding: '0.5rem',
              textAlign: 'center'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8rem',
                color: '#ef4444'
              }}>
                <span style={{ fontSize: '1rem' }}>🙅‍♂️</span>
                {paymentMethod === 'essence' ? (
                  <span>
                    Need: <span style={{ fontWeight: 600 }}>{energyPacks.large.cost.rock}✊ {energyPacks.large.cost.paper}✋ {energyPacks.large.cost.scissors}✌️</span>
                  </span>
                ) : (
                  <span>World Pay unavailable</span>
                )}
              </div>
            </div>
          )}
          <div style={{ ...styles.bestValueBadge, position: 'absolute' as React.CSSProperties['position'] }}>BEST VALUE</div>
          <div style={{ display: 'flex', flexDirection: 'column' as React.CSSProperties['flexDirection'], gap: '0.25rem' }}>
            {/* Header with name, energy amount, cost, and discount in compact arrangement */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div>
                  <div style={styles.packName}>{energyPacks.large.name}</div>
                  {energyPacks.large.discount && (
                    <div style={{ ...styles.discountText, ...styles.discountTextLarge, marginTop: '0' }}>
                      {energyPacks.large.discount.replace('BEST VALUE • ', '')}
                    </div>
                  )}
                </div>
                <div style={{ ...styles.energyAmount, ...styles.energyAmountLarge, margin: 0 }}>
                  <span>⚡</span> {energyPacks.large.amount} <span style={{ fontSize: '0.75rem' }}>credits</span>
                </div>
              </div>
              {renderCostInfo('large')}
            </div>

            {/* Buy indicator removed */}

          </div>
        </div>
      </div>
      {/* Footer removed */}
    </div>
  );
};

export default EnergyPurchase;