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
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<any>(null);
  const bookRef = useRef<any>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentChapter, setCurrentChapter] = useState<string>("");
  const [toc, setToc] = useState<TocItem[]>([]);
  const [showToc, setShowToc] = useState(false);
  const [fontSize, setFontSize] = useState(100);
  const [epubLib, setEpubLib] = useState<typeof import("epubjs").default | null>(null);

  // Load epub.js dynamically
  useEffect(() => {
    import("epubjs").then((module) => {
      setEpubLib(() => module.default);
    });
  }, []);

  // Initialize the book
  useEffect(() => {
    if (!epubLib || !viewerRef.current || !contentUrl) return;

    const initBook = async () => {
      setIsLoading(true);
      setError(null);

      console.log("[EpubViewer] Initializing with URL:", contentUrl?.substring(0, 100));

      try {
        // Clean up previous book
        if (bookRef.current) {
          bookRef.current.destroy();
        }

        // For blob URLs, fetch as ArrayBuffer first (epub.js handles ArrayBuffer better)
        let bookSource: string | ArrayBuffer = contentUrl;
        if (contentUrl.startsWith('blob:')) {
          console.log("[EpubViewer] Blob URL detected, fetching as ArrayBuffer...");
          const response = await fetch(contentUrl);
          bookSource = await response.arrayBuffer();
          console.log("[EpubViewer] ArrayBuffer size:", bookSource.byteLength);
        }

        // Create new book instance
        console.log("[EpubViewer] Creating book instance...");
        const book = epubLib(bookSource);
        bookRef.current = book;

        // Wait for book to be ready
        console.log("[EpubViewer] Waiting for book.ready...");
        await book.ready;
        console.log("[EpubViewer] Book ready!");

        // Get table of contents
        const navigation = await book.loaded.navigation;
        if (navigation.toc) {
          setToc(navigation.toc as TocItem[]);
        }

        // Render the book in scrolling mode
        const rendition = book.renderTo(viewerRef.current!, {
          width: "100%",
          height: "100%",
          spread: "none",
          flow: "scrolled-doc",
        });

        renditionRef.current = rendition;

        // Apply theme
        rendition.themes.default({
          body: {
            background: "transparent !important",
            color: "#e5e5e5 !important",
            "font-family": "Georgia, serif !important",
            "line-height": "1.8 !important",
            padding: "20px !important",
          },
          p: {
            color: "#e5e5e5 !important",
          },
          a: {
            color: "#a78bfa !important",
          },
          h1: { color: "#ffffff !important" },
          h2: { color: "#ffffff !important" },
          h3: { color: "#ffffff !important" },
          h4: { color: "#ffffff !important" },
          h5: { color: "#ffffff !important" },
          h6: { color: "#ffffff !important" },
        });

        // Set initial font size
        rendition.themes.fontSize(`${fontSize}%`);

        // Track chapter changes
        rendition.on("rendered", (section: { href: string }) => {
          const chapter = toc.find(
            (item) => item.href === section.href || section.href.includes(item.href)
          );
          if (chapter) {
            setCurrentChapter(chapter.label);
          }
        });

        // Display content
        await rendition.display();

        setIsLoading(false);
      } catch (err) {
        console.error("[EpubViewer] Error loading epub:", err);
        console.error("[EpubViewer] URL was:", contentUrl?.substring(0, 100));
        setError(`Failed to load book: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setIsLoading(false);
      }
    };

    initBook();

    return () => {
      if (bookRef.current) {
        bookRef.current.destroy();
        bookRef.current = null;
      }
    };
  }, [contentUrl, epubLib]);

  // Update font size
  useEffect(() => {
    if (renditionRef.current) {
      renditionRef.current.themes.fontSize(`${fontSize}%`);
    }
  }, [fontSize]);

  const goToChapter = useCallback((href: string) => {
    renditionRef.current?.display(href);
    setShowToc(false);
  }, []);

  const increaseFontSize = useCallback(() => {
    setFontSize((prev) => Math.min(prev + 10, 150));
  }, []);

  const decreaseFontSize = useCallback(() => {
    setFontSize((prev) => Math.max(prev - 10, 70));
  }, []);

  const blurClass = isBlurred ? "blur-xl scale-105 pointer-events-none" : "";

  return (
    <div data-viewer="epub" className={`absolute inset-0 bg-gradient-to-br from-stone-950 to-neutral-950 flex flex-col ${className}`}>
      {/* Header - centered title and TOC */}
      {showControls && !isBlurred && (
        <div className="flex-none px-4 py-3 bg-black/50 border-b border-white/10 flex items-center justify-center z-10">
          {/* Left spacer for balance */}
          <div className="absolute left-4 flex items-center gap-2 opacity-0 pointer-events-none">
            <button className="p-2"><svg className="w-4 h-4" /></button>
            <span className="text-xs w-10" />
            <button className="p-2"><svg className="w-4 h-4" /></button>
          </div>

          {/* Centered TOC button + title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowToc(!showToc)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Table of Contents"
            >
              <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </button>
            <div className="text-white/70 text-sm truncate max-w-[300px]">
              {currentChapter || title || metadata?.name || "Book"}
            </div>
          </div>

          {/* Font size controls - right side */}
          <div className="absolute right-4 flex items-center gap-2">
            <button
              onClick={decreaseFontSize}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Decrease font size"
            >
              <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="text-white/50 text-xs w-10 text-center">{fontSize}%</span>
            <button
              onClick={increaseFontSize}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Increase font size"
            >
              <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Main content area - epub.js handles its own scrolling */}
      <div className="flex-1 relative overflow-hidden">
        {/* Table of Contents sidebar */}
        {showToc && !isBlurred && (
          <div className="absolute inset-y-0 left-0 w-72 bg-black/90 border-r border-white/10 z-20 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-white font-medium mb-4">Table of Contents</h3>
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

        {/* Loading state */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-white/20 border-t-white/80 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white/60">Loading book...</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
            <div className="text-center max-w-md px-4">
              <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-red-400 mb-2">{error}</p>
              <a
                href={contentUrl}
                download
                className="inline-block mt-4 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors text-sm"
              >
                Download Instead
              </a>
            </div>
          </div>
        )}

        {/* Epub viewer container */}
        <div
          ref={viewerRef}
          className={`w-full h-full ${blurClass} transition-all duration-500`}
          style={{ opacity: isLoading || error ? 0 : 1 }}
        />
      </div>
    </div>
  );
}
