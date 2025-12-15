"use client";

import { useState, useEffect } from "react";
import { ViewerProps } from "../types";

export default function PostViewer({
  contentUrl,
  title,
  metadata,
  isBlurred = false,
  className = "",
}: ViewerProps) {
  const [content, setContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  const blurClass = isBlurred ? "blur-xl scale-105" : "";

  useEffect(() => {
    // Fetch the text content
    fetch(contentUrl)
      .then(res => res.text())
      .then(text => {
        setContent(text);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Failed to load post content:", err);
        setIsLoading(false);
      });
  }, [contentUrl]);

  // Simple markdown-like rendering
  const renderContent = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, index) => {
      // Headers
      if (line.startsWith('# ')) {
        return <h1 key={index} className="text-3xl font-bold text-white mb-4 mt-6">{line.slice(2)}</h1>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={index} className="text-2xl font-bold text-white mb-3 mt-5">{line.slice(3)}</h2>;
      }
      if (line.startsWith('### ')) {
        return <h3 key={index} className="text-xl font-bold text-white mb-2 mt-4">{line.slice(4)}</h3>;
      }

      // Empty lines
      if (line.trim() === '') {
        return <div key={index} className="h-4" />;
      }

      // Bullet points
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <li key={index} className="text-white/80 text-base leading-relaxed ml-6">
            {line.slice(2)}
          </li>
        );
      }

      // Links
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      const parts = [];
      let lastIndex = 0;
      let match;

      while ((match = linkRegex.exec(line)) !== null) {
        if (match.index > lastIndex) {
          parts.push(line.substring(lastIndex, match.index));
        }
        parts.push(
          <a
            key={`link-${index}-${match.index}`}
            href={match[2]}
            className="text-blue-400 hover:text-blue-300 underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {match[1]}
          </a>
        );
        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < line.length) {
        parts.push(line.substring(lastIndex));
      }

      // Regular paragraph
      return (
        <p key={index} className="text-white/80 text-base leading-relaxed mb-4">
          {parts.length > 0 ? parts : line}
        </p>
      );
    });
  };

  return (
    <div className={`relative w-full h-full overflow-auto bg-gradient-to-br from-gray-900/20 to-slate-900/20 ${className}`}>
      <div className={`max-w-3xl mx-auto px-8 py-12 ${blurClass} transition-all duration-500`}>
        {/* Post header */}
        {metadata && (
          <div className="mb-8 pb-6 border-b border-white/10">
            <h1 className="text-white text-4xl font-bold mb-3">
              {metadata.name || title || "Post"}
            </h1>
            <div className="flex items-center gap-4 text-white/60 text-sm">
              {metadata.author && (
                <span>By {metadata.author}</span>
              )}
              {metadata.publishedAt && (
                <span>{new Date(metadata.publishedAt).toLocaleDateString()}</span>
              )}
            </div>
            {metadata.tags && metadata.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {metadata.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="bg-white/10 text-white/80 text-xs px-3 py-1 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Post content */}
        <div className="prose prose-invert max-w-none">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/40" />
            </div>
          ) : content ? (
            <div className="text-white/80 leading-relaxed">
              {renderContent(content)}
            </div>
          ) : (
            <div className="text-white/60 text-center py-12">
              No content available
            </div>
          )}
        </div>

        {/* Footer */}
        {metadata?.description && !isLoading && (
          <div className="mt-12 pt-6 border-t border-white/10">
            <p className="text-white/60 text-sm italic">
              {metadata.description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
