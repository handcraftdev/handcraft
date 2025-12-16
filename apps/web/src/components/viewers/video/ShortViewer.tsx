"use client";

import { useRef } from "react";
import { ViewerProps } from "../types";
import { useMediaPlayback } from "../hooks/useMediaPlayback";

export default function ShortViewer({
  contentUrl,
  title,
  metadata,
  isActive,
  isBlurred = false,
  className = "",
}: ViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { state, controls } = useMediaPlayback(videoRef, isActive);

  const blurClass = isBlurred ? "blur-xl scale-105" : "";

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Vertical video optimized for mobile/portrait */}
      <video
        ref={videoRef}
        src={contentUrl}
        className={`w-full h-full object-cover ${blurClass} transition-all duration-500`}
        preload="metadata"
        loop
        muted={state.isMuted}
        playsInline
        onClick={controls.togglePlay}
      />

      {/* Quick action buttons overlay */}
      {!isBlurred && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="pointer-events-auto cursor-pointer"
            onClick={controls.togglePlay}
          >
            {!state.isPlaying && (
              <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Simple info overlay */}
      {metadata?.name && (
        <div className="absolute bottom-20 left-4 right-4">
          <h3 className="text-white text-lg font-semibold drop-shadow-lg">
            {metadata.name}
          </h3>
          {metadata.description && (
            <p className="text-white/80 text-sm mt-1 line-clamp-2 drop-shadow-lg">
              {metadata.description}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
