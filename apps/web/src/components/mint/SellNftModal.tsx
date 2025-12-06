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
      <div className="relative bg-gray-900 rounded-xl border border-gray-800 p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Sell NFT</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Info */}
        <div className="mb-6">
          <p className="text-gray-400 text-sm mb-2">
            Selling NFT for: <span className="text-white">{contentTitle || "Untitled"}</span>
          </p>
          <p className="text-gray-400 text-sm">
            You own: <span className="text-green-400 font-medium">{ownedCount} NFT{ownedCount !== 1 ? "s" : ""}</span>
          </p>
        </div>

        {/* Your NFTs */}
        {contentNfts.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Your NFTs</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {contentNfts.map((nft, i) => (
                <div
                  key={nft.nftAsset.toBase58()}
                  className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary-500/20 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-primary-400">#{i + 1}</span>
                    </div>
                    <span className="text-sm text-gray-300 font-mono">
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
          <h3 className="text-sm font-medium text-gray-300">List on Marketplace</h3>
          <p className="text-xs text-gray-500 mb-3">
            To sell your NFT, list it on a Solana NFT marketplace.
          </p>

          <a
            href={tensorCollectionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="font-medium">Tensor</p>
                <p className="text-xs text-gray-500">Popular Solana NFT marketplace</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>

          <a
            href={magicEdenCollectionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-500 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <div>
                <p className="font-medium">Magic Eden</p>
                <p className="text-xs text-gray-500">Leading NFT marketplace</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>

        {/* Warning */}
        <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-4 text-sm mb-6">
          <p className="text-amber-400 font-medium mb-2">Before Selling</p>
          <ul className="text-amber-200/80 space-y-1">
            <li>Claim any pending rewards before selling</li>
            <li>Unclaimed rewards transfer to the new owner</li>
            <li>The new owner will have access to the content</li>
          </ul>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
