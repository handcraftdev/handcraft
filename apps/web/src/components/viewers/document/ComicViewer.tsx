"use client";

import { useState } from "react";
import { ViewerProps } from "../types";

export default function ComicViewer({
  contentUrl,
  title,
  metadata,
  isBlurred = false,
  className = "",
}: ViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);

  const blurClass = isBlurred ? "blur-xl scale-105" : "";

  // Check if it's a PDF
  const isPdf = contentUrl.toLowerCase().endsWith('.pdf');

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => prev + 1);
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(3, prev + 0.25));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(0.5, prev - 0.25));
  };

  return (
    <div className={`relative w-full h-full ${className}`}>
      {isPdf ? (
        <div className={`w-full h-full ${blurClass} transition-all duration-500`}>
          <iframe
            src={`${contentUrl}#page=${currentPage}`}
            className="w-full h-full"
            title={title || "Comic"}
          />
        </div>
      ) : (
        <div className={`w-full h-full flex items-center justify-center overflow-auto ${blurClass} transition-all duration-500`}>
          <div
            className="max-w-full max-h-full"
            style={{ transform: `scale(${zoom})` }}
          >
            <img
              src={contentUrl}
              alt={title || "Comic"}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        </div>
      )}

      {/* Comic controls */}
      {!isBlurred && (
        <>
          {/* Navigation controls */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/80 backdrop-blur-sm rounded-lg px-4 py-2">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="p-2 text-white hover:bg-white/10 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
              </svg>
            </button>

            <span className="text-white text-sm px-3">
              Page {currentPage}
            </span>

            <button
              onClick={handleNextPage}
              className="p-2 text-white hover:bg-white/10 rounded transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
              </svg>
            </button>
          </div>

          {/* Zoom controls */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-2 bg-black/80 backdrop-blur-sm rounded-lg p-2">
            <button
              onClick={handleZoomIn}
              className="p-2 text-white hover:bg-white/10 rounded transition-colors"
              title="Zoom in"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
            </button>
            <div className="text-white text-xs text-center px-1">
              {Math.round(zoom * 100)}%
            </div>
            <button
              onClick={handleZoomOut}
              className="p-2 text-white hover:bg-white/10 rounded transition-colors"
              title="Zoom out"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
              </svg>
            </button>
          </div>

          {/* Comic info */}
          {metadata && (
            <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-sm rounded-lg px-4 py-3 max-w-sm">
              <h3 className="text-white font-bold">
                {metadata.name || title}
              </h3>
              {metadata.series && (
                <p className="text-white/80 text-sm">{metadata.series}</p>
              )}
              {metadata.issue && (
                <p className="text-white/60 text-xs">Issue #{metadata.issue}</p>
              )}
              {metadata.author && (
                <p className="text-white/70 text-xs mt-1">Writer: {metadata.author}</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
