"use client";

import { useRef, useState } from "react";
import { ViewerProps } from "../types";
import { useMediaPlayback } from "../hooks/useMediaPlayback";
import { SpeedSelector } from "./SpeedSelector";

export default function PodcastViewer({
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
  const [showChapters, setShowChapters] = useState(false);

  const blurClass = isBlurred ? "blur-xl scale-105" : "";
  const coverArt = metadata?.image;
  const chapters = metadata?.chapters || [];

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const playbackRates = [0.75, 1, 1.25, 1.5, 1.75, 2];

  return (
    <div className={`relative w-full h-full flex items-center justify-center ${className}`}>
      {/* Audio element always in DOM for continuous playback */}
      <audio ref={audioRef} src={contentUrl} className="hidden" />

      <div className={`text-center max-w-2xl ${blurClass} transition-all duration-500`}>
        {/* Cover art - clickable to play/pause */}
        <button
          onClick={(e) => { e.stopPropagation(); controls.togglePlay(); }}
          className="w-64 h-64 mx-auto mb-8 rounded-xl overflow-hidden shadow-2xl cursor-pointer active:scale-95 transition-transform"
        >
          {coverArt ? (
            <img src={coverArt} alt={title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-white/10 flex items-center justify-center backdrop-blur-sm">
              <svg className="w-24 h-24 text-white/40" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </div>
          )}
        </button>

        {/* Podcast info */}
        <div className="mb-6 px-4">
          <h2 className="text-white text-xl font-bold mb-2">
            {metadata?.name || title}
          </h2>
          {metadata?.description && (
            <p className="text-white/70 text-sm line-clamp-3 mb-2">
              {metadata.description}
            </p>
          )}
        </div>

        {/* Audio controls */}
        {showControls && !isBlurred && (
          <div className="space-y-4 px-8" onClick={(e) => e.stopPropagation()}>

            {/* Progress with timestamps */}
            <div className="w-full">
              <input
                type="range"
                min={0}
                max={state.duration || 100}
                value={state.currentTime}
                onChange={(e) => controls.seek(parseFloat(e.target.value))}
                className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-white/60 text-xs mt-1">
                <span>{formatTime(state.currentTime)}</span>
                <span>{formatTime(state.duration)}</span>
              </div>
            </div>

            {/* Playback controls with skip buttons */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => controls.skipBackward(15)}
                className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex flex-col items-center justify-center transition-colors"
              >
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
                </svg>
                <span className="text-white text-xs">15s</span>
              </button>

              <button
                onClick={controls.togglePlay}
                className="w-14 h-14 rounded-full bg-white hover:bg-white/90 flex items-center justify-center transition-all shadow-lg"
              >
                {state.isPlaying ? (
                  <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-black ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              <button
                onClick={() => controls.skipForward(15)}
                className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex flex-col items-center justify-center transition-colors"
              >
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" />
                </svg>
                <span className="text-white text-xs">15s</span>
              </button>
            </div>

            {/* Speed control and chapters */}
            <div className="flex items-center justify-center gap-4">
              <SpeedSelector
                value={state.playbackRate}
                onChange={controls.setPlaybackRate}
                rates={playbackRates}
              />

              {chapters.length > 0 && (
                <button
                  onClick={() => setShowChapters(!showChapters)}
                  className="bg-white/10 text-white text-sm px-4 py-2 rounded-lg backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-colors"
                >
                  Chapters
                </button>
              )}
            </div>

            {/* Chapters list */}
            {showChapters && chapters.length > 0 && (
              <div className="bg-black/40 backdrop-blur-sm rounded-lg p-3 max-h-48 overflow-y-auto">
                {chapters.map((chapter, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      controls.seek(chapter.startTime);
                      setShowChapters(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-white/10 rounded transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white text-sm">{chapter.title}</span>
                      <span className="text-white/60 text-xs">{formatTime(chapter.startTime)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
