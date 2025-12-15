"use client";

import { ViewerProps } from "../types";

export default function DatasetViewer({
  contentUrl,
  title,
  metadata,
  isBlurred = false,
  className = "",
}: ViewerProps) {
  const blurClass = isBlurred ? "blur-xl scale-105" : "";

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unknown size";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  };

  const formatRecords = (records?: number) => {
    if (!records) return "Unknown";
    if (records >= 1_000_000) {
      return `${(records / 1_000_000).toFixed(2)}M`;
    }
    if (records >= 1_000) {
      return `${(records / 1_000).toFixed(2)}K`;
    }
    return records.toString();
  };

  return (
    <div className={`relative w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-900/20 via-teal-900/20 to-green-900/20 ${className}`}>
      <div className={`text-center max-w-3xl px-8 ${blurClass} transition-all duration-500`}>
        {/* Dataset icon */}
        <div className="w-48 h-48 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center backdrop-blur-sm">
          <svg className="w-24 h-24 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
        </div>

        {/* Dataset info */}
        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-6">
          <h2 className="text-white text-3xl font-bold mb-3">
            {metadata?.name || title || "Dataset"}
          </h2>

          {metadata?.description && (
            <p className="text-white/80 text-base mb-6">
              {metadata.description}
            </p>
          )}

          {/* Dataset stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {metadata?.records !== undefined && (
              <div className="bg-white/5 rounded-lg px-4 py-3">
                <div className="text-white/60 text-xs mb-1">Records</div>
                <div className="text-white font-bold text-xl">{formatRecords(metadata.records)}</div>
              </div>
            )}
            {metadata?.format && (
              <div className="bg-white/5 rounded-lg px-4 py-3">
                <div className="text-white/60 text-xs mb-1">Format</div>
                <div className="text-white font-medium">{metadata.format}</div>
              </div>
            )}
            {metadata?.fileSize && (
              <div className="bg-white/5 rounded-lg px-4 py-3">
                <div className="text-white/60 text-xs mb-1">Size</div>
                <div className="text-white font-medium">{formatFileSize(metadata.fileSize)}</div>
              </div>
            )}
          </div>

          {/* Schema preview */}
          {metadata?.schema && (
            <div className="mb-6">
              <h3 className="text-white/80 text-sm font-semibold mb-2">Schema</h3>
              <div className="bg-black/40 rounded-lg p-4 text-left">
                <pre className="text-white/70 text-xs overflow-x-auto">
                  {metadata.schema}
                </pre>
              </div>
            </div>
          )}

          {!isBlurred && (
            <a
              href={contentUrl}
              download
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg transition-colors font-medium text-lg"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Dataset
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
