/**
 * InlineTrendChart Component
 * ===========================
 * Compact sparkline for trend visualization.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { TrendDataPoint } from '../../chat/types';

interface InlineTrendChartProps {
  metric: 'sleep' | 'quality' | 'hrv' | 'hr';
  days: number;
  data?: TrendDataPoint[];
}

const METRIC_CONFIG = {
  sleep: { label: 'Sleep Duration', unit: 'h', color: '#06b6d4' },
  quality: { label: 'Sleep Quality', unit: '%', color: '#8b5cf6' },
  hrv: { label: 'HRV', unit: 'ms', color: '#10b981' },
  hr: { label: 'Resting HR', unit: 'bpm', color: '#f43f5e' },
};

export function InlineTrendChart({ metric, days, data }: InlineTrendChartProps) {
  const config = METRIC_CONFIG[metric];

  // Generate sample data if none provided
  const chartData = useMemo(() => {
    if (data && data.length > 0) return data;

    // Generate placeholder data for visual
    const points: TrendDataPoint[] = [];
    const baseValue = metric === 'sleep' ? 7 : metric === 'quality' ? 45 : metric === 'hrv' ? 50 : 55;
    const variance = metric === 'sleep' ? 1 : metric === 'quality' ? 10 : metric === 'hrv' ? 15 : 8;

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      points.push({
        date: date.toISOString().split('T')[0],
        value: baseValue + (Math.random() - 0.5) * variance * 2,
      });
    }
    return points;
  }, [data, days, metric]);

  // Calculate sparkline path
  const { path, width, height, minValue, maxValue, avgValue } = useMemo(() => {
    const w = 200;
    const h = 48;
    const padding = 4;

    const values = chartData.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const range = max - min || 1;

    const points = chartData.map((d, i) => {
      const x = padding + (i / (chartData.length - 1)) * (w - padding * 2);
      const y = h - padding - ((d.value - min) / range) * (h - padding * 2);
      return `${x},${y}`;
    });

    return {
      path: `M ${points.join(' L ')}`,
      width: w,
      height: h,
      minValue: min,
      maxValue: max,
      avgValue: avg,
    };
  }, [chartData]);

  // Trend direction
  const trendDirection = useMemo(() => {
    if (chartData.length < 2) return 'stable';
    const firstHalf = chartData.slice(0, Math.floor(chartData.length / 2));
    const secondHalf = chartData.slice(Math.floor(chartData.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b.value, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b.value, 0) / secondHalf.length;
    const diff = ((secondAvg - firstAvg) / firstAvg) * 100;
    if (diff > 5) return 'up';
    if (diff < -5) return 'down';
    return 'stable';
  }, [chartData]);

  return (
    <div className="flex items-center gap-4">
      {/* Chart */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-zinc-500">{config.label} - Last {days} days</span>
          <span className={`text-xs font-medium flex items-center gap-1 ${
            trendDirection === 'up' ? 'text-emerald-400' :
            trendDirection === 'down' ? 'text-coral-400' :
            'text-zinc-400'
          }`}>
            {trendDirection === 'up' ? '↑' : trendDirection === 'down' ? '↓' : '→'}
            {trendDirection === 'stable' ? 'Stable' : trendDirection === 'up' ? 'Improving' : 'Declining'}
          </span>
        </div>

        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="overflow-visible"
        >
          {/* Gradient fill */}
          <defs>
            <linearGradient id={`gradient-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={config.color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={config.color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Fill area */}
          <motion.path
            d={`${path} L ${width - 4},${height - 4} L 4,${height - 4} Z`}
            fill={`url(#gradient-${metric})`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          />

          {/* Line */}
          <motion.path
            d={path}
            fill="none"
            stroke={config.color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />

          {/* End dot */}
          <motion.circle
            cx={width - 4}
            cy={height - 4 - ((chartData[chartData.length - 1].value - minValue) / (maxValue - minValue || 1)) * (height - 8)}
            r="4"
            fill={config.color}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5, type: 'spring' }}
          />
        </svg>
      </div>

      {/* Stats */}
      <div className="text-right">
        <div className="text-lg font-mono font-semibold" style={{ color: config.color }}>
          {avgValue.toFixed(1)}{config.unit}
        </div>
        <div className="text-xs text-zinc-600">avg</div>
      </div>
    </div>
  );
}
