"use client";

import { ContentDraft } from '@/lib/supabase';

interface MonetizationStepProps {
  draft: ContentDraft | null;
  onUpdate: (updates: Partial<ContentDraft>) => void;
  onNext: () => void;
  isEditMode?: boolean;
}

const MIN_PRICE_SOL = 0.001;
const LAMPORTS_PER_SOL = 1_000_000_000;

export function MonetizationStep({ draft, onUpdate, onNext, isEditMode = false }: MonetizationStepProps) {
  const mintPrice = draft?.mint_price != null ? draft.mint_price / LAMPORTS_PER_SOL : '';
  const supplyLimit = draft?.supply_limit ?? 999999;
  const visibilityLevel = draft?.visibility_level ?? 0;

  const rentalConfig = draft?.rental_config || {};
  const rentFee6h = rentalConfig.rentFee6h != null ? rentalConfig.rentFee6h / LAMPORTS_PER_SOL : '';
  const rentFee1d = rentalConfig.rentFee1d != null ? rentalConfig.rentFee1d / LAMPORTS_PER_SOL : '';
  const rentFee7d = rentalConfig.rentFee7d != null ? rentalConfig.rentFee7d / LAMPORTS_PER_SOL : '';

  const handlePriceChange = (value: string) => {
    const price = parseFloat(value);
    onUpdate({
      mint_price: isNaN(price) ? null : Math.floor(price * LAMPORTS_PER_SOL)
    });
  };

  const handleRentalChange = (duration: string, value: string) => {
    const price = parseFloat(value);
    const priceInLamports = isNaN(price) ? undefined : Math.floor(price * LAMPORTS_PER_SOL);

    onUpdate({
      rental_config: {
        ...rentalConfig,
        [`rentFee${duration}`]: priceInLamports,
      }
    });
  };

  // Must have buy price AND all three rental prices
  const hasBuyPrice = draft?.mint_price != null && draft.mint_price >= MIN_PRICE_SOL * LAMPORTS_PER_SOL;
  const hasRent6h = rentalConfig.rentFee6h != null && rentalConfig.rentFee6h > 0;
  const hasRent1d = rentalConfig.rentFee1d != null && rentalConfig.rentFee1d > 0;
  const hasRent7d = rentalConfig.rentFee7d != null && rentalConfig.rentFee7d > 0;
  const hasAllRentals = hasRent6h && hasRent1d && hasRent7d;
  const canProceed = hasBuyPrice && hasAllRentals;

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-lg font-medium text-white/90 mb-1">Monetization</h2>
      <p className="text-sm text-white/40 mb-6">Set pricing for buying and renting your content</p>

      {/* Buy Price Section */}
      <div className="p-4 rounded-lg border border-purple-500/20 bg-purple-500/5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-md bg-purple-500/20 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-base font-medium text-white/90">Buy Price *</h3>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm text-white/50 mb-1.5">Price in SOL (min 0.001)</label>
            <input
              type="number"
              step="0.001"
              min="0.001"
              value={mintPrice}
              onChange={(e) => handlePriceChange(e.target.value)}
              placeholder="0.001"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-purple-500/50 text-white/90"
            />
          </div>

          <div>
            <label className="block text-sm text-white/50 mb-1.5">Supply Limit (max 999,999)</label>
            <input
              type="number"
              min="1"
              max="999999"
              value={supplyLimit || ''}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                onUpdate({ supply_limit: isNaN(val) ? null : Math.min(val, 999999) });
              }}
              placeholder="Enter supply limit"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-purple-500/50 text-white/90"
            />
          </div>

          </div>
      </div>

      {/* Rental Prices Section */}
      <div className="p-4 rounded-lg border border-amber-500/20 bg-amber-500/5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-md bg-amber-500/20 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-base font-medium text-white/90">Rental Prices *</h3>
          <span className="text-xs text-white/40">(all required)</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs text-white/40 mb-1.5">6 Hours</label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={rentFee6h}
              onChange={(e) => handleRentalChange('6h', e.target.value)}
              placeholder="0.005"
              className="w-full px-2.5 py-2 bg-white/5 border border-white/10 rounded-lg text-white/90 text-sm focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1.5">1 Day</label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={rentFee1d}
              onChange={(e) => handleRentalChange('1d', e.target.value)}
              placeholder="0.01"
              className="w-full px-2.5 py-2 bg-white/5 border border-white/10 rounded-lg text-white/90 text-sm focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1.5">7 Days</label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={rentFee7d}
              onChange={(e) => handleRentalChange('7d', e.target.value)}
              placeholder="0.05"
              className="w-full px-2.5 py-2 bg-white/5 border border-white/10 rounded-lg text-white/90 text-sm focus:outline-none focus:border-amber-500/50"
            />
          </div>
        </div>
      </div>

      {/* Visibility Section */}
      <div className={`p-4 rounded-lg border mb-4 ${isEditMode ? 'border-white/5 bg-white/[0.01]' : 'border-white/10 bg-white/[0.02]'}`}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-md bg-white/10 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <h3 className="text-base font-medium text-white/90">Visibility</h3>
          {isEditMode && <span className="text-xs text-amber-400/70 ml-auto">(Cannot be changed)</span>}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { level: 0, label: 'Public', desc: 'Anyone can preview' },
            { level: 1, label: 'Subscribers', desc: 'Platform subscribers' },
            { level: 2, label: 'Members', desc: 'Your members only' },
            { level: 3, label: 'Buyers Only', desc: 'Must buy or rent' },
          ].map((opt) => (
            <button
              key={opt.level}
              onClick={() => !isEditMode && onUpdate({ visibility_level: opt.level })}
              disabled={isEditMode}
              className={`p-2.5 rounded-lg border text-left transition-all ${
                visibilityLevel === opt.level
                  ? 'border-purple-500/50 bg-purple-500/10'
                  : 'border-white/10 bg-white/[0.02]'
              } ${isEditMode ? 'opacity-50 cursor-not-allowed' : 'hover:border-white/20'}`}
            >
              <div className="font-medium text-sm text-white/80 mb-0.5">{opt.label}</div>
              <div className="text-xs text-white/30">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={!canProceed}
        className="w-full py-2 bg-purple-500/20 hover:bg-purple-500/30 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-all duration-200 border border-purple-500/30 text-white/90"
      >
        Continue to Review
      </button>
    </div>
  );
}
