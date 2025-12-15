"use client";

import { ViewerProps } from "../types";

export default function AssetViewer({
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
    <div className={`relative w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900/20 to-zinc-900/20 ${className}`}>
      <div className={`text-center max-w-2xl px-8 ${blurClass} transition-all duration-500`}>
        {/* Asset icon */}
        <div className="w-32 h-32 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center backdrop-blur-sm">
          <svg className="w-16 h-16 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>

        {/* Asset info */}
        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-6">
          <h2 className="text-white text-2xl font-bold mb-3">
            {metadata?.name || title || "Digital Asset"}
          </h2>

          {metadata?.description && (
            <p className="text-white/70 text-sm mb-4">
              {metadata.description}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
            {metadata?.format && (
              <div className="bg-white/5 rounded-lg px-3 py-2">
                <div className="text-white/60 text-xs mb-1">Format</div>
                <div className="text-white font-medium">{metadata.format}</div>
              </div>
            )}
            {metadata?.fileSize && (
              <div className="bg-white/5 rounded-lg px-3 py-2">
                <div className="text-white/60 text-xs mb-1">Size</div>
                <div className="text-white font-medium">{formatFileSize(metadata.fileSize)}</div>
              </div>
            )}
            {metadata?.version && (
              <div className="bg-white/5 rounded-lg px-3 py-2">
                <div className="text-white/60 text-xs mb-1">Version</div>
                <div className="text-white font-medium">{metadata.version}</div>
              </div>
            )}
          </div>

          {!isBlurred && (
            <a
              href={contentUrl}
              download
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Asset
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
