"use client";

import { DisputeTypeEnum, type DisputeType } from "@scalecraft/sdk";

interface ReportCategorySelectProps {
  value: DisputeType;
  onChange: (disputeType: DisputeType) => void;
}

// Map Tribunalcraft DisputeType to user-friendly labels
const DISPUTE_TYPE_INFO: Array<{
  type: DisputeType;
  label: string;
  description: string;
}> = [
  {
    type: DisputeTypeEnum.PolicyViolation,
    label: "Policy Violation",
    description: "Content violates platform guidelines or terms of service",
  },
  {
    type: DisputeTypeEnum.Fraud,
    label: "Fraud / Scam",
    description: "Deceptive content intended to mislead or scam users",
  },
  {
    type: DisputeTypeEnum.Misrepresentation,
    label: "Misrepresentation",
    description: "False claims about content, authorship, or authenticity",
  },
  {
    type: DisputeTypeEnum.QualityDispute,
    label: "Quality Issue",
    description: "Content does not match description or expectations",
  },
  {
    type: DisputeTypeEnum.Breach,
    label: "Copyright / Breach",
    description: "Unauthorized use of copyrighted or protected material",
  },
  {
    type: DisputeTypeEnum.DamagesClaim,
    label: "Harmful Content",
    description: "Content that causes harm or damages to individuals",
  },
  {
    type: DisputeTypeEnum.Other,
    label: "Other",
    description: "Other violations not covered above",
  },
];

export function ReportCategorySelect({ value, onChange }: ReportCategorySelectProps) {
  // Check if a dispute type matches by comparing the object keys
  const isSelected = (type: DisputeType) => {
    const valueKey = Object.keys(value)[0];
    const typeKey = Object.keys(type)[0];
    return valueKey === typeKey;
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-white/70">Report Category</label>
      <div className="grid grid-cols-1 gap-2">
        {DISPUTE_TYPE_INFO.map((item, index) => {
          const selected = isSelected(item.type);

          return (
            <button
              key={index}
              type="button"
              onClick={() => onChange(item.type)}
              className={`p-3 rounded-xl text-left transition-all duration-200 border ${
                selected
                  ? "bg-red-500/20 border-red-500/50 text-white"
                  : "bg-white/[0.02] border-white/10 hover:border-white/20 text-white/70 hover:text-white"
              }`}
            >
              <div className="font-medium text-sm">{item.label}</div>
              <div className="text-xs text-white/50 mt-0.5">{item.description}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
