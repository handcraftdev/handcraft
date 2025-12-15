"use client";

import { useState, useRef, useEffect } from "react";

interface SpeedSelectorProps {
  value: number;
  onChange: (rate: number) => void;
  rates?: number[];
}

export function SpeedSelector({
  value,
  onChange,
  rates = [0.75, 1, 1.25, 1.5, 1.75, 2]
}: SpeedSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Calculate offset so selected item overlays exactly on the button
  const selectedIndex = rates.indexOf(value);
  const itemHeight = 36; // px
  const topOffset = selectedIndex * itemHeight;

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-white/10 text-white text-sm px-4 py-2 rounded-lg backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-colors min-w-[70px] flex items-center justify-center h-9"
      >
        {value}x
      </button>

      {/* Dropdown overlays the button, selected item aligned with button */}
      {isOpen && (
        <div
          className="absolute left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur-md border border-white/20 rounded-lg overflow-hidden shadow-xl z-50"
          style={{
            top: `-${topOffset}px`,
          }}
        >
          {rates.map((rate) => (
            <button
              key={rate}
              onClick={() => {
                onChange(rate);
                setIsOpen(false);
              }}
              className={`w-full px-5 text-sm text-center transition-colors flex items-center justify-center ${
                rate === value
                  ? 'bg-white/20 text-white'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
              style={{ height: `${itemHeight}px` }}
            >
              {rate}x
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
