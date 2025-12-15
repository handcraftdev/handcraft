"use client";

import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export interface TimeSeriesDataPoint {
  date: string;
  amount: number;
  count: number;
}

export interface RevenueChartProps {
  data: TimeSeriesDataPoint[];
  title?: string;
  type?: "revenue" | "earnings";
}

export function RevenueChart({
  data,
  title = "Revenue Over Time",
  type = "revenue",
}: RevenueChartProps) {
  const chartData = useMemo(() => {
    return {
      labels: data.map((d) => new Date(d.date).toLocaleDateString()),
      datasets: [
        {
          label: type === "revenue" ? "Revenue (SOL)" : "Earnings (SOL)",
          data: data.map((d) => d.amount / 1e9),
          borderColor: type === "revenue" ? "rgb(59, 130, 246)" : "rgb(16, 185, 129)",
          backgroundColor:
            type === "revenue"
              ? "rgba(59, 130, 246, 0.1)"
              : "rgba(16, 185, 129, 0.1)",
          fill: true,
          tension: 0.4,
        },
      ],
    };
  }, [data, type]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: !!title,
        text: title,
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const label = context.dataset.label || "";
            const value = context.parsed.y.toFixed(6);
            const count = data[context.dataIndex]?.count || 0;
            return [
              `${label}: ${value} SOL`,
              `Transactions: ${count}`,
            ];
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function (value: any) {
            return value.toFixed(3) + " SOL";
          },
        },
      },
    },
  };

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  return (
    <div className="h-64">
      <Line data={chartData} options={options} />
    </div>
  );
}
