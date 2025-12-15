"use client";

import { useRef, forwardRef } from "react";
import { ViewerProps } from "../types";
import { useMediaPlayback } from "../hooks/useMediaPlayback";

export interface BaseVideoViewerProps extends ViewerProps {
  children?: (props: {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    state: ReturnType<typeof useMediaPlayback>["state"];
    controls: ReturnType<typeof useMediaPlayback>["controls"];
  }) => React.ReactNode;
}

export const BaseVideoViewer = forwardRef<HTMLVideoElement, BaseVideoViewerProps>(
  ({ contentUrl, title, isActive, showControls = true, isBlurred = false, className = "", children }, ref) => {
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
        {children && children({ videoRef, state, controls })}
      </div>
    );
  }
);

BaseVideoViewer.displayName = "BaseVideoViewer";
