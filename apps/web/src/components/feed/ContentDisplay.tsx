"use client";

import { getIpfsUrl, getContentDomain } from "@handcraft/sdk";

interface ContentDisplayProps {
  contentCid: string;
  previewCid?: string;
  contentType: number;
  title?: string;
  isActive?: boolean;
  showControls?: boolean;
  className?: string;
  isBlurred?: boolean;
}

export function ContentDisplay({
  contentCid,
  previewCid,
  contentType,
  title,
  isActive = false,
  showControls = true,
  className = "",
  isBlurred = false,
}: ContentDisplayProps) {
  const contentUrl = previewCid ? getIpfsUrl(previewCid) : getIpfsUrl(contentCid);
  const contentDomain = getContentDomain(contentType);
  const blurClass = isBlurred ? "blur-xl scale-105" : "";

  if (contentDomain === "video") {
    return (
      <video
        src={contentUrl}
        className={`max-w-full max-h-full object-contain ${blurClass} transition-all duration-500 ${className}`}
        controls={showControls && !isBlurred}
        preload="metadata"
        autoPlay={isActive}
        loop
        muted
      />
    );
  }

  if (contentDomain === "audio") {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-white/5 to-transparent ${className}`}>
        <div className={`text-center ${blurClass} transition-all duration-500`}>
          <div className="w-32 h-32 mx-auto mb-8 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm">
            <svg className="w-16 h-16 text-white/60" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
          {showControls && !isBlurred && (
            <audio src={contentUrl} controls className="w-80" autoPlay={isActive} />
          )}
        </div>
      </div>
    );
  }

  if (contentDomain === "image") {
    return (
      <img
        src={contentUrl}
        alt={title || "Content"}
        className={`max-w-full max-h-full object-contain ${blurClass} transition-all duration-500 ${className}`}
      />
    );
  }

  // Document/text/file fallback
  return (
    <div className={`w-full h-full flex items-center justify-center ${className}`}>
      <div className={`text-center ${blurClass} transition-all duration-500`}>
        <svg className="w-24 h-24 mx-auto text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      </div>
    </div>
  );
}

// Placeholder when content is loading or not available
export function ContentPlaceholder({ contentDomain }: { contentDomain: string }) {
  if (contentDomain === "video") {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <svg className="w-24 h-24 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  if (contentDomain === "image") {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <svg className="w-24 h-24 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center">
      <svg className="w-24 h-24 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    </div>
  );
}
