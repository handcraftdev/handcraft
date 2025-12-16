"use client";

import { useState, useRef, useEffect } from "react";
import { ViewerProps } from "../types";

export interface BaseImageViewerProps extends ViewerProps {
  enableZoom?: boolean;
  children?: React.ReactNode;
}

export function BaseImageViewer({
  contentUrl,
  contentCid,
  contentType,
  metadata,
  title,
  isBlurred = false,
  className = "",
  enableZoom = true,
  children,
}: BaseImageViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);

  // Keep ref in sync with state for use in event listener
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const blurClass = isBlurred ? "blur-xl scale-105" : "";

  // Use native event listener with { passive: false } to allow preventDefault
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enableZoom) return;

    const handleWheel = (e: WheelEvent) => {
      // Only capture wheel when already zoomed in or holding Ctrl/Cmd (intentional zoom)
      // This allows normal feed scrolling when image is at default zoom
      const isIntentionalZoom = e.ctrlKey || e.metaKey;
      const isZoomedIn = zoomRef.current > 1;

      if (!isIntentionalZoom && !isZoomedIn) return;

      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(prev => Math.max(1, Math.min(5, prev * delta)));
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [enableZoom]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1 || !enableZoom) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDoubleClick = () => {
    if (!enableZoom) return;
    if (zoom > 1) {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
    } else {
      setZoom(2);
    }
  };

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      <div
        ref={containerRef}
        className={`w-full h-full flex items-center justify-center ${isDragging ? 'cursor-grabbing' : zoom > 1 ? 'cursor-grab' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      >
        <img
          src={contentUrl}
          alt={title || "Content"}
          className={`max-w-full max-h-full object-contain ${blurClass} transition-all duration-500 select-none`}
          style={{
            transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
            cursor: isDragging ? 'grabbing' : zoom > 1 ? 'grab' : 'default',
          }}
          draggable={false}
        />
      </div>
      {children}
      {enableZoom && zoom > 1 && (
        <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm px-3 py-2 rounded-lg text-white text-sm">
          {Math.round(zoom * 100)}%
        </div>
      )}
    </div>
  );
}
