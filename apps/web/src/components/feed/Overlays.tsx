"use client";

export function LockedOverlay({
  hasMintConfig,
  hasRentConfig,
  onBuyClick,
  onRentClick,
}: {
  hasMintConfig: boolean;
  hasRentConfig?: boolean;
  onBuyClick: () => void;
  onRentClick?: () => void;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
      <div className="w-16 h-16 mb-4 rounded-full bg-gray-800/80 flex items-center justify-center">
        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <p className="text-white font-medium mb-2">Premium Content</p>
      <p className="text-gray-400 text-sm mb-4 text-center px-4">
        {hasMintConfig || hasRentConfig
          ? "Purchase or rent to unlock full access"
          : "This content is encrypted"
        }
      </p>
      {(hasMintConfig || hasRentConfig) && (
        <div className="flex flex-col sm:flex-row gap-2">
          {hasMintConfig && (
            <button
              onClick={onBuyClick}
              className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-full font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Buy
            </button>
          )}
          {hasRentConfig && onRentClick && (
            <button
              onClick={onRentClick}
              className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-full font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Rent
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function NeedsSessionOverlay({
  onSignIn,
  isSigningIn,
}: {
  onSignIn: () => void;
  isSigningIn: boolean;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
      <div className="w-16 h-16 mb-4 rounded-full bg-primary-800/80 flex items-center justify-center">
        <svg className="w-8 h-8 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      </div>
      <p className="text-white font-medium mb-2">Sign to View Content</p>
      <p className="text-gray-400 text-sm mb-4 text-center px-4">
        Sign a message to verify ownership and decrypt your content
      </p>
      <button
        onClick={onSignIn}
        disabled={isSigningIn}
        className="px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 disabled:cursor-wait text-white rounded-full font-medium transition-colors flex items-center gap-2"
      >
        {isSigningIn ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Signing...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            Sign In
          </>
        )}
      </button>
    </div>
  );
}

export function EmptyState({
  showExplore = false,
  hasFilter = false,
  onClearFilter,
}: {
  showExplore?: boolean;
  hasFilter?: boolean;
  onClearFilter?: () => void;
}) {
  return (
    <div className="text-center py-12">
      <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
        <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </div>
      <h3 className="text-lg font-medium mb-2">
        {hasFilter ? "No content matches this filter" : "No content yet"}
      </h3>
      <p className="text-gray-500 mb-4">
        {hasFilter && onClearFilter ? (
          <button
            onClick={onClearFilter}
            className="text-primary-400 hover:text-primary-300 underline"
          >
            Clear filter to see all content
          </button>
        ) : showExplore ? (
          "Be the first to upload content to the decentralized feed!"
        ) : (
          "Upload your first content to see it here."
        )}
      </p>
    </div>
  );
}
