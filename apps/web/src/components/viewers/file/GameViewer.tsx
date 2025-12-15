"use client";

import { ViewerProps } from "../types";

export default function GameViewer({
  contentUrl,
  title,
  metadata,
  isBlurred = false,
  className = "",
}: ViewerProps) {
  const blurClass = isBlurred ? "blur-xl scale-105" : "";

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unknown size";
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  };

  return (
    <div className={`relative w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-900/20 via-fuchsia-900/20 to-purple-900/20 ${className}`}>
      <div className={`text-center max-w-3xl px-8 ${blurClass} transition-all duration-500`}>
        {/* Game cover/screenshot */}
        {metadata?.image ? (
          <div className="w-full max-w-2xl mx-auto mb-8 rounded-xl overflow-hidden shadow-2xl">
            <img src={metadata.image} alt={title} className="w-full h-auto object-cover" />
          </div>
        ) : (
          <div className="w-48 h-48 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center backdrop-blur-sm">
            <svg className="w-24 h-24 text-white/60" fill="currentColor" viewBox="0 0 24 24">
              <path d="M21.58,16.09l-1.09-7.66A3.996,3.996,0,0,0,16.53,5H7.47A4,4,0,0,0,3.51,8.43L2.42,16.09A3,3,0,0,0,5.41,19.51L6,19.47V21a1,1,0,0,0,2,0V19.3a1.006,1.006,0,0,0-.78-.97l-.73-.17a1,1,0,0,1-.69-1.23l1.09-7.66A2,2,0,0,1,7.47,7h9.06a2,2,0,0,1,1.98,1.27l1.09,7.66a1,1,0,0,1-.69,1.23l-.73.17A1.006,1.006,0,0,0,17.4,18.3V21a1,1,0,0,0,2,0V19.47l.59.04a3,3,0,0,0,2.99-3.42Z" />
            </svg>
          </div>
        )}

        {/* Game info */}
        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-6">
          <h2 className="text-white text-3xl font-bold mb-3">
            {metadata?.name || title || "Game"}
          </h2>

          {metadata?.description && (
            <p className="text-white/80 text-base mb-4 line-clamp-3">
              {metadata.description}
            </p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 text-sm">
            {metadata?.genre && (
              <div className="bg-white/5 rounded-lg px-3 py-2">
                <div className="text-white/60 text-xs mb-1">Genre</div>
                <div className="text-white font-medium">{metadata.genre}</div>
              </div>
            )}
            {metadata?.platform && (
              <div className="bg-white/5 rounded-lg px-3 py-2">
                <div className="text-white/60 text-xs mb-1">Platform</div>
                <div className="text-white font-medium">{metadata.platform}</div>
              </div>
            )}
            {metadata?.version && (
              <div className="bg-white/5 rounded-lg px-3 py-2">
                <div className="text-white/60 text-xs mb-1">Version</div>
                <div className="text-white font-medium">{metadata.version}</div>
              </div>
            )}
            {metadata?.fileSize && (
              <div className="bg-white/5 rounded-lg px-3 py-2">
                <div className="text-white/60 text-xs mb-1">Size</div>
                <div className="text-white font-medium">{formatFileSize(metadata.fileSize)}</div>
              </div>
            )}
          </div>

          {(metadata?.developer || metadata?.publisher) && (
            <div className="flex flex-wrap gap-4 justify-center text-white/70 text-sm mb-6">
              {metadata.developer && <span>Developer: {metadata.developer}</span>}
              {metadata.publisher && <span>Publisher: {metadata.publisher}</span>}
            </div>
          )}

          {!isBlurred && (
            <a
              href={contentUrl}
              download
              className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg transition-colors font-medium text-lg"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Game
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
