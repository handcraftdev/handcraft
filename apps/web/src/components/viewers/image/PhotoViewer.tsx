"use client";

import { useState } from "react";
import { ViewerProps } from "../types";
import { BaseImageViewer } from "../base/BaseImageViewer";

export default function PhotoViewer({
  contentUrl,
  contentCid,
  contentType,
  title,
  metadata,
  isBlurred = false,
  className = "",
}: ViewerProps) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <BaseImageViewer
      contentUrl={contentUrl}
      contentCid={contentCid}
      contentType={contentType}
      metadata={metadata}
      title={title}
      isBlurred={isBlurred}
      className={className}
      enableZoom={true}
    >
      {/* Photo metadata overlay */}
      {metadata && !isBlurred && (
        <>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm p-2 rounded-lg text-white hover:bg-black/80 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {showInfo && (
            <div className="absolute top-16 right-4 bg-black/90 backdrop-blur-sm rounded-lg p-4 max-w-sm">
              <h3 className="text-white font-semibold mb-3">Photo Details</h3>
              <div className="space-y-2 text-sm">
                {metadata.name && (
                  <div>
                    <span className="text-white/60">Title:</span>
                    <span className="text-white ml-2">{metadata.name}</span>
                  </div>
                )}
                {metadata.description && (
                  <div>
                    <span className="text-white/60">Description:</span>
                    <p className="text-white mt-1">{metadata.description}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </BaseImageViewer>
  );
}
