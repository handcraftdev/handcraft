"use client";

import { useRef } from "react";
import { ViewerProps } from "../types";
import { useMediaPlayback } from "../hooks/useMediaPlayback";

export default function TelevisionViewer({
  contentUrl,
  title,
  metadata,
  isActive,
  showControls = true,
  isBlurred = false,
  className = "",
}: ViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { state, controls } = useMediaPlayback(videoRef, isActive);

  const blurClass = isBlurred ? "blur-xl scale-105" : "";

  return (
    <div className={`relative w-full h-full ${className}`}>
      <video
        ref={videoRef}
        src={contentUrl}
        className={`w-full h-full object-contain ${blurClass} transition-all duration-500`}
        controls={showControls && !isBlurred}
        preload="metadata"
        loop
        muted={state.isMuted}
        playsInline
      />

      {/* Episode info overlay */}
      {metadata && (
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm px-4 py-3 rounded-lg max-w-md">
          {metadata.showName && (
            <h3 className="text-white font-semibold text-lg">{metadata.showName}</h3>
          )}
          <div className="flex items-center gap-2 mt-1">
            {metadata.seasonNumber !== undefined && metadata.episodeNumber !== undefined && (
              <span className="text-white/90 text-sm font-medium">
                S{metadata.seasonNumber} E{metadata.episodeNumber}
              </span>
            )}
            {metadata.name && metadata.name !== metadata.showName && (
              <span className="text-white/80 text-sm">
                - {metadata.name}
              </span>
            )}
          </div>
          {metadata.description && (
            <p className="text-white/70 text-xs mt-2 line-clamp-2">
              {metadata.description}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
