"use client";

import { TrendingUp, Wallet, Users, Award } from "lucide-react";

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Total Revenue"
          value={`${lamportsToSol(data.total_all_time_revenue)} SOL`}
          subValue={`${data.primary_sales_count || 0} sales`}
          color="blue"
        />
        <SummaryCard
          icon={<Wallet className="h-5 w-5" />}
          label="Primary Sales"
          value={`${lamportsToSol(data.total_primary_sales)} SOL`}
          color="green"
        />
        <SummaryCard
          icon={<Users className="h-5 w-5" />}
          label="Patron Revenue"
          value={`${lamportsToSol(data.total_patron_revenue)} SOL`}
          subValue={`${data.active_patron_subscribers || 0} active`}
          color="purple"
        />
        <SummaryCard
          icon={<Award className="h-5 w-5" />}
          label="Ecosystem Payouts"
          value={`${lamportsToSol(data.total_ecosystem_payouts)} SOL`}
          color="indigo"
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <SummaryCard
        icon={<TrendingUp className="h-5 w-5" />}
        label="Total Earnings"
        value={`${lamportsToSol(data.total_all_time_earnings)} SOL`}
        subValue={`${data.total_claim_count || 0} claims`}
        color="blue"
      />
      <SummaryCard
        icon={<Wallet className="h-5 w-5" />}
        label="Content Rewards"
        value={`${lamportsToSol(data.total_content_rewards)} SOL`}
        color="green"
      />
      <SummaryCard
        icon={<Users className="h-5 w-5" />}
        label="Patron Rewards"
        value={`${lamportsToSol(data.total_patron_rewards)} SOL`}
        color="purple"
      />
      <SummaryCard
        icon={<Award className="h-5 w-5" />}
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
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    indigo: "bg-indigo-50 text-indigo-600",
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
        <div className="flex-1">
          <div className="text-sm text-gray-600">{label}</div>
          <div className="text-xl font-semibold mt-1">{value}</div>
          {subValue && (
            <div className="text-xs text-gray-500 mt-1">{subValue}</div>
          )}
        </div>
      </div>
    </div>
  );
}
