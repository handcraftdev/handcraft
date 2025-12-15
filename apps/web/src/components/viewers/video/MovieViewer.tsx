"use client";

import { useState, useRef } from "react";
import { ViewerProps } from "../types";
import { useMediaPlayback } from "../hooks/useMediaPlayback";

export default function MovieViewer({
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
  const [showChapters, setShowChapters] = useState(false);

  const blurClass = isBlurred ? "blur-xl scale-105" : "";
  const chapters = metadata?.chapters || [];

  const handleChapterClick = (startTime: number) => {
    controls.seek(startTime);
    setShowChapters(false);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

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

      {/* Chapters menu */}
      {chapters.length > 0 && !isBlurred && (
        <>
          <button
            onClick={() => setShowChapters(!showChapters)}
            className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg text-white text-sm hover:bg-black/80 transition-colors"
          >
            Chapters
          </button>

          {showChapters && (
            <div className="absolute top-16 right-4 bg-black/90 backdrop-blur-sm rounded-lg overflow-hidden max-h-96 overflow-y-auto w-80">
              <div className="p-2">
                {chapters.map((chapter, index) => (
                  <button
                    key={index}
                    onClick={() => handleChapterClick(chapter.startTime)}
                    className="w-full text-left px-3 py-2 hover:bg-white/10 rounded transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white text-sm font-medium group-hover:text-blue-400">
                        {chapter.title}
                      </span>
                      <span className="text-white/60 text-xs">
                        {formatTime(chapter.startTime)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Movie info */}
      {metadata && (
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg max-w-md">
          <h3 className="text-white font-semibold">{metadata.name || title}</h3>
          {metadata.genre && (
            <p className="text-white/80 text-sm">{metadata.genre}</p>
          )}
          {metadata.year && (
            <p className="text-white/60 text-xs">{metadata.year}</p>
          )}
        </div>
      )}
    </div>
  );
}
