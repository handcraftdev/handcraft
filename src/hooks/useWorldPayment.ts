'use client';

import { useState } from 'react';
import { MiniKit, Tokens, tokenToDecimals } from '@worldcoin/minikit-js';

// Define price tiers
export const PAYMENT_TIERS = {
  // Energy credits payment tiers
  energy: {
    small: {
      amount: 50, // 50 energy credits
      price: 0.99, // 0.05 WLD
      wldAmount: 0.99 // 0.05 WLD
    },
    medium: {
      amount: 150, // 150 energy credits
      price: 1.99, // 0.1 WLD
      wldAmount: 1.99 // 0.1 WLD
    },
    large: {
      amount: 300, // 300 energy credits
      price: 2.99, // 0.15 WLD
      wldAmount: 2.99 // 0.15 WLD
    }
  },
  // League entry fee
  leagueEntry: {
    price: 0.99, // 0.075 WLD
    wldAmount: 0.99 // 0.075 WLD
  }
};

interface PaymentResult {
  success: boolean;
  message: string;
  transactionId?: string;
  error?: any;
}

/**
 * Custom hook for handling World App payment integration
 */
export const useWorldPayment = () => {
  const [paymentState, setPaymentState] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');
  const [transactionId, setTransactionId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_isVerified, _setIsVerified] = useState<boolean>(false);

  /**
   * Process a payment using World App's payment system
   * 
   * @param {string} paymentType - Type of payment ('energy' or 'leagueEntry')
   * @param {string} tier - Size/tier of payment (for energy: 'small', 'medium', 'large')
   * @param {string} description - Description of the payment for the user
   * @returns {Promise<PaymentResult>} - Result of the payment attempt
   */
  const processPayment = async (
    paymentType: 'energy' | 'leagueEntry',
    tier: string = '', // Only needed for energy credits
    description: string
  ): Promise<PaymentResult> => {
    try {
      setPaymentState('pending');

      // Determine payment amount based on type and tier
      let wldAmount: number;

      if (paymentType === 'energy') {
        if (!tier || !['small', 'medium', 'large'].includes(tier)) {
          throw new Error('Invalid energy credit tier');
        }

        wldAmount = PAYMENT_TIERS.energy[tier as 'small' | 'medium' | 'large'].wldAmount;
      } else {
        // League entry fee
        wldAmount = PAYMENT_TIERS.leagueEntry.wldAmount;
      }

      // Check if MiniKit is available
      if (!MiniKit) {
        throw new Error('World App is not available. Please ensure you are using the World App.');
      }

      // Fetch app address (this would be your app's wallet address)
      // In production, you should use the actual recipient address configured in your backend
      // For demonstration, we're using a placeholder
      const appAddress = '0x763d93625bb8271818a17d3113f8c127ffa726a1'; // Replace with your actual app address

      // Get a unique reference ID from the backend
      const response = await fetch('/api/initiate-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentType,
          tier,
          description
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate payment reference');
      }

      const { id } = await response.json();
      setTransactionId(id);

      // Prepare payment command - only accepting WLD
      const result = await MiniKit.commandsAsync.pay({
        reference: id,
        to: appAddress,
        tokens: [
          {
            symbol: Tokens.WLD,
            token_amount: tokenToDecimals(wldAmount, Tokens.WLD).toString(),
          }
        ],
        description: description,
      });

      // Check payment result
      if (result.finalPayload.status === 'success') {
        setPaymentState('success');

        // Verify the payment on the backend
        const verificationResponse = await fetch('/api/verify-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            transactionId: id,
            paymentType,
            tier
          })
        });

        if (!verificationResponse.ok) {
          throw new Error('Payment verification failed');
        }

        const verificationResult = await verificationResponse.json();

        if (verificationResult.verified) {
          // We'll let the component handle refresh, similar to essence payment flow
          // This enables the same behavior between both payment methods

          return {
            success: true,
            message: 'Payment successful!',
            transactionId: id
          };
        } else {
          throw new Error('Payment verification failed');
        }
      } else {
        throw new Error(typeof result.finalPayload === 'object' ? 'Payment failed' : String(result.finalPayload));
      }
    } catch (error: any) {
      setPaymentState('failed');

      // Reset payment state after delay on failure to allow retry
      setTimeout(() => {
        setPaymentState('idle');
      }, 3000);

      return {
        success: false,
        message: error.message || 'An error occurred during payment',
        error
      };
    }
  };

  return {
    paymentState,
    transactionId,
    processPayment,
    // Reset function for external use
    resetPaymentState: () => {
      setPaymentState('idle');
      setTransactionId(null);
    }
  };
};