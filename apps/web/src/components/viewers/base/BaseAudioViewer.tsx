"use client";

import { useRef } from "react";
import { ViewerProps } from "../types";
import { useMediaPlayback } from "../hooks/useMediaPlayback";

export interface BaseAudioViewerProps extends ViewerProps {
  children?: (props: {
    audioRef: React.RefObject<HTMLAudioElement | null>;
    state: ReturnType<typeof useMediaPlayback>["state"];
    controls: ReturnType<typeof useMediaPlayback>["controls"];
  }) => React.ReactNode;
}

export function BaseAudioViewer({
  contentUrl,
  title,
  metadata,
  isActive,
  showControls = true,
  isBlurred = false,
  className = "",
  children,
}: BaseAudioViewerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { state, controls } = useMediaPlayback(audioRef, isActive);

  const blurClass = isBlurred ? "blur-xl scale-105" : "";
  const albumArt = metadata?.image;

  return (
    <div className={`relative w-full h-full flex items-center justify-center bg-gradient-to-br from-white/5 to-transparent ${className}`}>
      {/* Audio element always in DOM for continuous playback */}
      <audio ref={audioRef} src={contentUrl} className="hidden" />

      <div className={`text-center ${blurClass} transition-all duration-500`}>
        {albumArt ? (
          <div className="w-64 h-64 mx-auto mb-8 rounded-lg overflow-hidden shadow-2xl">
            <img src={albumArt} alt={title} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-32 h-32 mx-auto mb-8 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm">
            <svg className="w-16 h-16 text-white/60" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
        )}

        {children && children({ audioRef, state, controls })}
      </div>
    </div>
  );
}
