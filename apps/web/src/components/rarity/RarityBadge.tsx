"use client";

import { Rarity, getRarityName } from "@handcraft/sdk";

// Rarity colors for display - used across the app
export const RARITY_STYLES: Record<Rarity, { bg: string; text: string; border: string; glow: string }> = {
  [Rarity.Common]: {
    bg: "bg-gray-500/20",
    text: "text-gray-300",
    border: "border-gray-500",
    glow: ""
  },
  [Rarity.Uncommon]: {
    bg: "bg-green-500/20",
    text: "text-green-400",
    border: "border-green-500",
    glow: "shadow-green-500/20"
  },
  [Rarity.Rare]: {
    bg: "bg-blue-500/20",
    text: "text-blue-400",
    border: "border-blue-500",
    glow: "shadow-blue-500/30"
  },
  [Rarity.Epic]: {
    bg: "bg-purple-500/20",
    text: "text-purple-400",
    border: "border-purple-500",
    glow: "shadow-purple-500/40"
  },
  [Rarity.Legendary]: {
    bg: "bg-yellow-500/20",
    text: "text-yellow-400",
    border: "border-yellow-500",
    glow: "shadow-yellow-500/50"
  },
};

// Get rarity icon
function getRarityIcon(rarity: Rarity): string {
  switch (rarity) {
    case Rarity.Common: return ""; // No icon for common
    case Rarity.Uncommon: return ""; // Leaf
    case Rarity.Rare: return ""; // Diamond
    case Rarity.Epic: return ""; // Lightning
    case Rarity.Legendary: return ""; // Star
    default: return "";
  }
}

interface RarityBadgeProps {
  rarity: Rarity;
  size?: "xs" | "sm" | "md" | "lg";
  showIcon?: boolean;
  showGlow?: boolean;
  className?: string;
}

export function RarityBadge({
  rarity,
  size = "sm",
  showIcon = false,
  showGlow = false,
  className = ""
}: RarityBadgeProps) {
  const styles = RARITY_STYLES[rarity];
  const name = getRarityName(rarity);
  const icon = showIcon ? getRarityIcon(rarity) : null;

  const sizeClasses = {
    xs: "text-[10px] px-1.5 py-0.5",
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full font-medium
        ${styles.bg} ${styles.text}
        ${showGlow ? `shadow-lg ${styles.glow}` : ""}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {icon && <span>{icon}</span>}
      {name}
    </span>
  );
}

interface RarityIndicatorProps {
  rarity: Rarity;
  size?: "sm" | "md" | "lg";
  className?: string;
}

// Small dot indicator for compact spaces
export function RarityIndicator({ rarity, size = "sm", className = "" }: RarityIndicatorProps) {
  const styles = RARITY_STYLES[rarity];

  const sizeClasses = {
    sm: "w-2 h-2",
    md: "w-3 h-3",
    lg: "w-4 h-4",
  };

  return (
    <span
      className={`
        inline-block rounded-full
        ${styles.bg} border ${styles.border}
        ${sizeClasses[size]}
        ${className}
      `}
      title={getRarityName(rarity)}
    />
  );
}

interface RarityRevealProps {
  rarity: Rarity;
  onClose?: () => void;
}

// Full-screen rarity reveal animation
export function RarityReveal({ rarity, onClose }: RarityRevealProps) {
  const styles = RARITY_STYLES[rarity];
  const name = getRarityName(rarity);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <div className={`
        text-center p-8 rounded-2xl border-2 animate-pulse
        ${styles.bg} ${styles.border} ${styles.glow}
        shadow-2xl transform animate-bounce-subtle
      `}>
        <div className="text-6xl mb-4">
          {rarity === Rarity.Legendary && ""}
          {rarity === Rarity.Epic && ""}
          {rarity === Rarity.Rare && ""}
          {rarity === Rarity.Uncommon && ""}
          {rarity === Rarity.Common && ""}
        </div>
        <h2 className={`text-4xl font-bold mb-2 ${styles.text}`}>
          {name}!
        </h2>
        <p className="text-gray-400">
          Your NFT was assigned {name.toLowerCase()} rarity
        </p>
        {rarity >= Rarity.Rare && (
          <p className="text-sm text-gray-500 mt-2">
            Higher rarity = More rewards from the holder pool!
          </p>
        )}
      </div>

      <style jsx>{`
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-10px) scale(1.02); }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

// Probability display for the mint modal
export function RarityProbabilities({ className = "" }: { className?: string }) {
  const probabilities = [
    { rarity: Rarity.Common, prob: "55%" },
    { rarity: Rarity.Uncommon, prob: "27%" },
    { rarity: Rarity.Rare, prob: "13%" },
    { rarity: Rarity.Epic, prob: "4%" },
    { rarity: Rarity.Legendary, prob: "1%" },
  ];

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {probabilities.map(({ rarity, prob }) => (
        <span
          key={rarity}
          className={`
            text-xs px-2 py-0.5 rounded-full
            ${RARITY_STYLES[rarity].bg} ${RARITY_STYLES[rarity].text}
          `}
          title={`${prob} chance`}
        >
          {getRarityName(rarity)}
        </span>
      ))}
    </div>
  );
}
