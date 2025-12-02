'use client';
import { WorldButton } from '@/components/ui/WorldButton';
import { LiveFeedback } from '@worldcoin/mini-apps-ui-kit-react';
import { MiniKit, Tokens, tokenToDecimals } from '@worldcoin/minikit-js';
import { useState } from 'react';

/**
 * This component is used to pay a user
 * The payment command simply does an ERC20 transfer
 * But, it also includes a reference field that you can search for on-chain
 */
export const Pay = () => {
  const [buttonState, setButtonState] = useState<
    'pending' | 'success' | 'failed' | undefined
  >(undefined);

  const onClickPay = async () => {
    // Lets use Alex's username to pay!
    const address = (await MiniKit.getUserByUsername('alex')).walletAddress;
    setButtonState('pending');

    const res = await fetch('/api/initiate-payment', {
      method: 'POST',
    });
    const { id } = await res.json();

    const result = await MiniKit.commandsAsync.pay({
      reference: id,
      to: address ?? '0x0000000000000000000000000000000000000000',
      tokens: [
        {
          symbol: Tokens.WLD,
          token_amount: tokenToDecimals(0.5, Tokens.WLD).toString(),
        },
        {
          symbol: Tokens.USDCE,
          token_amount: tokenToDecimals(0.1, Tokens.USDCE).toString(),
        },
      ],
      description: 'Test example payment for minikit',
    });

    console.log(result.finalPayload);
    if (result.finalPayload.status === 'success') {
      setButtonState('success');
      // It's important to actually check the transaction result on-chain
      // You should confirm the reference id matches for security
      // Read more here: https://docs.world.org/mini-apps/commands/pay#verifying-the-payment
    } else {
      setButtonState('failed');
      setTimeout(() => {
        setButtonState(undefined);
      }, 3000);
    }
  };

  return (
    <div className="card w-full">
      <div className="card-header bg-secondary-50 dark:bg-secondary-900">
        <h2 className="text-lg font-semibold text-secondary-800 dark:text-secondary-200">
          Payment
        </h2>
      </div>
      
      <div className="card-body">
        <LiveFeedback
          label={{
            failed: 'Payment failed',
            pending: 'Payment processing...',
            success: 'Payment successful',
          }}
          state={buttonState}
          className="w-full"
        >
          <WorldButton
            onClick={onClickPay}
            disabled={buttonState === 'pending'}
            size="lg"
            variant="primary"
            fullWidth
          >
            Send Payment
          </WorldButton>
        </LiveFeedback>
        
        <div className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
          <p>This will send:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>0.5 WLD</li>
            <li>0.1 USDC</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
