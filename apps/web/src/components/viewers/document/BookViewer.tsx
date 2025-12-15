"use client";

import { Suspense, lazy } from "react";
import { ViewerProps } from "../types";

// Lazy load EpubViewer to avoid SSR issues with epub.js
const EpubViewer = lazy(() => import("./EpubViewer"));

function BookLoadingPlaceholder() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-stone-950 to-neutral-950">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-white/20 border-t-white/80 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/60">Loading book reader...</p>
      </div>
    </div>
  );
}

export default function BookViewer(props: ViewerProps) {
  const { contentUrl, title, metadata, isBlurred = false, showControls = true, className = "" } = props;
  const blurClass = isBlurred ? "blur-xl scale-105" : "";

  // Detect file type from metadata (preferred) or URL fallback
  const mimeType = metadata?.mimeType?.toLowerCase() || '';
  const fileName = metadata?.fileName?.toLowerCase() || '';
  const lowerUrl = contentUrl.toLowerCase();

  // Debug logging
  console.log("[BookViewer] Detection:", { mimeType, fileName, url: lowerUrl.substring(0, 80) });

  // Check by mime type first, then filename, then URL
  const isPdf = mimeType === 'application/pdf' ||
    fileName.endsWith('.pdf') ||
    lowerUrl.endsWith('.pdf') ||
    lowerUrl.includes('.pdf');

  const isEpub = mimeType === 'application/epub+zip' ||
    fileName.endsWith('.epub') ||
    lowerUrl.endsWith('.epub') ||
    lowerUrl.includes('.epub');

  console.log("[BookViewer] Format detected:", { isPdf, isEpub });

  // PDF viewer
  if (isPdf) {
    return (
      <div data-viewer="pdf" className={`relative w-full h-full bg-gradient-to-br from-amber-950/20 to-stone-950/20 ${className}`}>
        <div className={`w-full h-full ${blurClass} transition-all duration-500`}>
          <iframe
            src={contentUrl}
            className="w-full h-full"
            title={title || "Book"}
          />
        </div>
      </div>
    );
  }

  // EPUB viewer
  if (isEpub) {
    return (
      <Suspense fallback={<BookLoadingPlaceholder />}>
        <EpubViewer {...props} />
      </Suspense>
    );
  }

  // Fallback for other formats (show metadata + download)
  return (
    <div data-viewer="book" className={`relative w-full h-full bg-gradient-to-br from-amber-950/20 to-stone-950/20 ${className}`}>
      <div className={`w-full h-full flex items-center justify-center ${blurClass} transition-all duration-500`}>
        <div className="text-center max-w-2xl px-8">
          {/* Book cover placeholder */}
          {metadata?.image ? (
            <div className="w-64 h-96 mx-auto mb-8 rounded-lg overflow-hidden shadow-2xl">
              <img src={metadata.image} alt={title} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-64 h-96 mx-auto mb-8 rounded-lg bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center backdrop-blur-sm">
              <svg className="w-32 h-32 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          )}

          {/* Book metadata */}
          {metadata && (
            <div className="bg-black/40 backdrop-blur-sm rounded-lg p-6">
              <h2 className="text-white text-2xl font-bold mb-3">
                {metadata.name || title}
              </h2>
              {metadata.author && (
                <p className="text-white/90 text-lg mb-2">by {metadata.author}</p>
              )}
              {metadata.description && (
                <p className="text-white/70 text-sm mb-4 line-clamp-4">
                  {metadata.description}
                </p>
              )}
              <div className="flex flex-wrap gap-3 justify-center text-white/60 text-sm">
                {metadata.publisher && <span>Publisher: {metadata.publisher}</span>}
                {metadata.year && <span>Year: {metadata.year}</span>}
                {metadata.pages && <span>Pages: {metadata.pages}</span>}
                {metadata.isbn && <span>ISBN: {metadata.isbn}</span>}
              </div>
            </div>
          )}

          {!isBlurred && (
            <a
              href={contentUrl}
              download
              className="inline-block mt-6 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-lg backdrop-blur-sm transition-colors"
            >
              Download Book
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
