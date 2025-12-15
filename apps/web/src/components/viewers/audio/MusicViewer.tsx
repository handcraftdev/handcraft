"use client";

import { useRef } from "react";
import { ViewerProps } from "../types";
import { useMediaPlayback } from "../hooks/useMediaPlayback";
import { SpeedSelector } from "./SpeedSelector";

export default function MusicViewer({
  contentUrl,
  title,
  metadata,
  isActive,
  showControls = true,
  isBlurred = false,
  className = "",
}: ViewerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { state, controls } = useMediaPlayback(audioRef, isActive);

  const blurClass = isBlurred ? "blur-xl scale-105" : "";
  const albumArt = metadata?.image;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`relative w-full h-full flex items-center justify-center ${className}`}>
      {/* Audio element always in DOM for continuous playback */}
      <audio ref={audioRef} src={contentUrl} className="hidden" />

      <div className={`text-center max-w-2xl ${blurClass} transition-all duration-500`}>
        {/* Album art - clickable to play/pause */}
        <button
          onClick={(e) => { e.stopPropagation(); controls.togglePlay(); }}
          className="w-80 h-80 mx-auto mb-8 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/20 cursor-pointer active:scale-95 transition-transform"
        >
          {albumArt ? (
            <img src={albumArt} alt={title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center backdrop-blur-sm">
              <svg className="w-32 h-32 text-white/40" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
          )}
        </button>

        {/* Track info */}
        <div className="mb-6">
          <h2 className="text-white text-2xl font-bold mb-2">
            {metadata?.name || title}
          </h2>
          {metadata?.artist && (
            <p className="text-white/80 text-lg font-medium mb-1">
              {metadata.artist}
            </p>
          )}
          {metadata?.album && (
            <p className="text-white/60 text-sm">
              {metadata.album}
            </p>
          )}
        </div>

        {/* Custom audio controls */}
        {showControls && !isBlurred && (
          <div className="space-y-4" onClick={(e) => e.stopPropagation()}>

            {/* Progress bar */}
            <div className="w-full px-8">
              <input
                type="range"
                min={0}
                max={state.duration || 100}
                value={state.currentTime}
                onChange={(e) => controls.seek(parseFloat(e.target.value))}
                className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #fff ${(state.currentTime / (state.duration || 1)) * 100}%, rgba(255,255,255,0.2) ${(state.currentTime / (state.duration || 1)) * 100}%)`,
                }}
              />
              <div className="flex justify-between text-white/60 text-xs mt-1">
                <span>{formatTime(state.currentTime)}</span>
                <span>{formatTime(state.duration)}</span>
              </div>
            </div>

            {/* Play controls */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => controls.skipBackward(15)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
                </svg>
              </button>

              <button
                onClick={controls.togglePlay}
                className="w-16 h-16 rounded-full bg-white hover:bg-white/90 flex items-center justify-center transition-all shadow-lg"
              >
                {state.isPlaying ? (
                  <svg className="w-8 h-8 text-black" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8 text-black ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              <button
                onClick={() => controls.skipForward(15)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" />
                </svg>
              </button>
            </div>

            {/* Speed control */}
            <div className="flex items-center justify-center">
              <SpeedSelector
                value={state.playbackRate}
                onChange={controls.setPlaybackRate}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
