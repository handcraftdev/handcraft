"use client";

import { ReactNode } from "react";

export interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    direction: "up" | "down";
  };
  color?: "purple" | "emerald" | "amber" | "cyan" | "default";
}

const colorClasses = {
  purple: "from-purple-500/10 to-transparent border-purple-500/20",
  emerald: "from-emerald-500/10 to-transparent border-emerald-500/20",
  amber: "from-amber-500/10 to-transparent border-amber-500/20",
  cyan: "from-cyan-500/10 to-transparent border-cyan-500/20",
  default: "from-white/5 to-transparent border-white/5",
};

const iconColorClasses = {
  purple: "text-purple-400",
  emerald: "text-emerald-400",
  amber: "text-amber-400",
  cyan: "text-cyan-400",
  default: "text-white/50",
};

export function StatCard({ icon, label, value, subtitle, trend, color = "default" }: StatCardProps) {
  return (
    <div className={`relative p-2.5 rounded-lg bg-gradient-to-br ${colorClasses[color]} border overflow-hidden group hover:border-white/10 transition-all duration-200`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-md bg-white/5 flex items-center justify-center ${iconColorClasses[color]}`}>
            {icon}
          </div>
          <div>
            <p className="text-white/40 text-2xs uppercase tracking-wider mb-0.5">{label}</p>
            <p className="text-lg font-bold tracking-tight text-white">{value}</p>
            {subtitle && <p className="text-2xs text-white/30 mt-0.5">{subtitle}</p>}
          </div>
        </div>

        {trend && (
          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-2xs font-medium ${
            trend.direction === "up"
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-red-500/10 text-red-400"
          }`}>
            <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={trend.direction === "up" ? "M5 10l7-7m0 0l7 7m-7-7v18" : "M19 14l-7 7m0 0l-7-7m7 7V3"}
              />
            </svg>
            {trend.value}%
          </div>
        )}
      </div>
    </div>
  );
}

export function StudioStats({ stats }: { stats: StatCardProps[] }) {
  const gridCols = stats.length <= 2 ? "grid-cols-2" : stats.length === 3 ? "grid-cols-3" : "grid-cols-2 lg:grid-cols-4";

  return (
    <div className={`grid ${gridCols} gap-3`}>
      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </div>
  );
}
