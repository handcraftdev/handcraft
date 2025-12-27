"use client";

import { WalletNftMetadata } from "@handcraft/sdk";

interface SellNftModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentCid: string;
  contentTitle?: string;
  ownedCount: number;
  userNfts: WalletNftMetadata[];
}

export function SellNftModal({
  isOpen,
  onClose,
  contentCid,
  contentTitle,
  ownedCount,
  userNfts,
}: SellNftModalProps) {
  // Get the user's NFTs for this specific content
  const contentNfts = userNfts.filter(nft => nft.contentCid === contentCid);

  if (!isOpen) return null;

  // Get collection address from first NFT if available
  const collectionAddress = contentNfts.length > 0
    ? contentNfts[0].collectionAsset?.toBase58()
    : null;

  // Marketplace URLs
  const tensorCollectionUrl = collectionAddress
    ? `https://www.tensor.trade/trade/${collectionAddress}`
    : "https://www.tensor.trade";

  const magicEdenCollectionUrl = collectionAddress
    ? `https://magiceden.io/marketplace/${collectionAddress}`
    : "https://magiceden.io";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-black border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none rounded-2xl" />

        <div className="relative">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium text-white/90">Sell NFT</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-full transition-all duration-300 text-white/40 hover:text-white/70"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content Info */}
          <div className="mb-6">
            <p className="text-white/40 text-sm mb-2">
              Selling NFT for: <span className="text-white/80">{contentTitle || "Untitled"}</span>
            </p>
            <p className="text-white/40 text-sm">
              You own: <span className="text-emerald-400 font-medium">{ownedCount} NFT{ownedCount !== 1 ? "s" : ""}</span>
            </p>
          </div>

          {/* Your NFTs */}
          {contentNfts.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm uppercase tracking-[0.15em] text-white/30 mb-3">Your NFTs</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {contentNfts.map((nft, i) => (
                  <div
                    key={nft.nftAsset.toBase58()}
                    className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                        <span className="text-xs font-medium text-purple-400">#{i + 1}</span>
                      </div>
                      <span className="text-sm text-white/60 font-mono">
                        {nft.nftAsset.toBase58().slice(0, 4)}...{nft.nftAsset.toBase58().slice(-4)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Marketplace Links */}
          <div className="space-y-3 mb-6">
            <h3 className="text-sm uppercase tracking-[0.15em] text-white/30">List on Marketplace</h3>
            <p className="text-xs text-white/30 mb-3">
              To sell your NFT, list it on a Solana NFT marketplace.
            </p>

            <a
              href={tensorCollectionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full p-4 bg-white/[0.02] hover:bg-white/5 border border-white/10 hover:border-white/20 rounded-xl transition-all duration-300 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-white/80">Tensor</p>
                  <p className="text-xs text-white/30">Popular Solana NFT marketplace</p>
                </div>
              </div>
              <svg className="w-5 h-5 text-white/30 group-hover:text-white/60 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>

            <a
              href={magicEdenCollectionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full p-4 bg-white/[0.02] hover:bg-white/5 border border-white/10 hover:border-white/20 rounded-xl transition-all duration-300 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-500 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-white/80">Magic Eden</p>
                  <p className="text-xs text-white/30">Leading NFT marketplace</p>
                </div>
              </div>
              <svg className="w-5 h-5 text-white/30 group-hover:text-white/60 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>

          {/* Warning */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm mb-6">
            <p className="text-amber-300 font-medium mb-2">Before Selling</p>
            <ul className="text-amber-200/60 space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-amber-400/60 mt-0.5">-</span>
                Claim any pending rewards before selling
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400/60 mt-0.5">-</span>
                Unclaimed rewards transfer to the new owner
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400/60 mt-0.5">-</span>
                The new owner will have access to the content
              </li>
            </ul>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl font-medium transition-all duration-300 text-white/70 border border-white/10 hover:border-white/20"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
