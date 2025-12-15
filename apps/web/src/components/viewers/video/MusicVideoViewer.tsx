"use client";

import { useRef } from "react";
import { ViewerProps } from "../types";
import { useMediaPlayback } from "../hooks/useMediaPlayback";

export default function MusicVideoViewer({
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

      {/* Artist info overlay */}
      {metadata && (
        <div className="absolute bottom-20 left-4 bg-black/60 backdrop-blur-sm px-4 py-3 rounded-lg max-w-md">
          <h3 className="text-white font-bold text-lg">{metadata.name || title}</h3>
          {metadata.artist && (
            <p className="text-white/90 text-sm font-medium mt-1">{metadata.artist}</p>
          )}
          {metadata.album && (
            <p className="text-white/70 text-xs mt-1">from {metadata.album}</p>
          )}
          {metadata.year && (
            <p className="text-white/60 text-xs">{metadata.year}</p>
          )}
        </div>
      )}
    </div>
  );
}
