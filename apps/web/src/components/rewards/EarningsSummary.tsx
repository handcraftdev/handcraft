"use client";

import { TrendingUp, Wallet, Users, Award } from "lucide-react";

// Override default lucide icon size for compact design
const ICON_SIZE = "h-4 w-4";

export interface EarningsSummaryData {
  total_all_time_revenue?: number;
  total_all_time_earnings?: number;
  total_primary_sales?: number;
  total_patron_revenue?: number;
  total_ecosystem_payouts?: number;
  total_content_rewards?: number;
  total_bundle_rewards?: number;
  total_patron_rewards?: number;
  total_global_rewards?: number;
  active_patron_subscribers?: number;
  primary_sales_count?: number;
  total_claim_count?: number;
}

export interface EarningsSummaryProps {
  data: EarningsSummaryData;
  type: "creator" | "user";
}

export function EarningsSummary({ data, type }: EarningsSummaryProps) {
  const lamportsToSol = (lamports: number = 0) => {
    return (lamports / 1e9).toFixed(4);
  };

  if (type === "creator") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          icon={<TrendingUp className={ICON_SIZE} />}
          label="Total Revenue"
          value={`${lamportsToSol(data.total_all_time_revenue)} SOL`}
          subValue={`${data.primary_sales_count || 0} sales`}
          color="blue"
        />
        <SummaryCard
          icon={<Wallet className={ICON_SIZE} />}
          label="Primary Sales"
          value={`${lamportsToSol(data.total_primary_sales)} SOL`}
          color="green"
        />
        <SummaryCard
          icon={<Users className={ICON_SIZE} />}
          label="Patron Revenue"
          value={`${lamportsToSol(data.total_patron_revenue)} SOL`}
          subValue={`${data.active_patron_subscribers || 0} active`}
          color="purple"
        />
        <SummaryCard
          icon={<Award className={ICON_SIZE} />}
          label="Ecosystem Payouts"
          value={`${lamportsToSol(data.total_ecosystem_payouts)} SOL`}
          color="indigo"
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      <SummaryCard
        icon={<TrendingUp className={ICON_SIZE} />}
        label="Total Earnings"
        value={`${lamportsToSol(data.total_all_time_earnings)} SOL`}
        subValue={`${data.total_claim_count || 0} claims`}
        color="blue"
      />
      <SummaryCard
        icon={<Wallet className={ICON_SIZE} />}
        label="Content Rewards"
        value={`${lamportsToSol(data.total_content_rewards)} SOL`}
        color="green"
      />
      <SummaryCard
        icon={<Users className={ICON_SIZE} />}
        label="Patron Rewards"
        value={`${lamportsToSol(data.total_patron_rewards)} SOL`}
        color="purple"
      />
      <SummaryCard
        icon={<Award className={ICON_SIZE} />}
        label="Global Rewards"
        value={`${lamportsToSol(data.total_global_rewards)} SOL`}
        color="indigo"
      />
    </div>
  );
}

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  color: "blue" | "green" | "purple" | "indigo";
}

function SummaryCard({ icon, label, value, subValue, color }: SummaryCardProps) {
  const colorClasses = {
    blue: "bg-blue-500/20 text-blue-400",
    green: "bg-emerald-500/20 text-emerald-400",
    purple: "bg-purple-500/20 text-purple-400",
    indigo: "bg-indigo-500/20 text-indigo-400",
  };

  return (
    <div className="bg-white/[0.02] rounded-lg border border-white/[0.06] p-3">
      <div className="flex items-center gap-2.5">
        <div className={`p-1.5 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
        <div className="flex-1">
          <div className="text-sm text-white/40">{label}</div>
          <div className="text-xl font-semibold text-white/90 mt-0.5">{value}</div>
          {subValue && (
            <div className="text-xs text-white/30 mt-0.5">{subValue}</div>
          )}
        </div>
      </div>
    </div>
  );
}
