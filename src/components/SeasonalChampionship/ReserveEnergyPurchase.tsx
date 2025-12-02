'use client';

import React, { useState } from 'react';
import { Essences } from '@/contexts/ElementalEssencesContext';

interface ReserveEnergyPurchaseProps {
  onPurchase: (size: 'small' | 'medium' | 'large') => Promise<boolean>;
  essences: Essences;
}

// Inline CSS styles to avoid Tailwind dependencies
const styles = {
  container: {
    position: 'relative',
    marginBottom: '1rem',
    zIndex: 5,
    width: '100%'
  },
  button: {
    width: '100%',
    padding: '0.75rem 1rem',
    background: 'linear-gradient(to right, #3b82f6, #8b5cf6)',
    color: 'white',
    borderRadius: '0.5rem',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    cursor: 'pointer',
    border: 'none',
    transition: 'background 0.2s ease'
  },
  buttonHover: {
    background: 'linear-gradient(to right, #2563eb, #7c3aed)',
  },
  dropdownContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '0.5rem',
    backgroundColor: 'white',
    borderRadius: '0.75rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
    zIndex: 1000,
    animation: 'fadeInDropdown 0.2s ease-out forwards'
  },
  header: {
    padding: '1rem',
    borderBottom: '1px solid #e5e7eb',
    background: 'linear-gradient(to right, #eef2ff, #f5f3ff)',
  },
  headerTitle: {
    fontWeight: 600,
    color: '#4338ca',
    marginBottom: '0.25rem'
  },
  headerSubtitle: {
    fontSize: '0.75rem',
    color: '#6366f1'
  },
  content: {
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    backgroundColor: 'white'
  },
  packContainer: {
    padding: '1rem',
    borderRadius: '0.75rem',
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
    marginBottom: '0.5rem',
    position: 'relative'
  },
  packInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  },
  packNameContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  },
  packName: {
    fontWeight: 'bold',
    color: '#1f2937'
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
    fontSize: '1rem',
    fontWeight: 500,
    marginTop: '0.25rem',
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
    backgroundColor: '#f9fafb',
    padding: '0.25rem 0.5rem',
    borderRadius: '0.375rem',
    fontSize: '0.75rem',
    gap: '0.75rem'
  },
  costItem: {
    color: '#374151'
  },
  valueText: {
    fontSize: '0.75rem',
    color: '#6b7280',
    marginTop: '0.5rem'
  },
  discountText: {
    fontSize: '0.75rem',
    fontWeight: 500,
    marginTop: '0.25rem'
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
    padding: '0.25rem 0.5rem',
    borderRadius: '0.25rem',
    fontSize: '0.65rem',
    fontWeight: 'bold',
    transform: 'rotate(10deg)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
    zIndex: 1
  },
  purchaseButton: {
    padding: '0.5rem 1rem',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
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
    padding: '0.75rem 1rem',
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

// Define keyframes for dropdown animation
const keyframes = `
  @keyframes fadeInDropdown {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const ReserveEnergyPurchase: React.FC<ReserveEnergyPurchaseProps> = ({
  onPurchase,
  essences
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [selectedPack, setSelectedPack] = useState<'small' | 'medium' | 'large' | null>(null);
  const [buttonHover, setButtonHover] = useState(false);
  const [buttonHoverStates, setButtonHoverStates] = useState({
    small: false,
    medium: false,
    large: false
  });
  
  // Define energy packs
  const energyPacks = {
    small: {
      name: "Small Pack",
      amount: 50,
      cost: { rock: 15, paper: 15, scissors: 15 }, // 45 essence total = $0.99
      price: "$0.99",
      valueRatio: "50",
      discount: null
    },
    medium: {
      name: "Medium Pack",
      amount: 150,
      cost: { rock: 30, paper: 30, scissors: 30 }, // 90 essence total = $1.99
      price: "$1.99",
      valueRatio: "75",
      discount: "50% more energy"
    },
    large: {
      name: "Large Pack",
      amount: 300,
      cost: { rock: 45, paper: 45, scissors: 45 }, // 135 essence total = $2.99
      price: "$2.99",
      valueRatio: "100",
      discount: "BEST VALUE • 100% more energy"
    }
  };
  
  // Check if player has enough essence for each pack
  const canPurchasePack = (packSize: 'small' | 'medium' | 'large') => {
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
      const success = await onPurchase(packSize);
      if (success) {
        setTimeout(() => {
          setIsOpen(false);
          setSelectedPack(null);
        }, 500);
      }
    } finally {
      setIsPurchasing(false);
    }
  };
  
  // Toggle dropdown
  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    if (isOpen) {
      setSelectedPack(null);
    }
  };

  // Button hover handlers
  const handleButtonHover = (
    type: 'main' | 'small' | 'medium' | 'large', 
    isHovering: boolean
  ) => {
    if (type === 'main') {
      setButtonHover(isHovering);
    } else {
      setButtonHoverStates(prev => ({
        ...prev,
        [type]: isHovering
      }));
    }
  };
  
  return (
    <div style={{ ...styles.container, position: 'relative' as React.CSSProperties['position'] }}>
      {/* Add animation keyframes */}
      <style dangerouslySetInnerHTML={{ __html: keyframes }} />
      <button
        onClick={toggleDropdown}
        style={{
          ...styles.button,
          ...(buttonHover ? styles.buttonHover : {})
        }}
        onMouseEnter={() => handleButtonHover('main', true)}
        onMouseLeave={() => handleButtonHover('main', false)}
      >
        <span style={{ marginRight: '0.5rem' }}>⚡</span>
        Purchase Energy Credits
        <span style={{ marginLeft: '0.5rem' }}>{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <div style={{ ...styles.dropdownContainer, position: 'absolute' as React.CSSProperties['position'], left: 0 as React.CSSProperties['left'], right: 0 as React.CSSProperties['right'] }}>
          <div style={styles.header}>
            <h4 style={styles.headerTitle}>Energy Credits Packs</h4>
            <p style={styles.headerSubtitle}>
              Get more plays when your regular energy is depleted
            </p>
          </div>
          <div style={{ ...styles.content, flexDirection: 'column' as React.CSSProperties['flexDirection'] }}>
            {/* Small Pack */}
            <div
              style={{
                ...styles.packContainer,
                ...(selectedPack === 'small' ? styles.packContainerSelected : {}),
                position: 'relative' as React.CSSProperties['position']
              }}
            >
              <div style={{ ...styles.packHeader, position: 'relative' as React.CSSProperties['position'] }}>
                <div style={{ ...styles.packInfo, flexDirection: 'column' as React.CSSProperties['flexDirection'] }}>
                  <div style={styles.packNameContainer}>
                    <div style={styles.packName}>{energyPacks.small.name}</div>
                    <div style={{ ...styles.priceTag, ...styles.priceTagSmall }}>
                      {energyPacks.small.price}
                    </div>
                  </div>
                  <div style={{ ...styles.energyAmount, ...styles.energyAmountSmall }}>
                    <span>⚡</span> {energyPacks.small.amount} Energy Credits
                  </div>
                  <div style={styles.costBadge}>
                    <span style={styles.costItem}>✊ {energyPacks.small.cost.rock}</span>
                    <span style={styles.costItem}>✋ {energyPacks.small.cost.paper}</span>
                    <span style={styles.costItem}>✌️ {energyPacks.small.cost.scissors}</span>
                  </div>
                  <div style={styles.valueText}>
                    Value: {energyPacks.small.valueRatio} energy per dollar
                  </div>
                </div>
                <button
                  onClick={() => handlePurchase('small')}
                  disabled={!canPurchasePack('small') || isPurchasing}
                  style={{
                    ...styles.purchaseButton,
                    ...(canPurchasePack('small') && !isPurchasing
                      ? {
                          ...styles.purchaseButtonSmall,
                          ...(buttonHoverStates.small ? styles.purchaseButtonSmallHover : {})
                        }
                      : styles.purchaseButtonDisabled)
                  }}
                  onMouseEnter={() => handleButtonHover('small', true)}
                  onMouseLeave={() => handleButtonHover('small', false)}
                >
                  {isPurchasing && selectedPack === 'small' ? 'Buying...' : 'Purchase'}
                </button>
              </div>
            </div>
            {/* Medium Pack */}
            <div
              style={{
                ...styles.packContainer,
                ...(selectedPack === 'medium' ? styles.packContainerSelected : {}),
                position: 'relative' as React.CSSProperties['position']
              }}
            >
              <div style={{ ...styles.packHeader, position: 'relative' as React.CSSProperties['position'] }}>
                <div style={{ ...styles.packInfo, flexDirection: 'column' as React.CSSProperties['flexDirection'] }}>
                  <div style={styles.packNameContainer}>
                    <div style={styles.packName}>{energyPacks.medium.name}</div>
                    <div style={{ ...styles.priceTag, ...styles.priceTagMedium }}>
                      {energyPacks.medium.price}
                    </div>
                  </div>
                  <div style={{ ...styles.energyAmount, ...styles.energyAmountMedium }}>
                    <span>⚡</span> {energyPacks.medium.amount} Energy Credits
                  </div>
                  <div style={styles.costBadge}>
                    <span style={styles.costItem}>✊ {energyPacks.medium.cost.rock}</span>
                    <span style={styles.costItem}>✋ {energyPacks.medium.cost.paper}</span>
                    <span style={styles.costItem}>✌️ {energyPacks.medium.cost.scissors}</span>
                  </div>
                  <div style={styles.valueText}>
                    Value: {energyPacks.medium.valueRatio} energy per dollar
                  </div>
                  {energyPacks.medium.discount && (
                    <div style={{ ...styles.discountText, ...styles.discountTextMedium }}>
                      {energyPacks.medium.discount}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handlePurchase('medium')}
                  disabled={!canPurchasePack('medium') || isPurchasing}
                  style={{
                    ...styles.purchaseButton,
                    ...(canPurchasePack('medium') && !isPurchasing
                      ? {
                          ...styles.purchaseButtonMedium,
                          ...(buttonHoverStates.medium ? styles.purchaseButtonMediumHover : {})
                        }
                      : styles.purchaseButtonDisabled)
                  }}
                  onMouseEnter={() => handleButtonHover('medium', true)}
                  onMouseLeave={() => handleButtonHover('medium', false)}
                >
                  {isPurchasing && selectedPack === 'medium' ? 'Buying...' : 'Purchase'}
                </button>
              </div>
            </div>
            {/* Large Pack */}
            <div
              style={{
                ...styles.packContainer,
                ...(selectedPack === 'large' ? styles.packContainerSelected : {}),
                position: 'relative' as React.CSSProperties['position']
              }}
            >
              <div style={{ ...styles.bestValueBadge, position: 'absolute' as React.CSSProperties['position'] }}>BEST VALUE</div>
              <div style={{ ...styles.packHeader, position: 'relative' as React.CSSProperties['position'] }}>
                <div style={{ ...styles.packInfo, flexDirection: 'column' as React.CSSProperties['flexDirection'] }}>
                  <div style={styles.packNameContainer}>
                    <div style={styles.packName}>{energyPacks.large.name}</div>
                    <div style={{ ...styles.priceTag, ...styles.priceTagLarge }}>
                      {energyPacks.large.price}
                    </div>
                  </div>
                  <div style={{ ...styles.energyAmount, ...styles.energyAmountLarge }}>
                    <span>⚡</span> {energyPacks.large.amount} Energy Credits
                  </div>
                  <div style={styles.costBadge}>
                    <span style={styles.costItem}>✊ {energyPacks.large.cost.rock}</span>
                    <span style={styles.costItem}>✋ {energyPacks.large.cost.paper}</span>
                    <span style={styles.costItem}>✌️ {energyPacks.large.cost.scissors}</span>
                  </div>
                  <div style={styles.valueText}>
                    Value: {energyPacks.large.valueRatio} energy per dollar
                  </div>
                  {energyPacks.large.discount && (
                    <div style={{ ...styles.discountText, ...styles.discountTextLarge }}>
                      {energyPacks.large.discount}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handlePurchase('large')}
                  disabled={!canPurchasePack('large') || isPurchasing}
                  style={{
                    ...styles.purchaseButton,
                    ...(canPurchasePack('large') && !isPurchasing
                      ? {
                          ...styles.purchaseButtonLarge,
                          ...(buttonHoverStates.large ? styles.purchaseButtonLargeHover : {})
                        }
                      : styles.purchaseButtonDisabled)
                  }}
                  onMouseEnter={() => handleButtonHover('large', true)}
                  onMouseLeave={() => handleButtonHover('large', false)}
                >
                  {isPurchasing && selectedPack === 'large' ? 'Buying...' : 'Purchase'}
                </button>
              </div>
            </div>
          </div>
          <div style={styles.footer}>
            <div style={styles.footerContent}>
              <div style={styles.balanceText}>
                Your Balance:
                <span style={styles.balanceNumbers}>
                  {essences.rock} ✊ | {essences.paper} ✋ | {essences.scissors} ✌️
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReserveEnergyPurchase;
