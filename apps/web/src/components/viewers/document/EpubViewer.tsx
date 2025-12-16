"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ViewerProps } from "../types";

interface TocItem {
  href: string;
  label: string;
  subitems?: TocItem[];
}

export default function EpubViewer({
  contentUrl,
  title,
  metadata,
  isBlurred = false,
  showControls = true,
  className = "",
}: ViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<any>(null);
  const bookRef = useRef<any>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(100);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [showToc, setShowToc] = useState(false);

  // Initialize the book
  useEffect(() => {
    if (!viewerRef.current || !contentUrl) return;

    let mounted = true;

    const initBook = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Dynamic import epub.js
        const ePub = (await import("epubjs")).default;

        // Clean up previous book
        if (bookRef.current) {
          bookRef.current.destroy();
        }

        // For blob URLs, fetch as ArrayBuffer
        let bookSource: string | ArrayBuffer = contentUrl;
        if (contentUrl.startsWith("blob:")) {
          const response = await fetch(contentUrl);
          bookSource = await response.arrayBuffer();
        }

        if (!mounted) return;

        // Create book
        const book = ePub(bookSource);
        bookRef.current = book;

        await book.ready;

        // Load table of contents
        const navigation = await book.loaded.navigation;
        if (navigation.toc) {
          setToc(navigation.toc as TocItem[]);
        }

        if (!mounted || !viewerRef.current) return;

        // Get container dimensions
        const container = viewerRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight;

        // Render with explicit dimensions
        const rendition = book.renderTo(container, {
          width: width,
          height: height,
          spread: "none",
        });

        renditionRef.current = rendition;

        // Simple dark theme
        rendition.themes.default({
          body: {
            background: "#0a0a0a !important",
            color: "#e5e5e5 !important",
          },
        });

        await rendition.display();

        if (mounted) {
          setIsLoading(false);
        }
      } catch (err) {
        console.error("[EpubViewer] Error:", err);
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load book");
          setIsLoading(false);
        }
      }
    };

    initBook();

    return () => {
      mounted = false;
      if (bookRef.current) {
        bookRef.current.destroy();
        bookRef.current = null;
      }
    };
  }, [contentUrl]);

  // Handle resize
  useEffect(() => {
    if (!renditionRef.current || !viewerRef.current) return;

    const handleResize = () => {
      if (viewerRef.current && renditionRef.current) {
        const width = viewerRef.current.clientWidth;
        const height = viewerRef.current.clientHeight;
        renditionRef.current.resize(width, height);
      }
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(viewerRef.current);

    return () => observer.disconnect();
  }, [isLoading]);

  // Update font size when changed
  useEffect(() => {
    if (renditionRef.current) {
      renditionRef.current.themes.fontSize(`${fontSize}%`);
    }
  }, [fontSize]);

  const nextPage = useCallback(() => {
    renditionRef.current?.next();
  }, []);

  const prevPage = useCallback(() => {
    renditionRef.current?.prev();
  }, []);

  const zoomIn = useCallback(() => {
    setFontSize((prev) => Math.min(prev + 10, 200));
  }, []);

  const zoomOut = useCallback(() => {
    setFontSize((prev) => Math.max(prev - 10, 50));
  }, []);

  const goToChapter = useCallback((href: string) => {
    renditionRef.current?.display(href);
    setShowToc(false);
  }, []);

  const blurClass = isBlurred ? "blur-xl scale-105 pointer-events-none" : "";

  return (
    <div
      ref={containerRef}
      data-viewer="epub"
      className={`absolute inset-0 bg-neutral-950 ${className}`}
    >
      {/* Loading */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-white/20 border-t-white/80 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white/60">Loading book...</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-center max-w-md px-4">
            <p className="text-red-400 mb-4">{error}</p>
            <a
              href={contentUrl}
              download
              className="inline-block bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors text-sm"
            >
              Download Instead
            </a>
          </div>
        </div>
      )}

      {/* Epub container */}
      <div
        ref={viewerRef}
        className={`absolute inset-0 ${blurClass} transition-all duration-500`}
        style={{ opacity: isLoading || error ? 0 : 1 }}
      />

      {/* Click catcher - allows clicks to bubble up to parent for overlay toggle */}
      {/* epub.js uses iframe so clicks don't bubble to React, this layer catches them */}
      {!isLoading && !error && (
        <div className="absolute inset-0 z-[5]" />
      )}

      {/* Controls - synced with overlay visibility */}
      {!isLoading && !error && (
        <>
          {/* Page navigation */}
          <button
            onClick={prevPage}
            className={`absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-all duration-300 z-10 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            aria-label="Previous page"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={nextPage}
            className={`absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-all duration-300 z-10 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            aria-label="Next page"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Top controls - TOC + Zoom */}
          <div className={`absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/70 rounded-full px-3 py-2 z-10 transition-all duration-300 ${showControls ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"}`}>
            {/* TOC button */}
            {toc.length > 0 && (
              <button
                onClick={() => setShowToc(!showToc)}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                aria-label="Table of Contents"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
              </button>
            )}
            {toc.length > 0 && <div className="w-px h-5 bg-white/20" />}
            {/* Zoom controls */}
            <button
              onClick={zoomOut}
              className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
              aria-label="Zoom out"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="text-white/70 text-sm w-12 text-center">{fontSize}%</span>
            <button
              onClick={zoomIn}
              className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
              aria-label="Zoom in"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {/* TOC Sidebar */}
          {showToc && toc.length > 0 && (
            <div className="absolute inset-y-0 left-0 w-72 bg-black/95 border-r border-white/10 z-20 overflow-y-auto">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-medium">Contents</h3>
                  <button
                    onClick={() => setShowToc(false)}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                  >
                    <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <ul className="space-y-1">
                  {toc.map((item, index) => (
                    <li key={index}>
                      <button
                        onClick={() => goToChapter(item.href)}
                        className="w-full text-left px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      >
                        {item.label}
                      </button>
                      {item.subitems && item.subitems.length > 0 && (
                        <ul className="ml-4 mt-1 space-y-1">
                          {item.subitems.map((subitem, subIndex) => (
                            <li key={subIndex}>
                              <button
                                onClick={() => goToChapter(subitem.href)}
                                className="w-full text-left px-3 py-1.5 text-xs text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                              >
                                {subitem.label}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
