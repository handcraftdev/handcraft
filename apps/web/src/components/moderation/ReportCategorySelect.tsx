"use client";

import { ReportCategory } from "@handcraft/sdk";

interface ReportCategorySelectProps {
  value: ReportCategory;
  onChange: (category: ReportCategory) => void;
}

const CATEGORY_INFO: Record<ReportCategory, { label: string; description: string }> = {
  [ReportCategory.Copyright]: {
    label: "Copyright Infringement",
    description: "Unauthorized use of copyrighted material",
  },
  [ReportCategory.Illegal]: {
    label: "Illegal Content",
    description: "Content that violates laws or regulations",
  },
  [ReportCategory.Spam]: {
    label: "Spam",
    description: "Repetitive, misleading, or low-quality content",
  },
  [ReportCategory.AdultContent]: {
    label: "Adult Content",
    description: "Explicit or inappropriate content without proper marking",
  },
  [ReportCategory.Harassment]: {
    label: "Harassment",
    description: "Bullying, threats, or targeted abuse",
  },
  [ReportCategory.Fraud]: {
    label: "Fraud / Scam",
    description: "Deceptive content intended to mislead or scam users",
  },
  [ReportCategory.Other]: {
    label: "Other",
    description: "Other violations not covered above",
  },
};

export function ReportCategorySelect({ value, onChange }: ReportCategorySelectProps) {
  const categories = Object.values(ReportCategory);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-white/70">Report Category</label>
      <div className="grid grid-cols-1 gap-2">
        {categories.map((category) => {
          const info = CATEGORY_INFO[category];
          const isSelected = value === category;

          return (
            <button
              key={category}
              type="button"
              onClick={() => onChange(category)}
              className={`p-3 rounded-xl text-left transition-all duration-200 border ${
                isSelected
                  ? "bg-red-500/20 border-red-500/50 text-white"
                  : "bg-white/[0.02] border-white/10 hover:border-white/20 text-white/70 hover:text-white"
              }`}
            >
              <div className="font-medium text-sm">{info.label}</div>
              <div className="text-xs text-white/50 mt-0.5">{info.description}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
