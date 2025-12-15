"use client";

import { ViewerProps } from "../types";

export default function SoftwareViewer({
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
    <div className={`relative w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-900/20 via-blue-900/20 to-indigo-900/20 ${className}`}>
      <div className={`text-center max-w-3xl px-8 ${blurClass} transition-all duration-500`}>
        {/* Software icon */}
        {metadata?.image ? (
          <div className="w-48 h-48 mx-auto mb-8 rounded-2xl overflow-hidden shadow-2xl">
            <img src={metadata.image} alt={title} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-48 h-48 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center backdrop-blur-sm">
            <svg className="w-24 h-24 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
        )}

        {/* Software info */}
        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-6">
          <h2 className="text-white text-3xl font-bold mb-3">
            {metadata?.name || title || "Software"}
          </h2>

          {metadata?.description && (
            <p className="text-white/80 text-base mb-4">
              {metadata.description}
            </p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 text-sm">
            {metadata?.version && (
              <div className="bg-white/5 rounded-lg px-3 py-2">
                <div className="text-white/60 text-xs mb-1">Version</div>
                <div className="text-white font-medium">{metadata.version}</div>
              </div>
            )}
            {metadata?.platform && (
              <div className="bg-white/5 rounded-lg px-3 py-2">
                <div className="text-white/60 text-xs mb-1">Platform</div>
                <div className="text-white font-medium">{metadata.platform}</div>
              </div>
            )}
            {metadata?.license && (
              <div className="bg-white/5 rounded-lg px-3 py-2">
                <div className="text-white/60 text-xs mb-1">License</div>
                <div className="text-white font-medium">{metadata.license}</div>
              </div>
            )}
            {metadata?.fileSize && (
              <div className="bg-white/5 rounded-lg px-3 py-2">
                <div className="text-white/60 text-xs mb-1">Size</div>
                <div className="text-white font-medium">{formatFileSize(metadata.fileSize)}</div>
              </div>
            )}
          </div>

          {metadata?.developer && (
            <div className="text-white/70 text-sm mb-6">
              Developer: {metadata.developer}
            </div>
          )}

          {!isBlurred && (
            <div className="space-y-3">
              <a
                href={contentUrl}
                download
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg transition-colors font-medium text-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Software
              </a>

              {metadata?.license && (
                <p className="text-white/50 text-xs">
                  By downloading, you agree to the {metadata.license} license terms
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
