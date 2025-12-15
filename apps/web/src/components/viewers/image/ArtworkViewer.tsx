"use client";

import { useState } from "react";
import { ViewerProps } from "../types";
import { BaseImageViewer } from "../base/BaseImageViewer";

export default function ArtworkViewer({
  contentUrl,
  contentCid,
  contentType,
  title,
  metadata,
  isBlurred = false,
  className = "",
}: ViewerProps) {
  const [showStatement, setShowStatement] = useState(false);

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
      {/* Artwork info overlay */}
      {metadata && !isBlurred && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6">
          <div className="max-w-3xl">
            <h2 className="text-white text-2xl font-bold mb-2">
              {metadata.name || title}
            </h2>
            {metadata.artist && (
              <p className="text-white/90 text-lg mb-2">by {metadata.artist}</p>
            )}
            <div className="flex gap-4 text-white/70 text-sm mb-3">
              {metadata.year && <span>{metadata.year}</span>}
              {metadata.medium && <span>{metadata.medium}</span>}
              {metadata.dimensions && <span>{metadata.dimensions}</span>}
            </div>
            {metadata.description && (
              <p className="text-white/80 text-sm mb-3 line-clamp-2">
                {metadata.description}
              </p>
            )}

            {/* Artist statement button */}
            <button
              onClick={() => setShowStatement(!showStatement)}
              className="bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 rounded-lg backdrop-blur-sm transition-colors"
            >
              {showStatement ? "Hide" : "Show"} Artist Statement
            </button>

            {/* Artist statement expanded */}
            {showStatement && (
              <div className="mt-4 bg-black/60 backdrop-blur-sm rounded-lg p-4">
                <p className="text-white/90 text-sm leading-relaxed">
                  {metadata.description || "No artist statement available."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </BaseImageViewer>
  );
}
