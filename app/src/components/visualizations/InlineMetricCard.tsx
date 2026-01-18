/**
 * InlineMetricCard Component
 * ===========================
 * Highlighted stat with trend arrow and glow.
 */

import { motion } from 'framer-motion';

interface InlineMetricCardProps {
  value: number;
  unit: string;
  label: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
}

export function InlineMetricCard({
  value,
  unit,
  label,
  trend,
  trendValue,
}: InlineMetricCardProps) {
  const trendConfig = {
    up: { icon: '↑', color: '#34d399', label: 'Improving' },
    down: { icon: '↓', color: '#fb7185', label: 'Declining' },
    stable: { icon: '→', color: '#a1a1aa', label: 'Stable' },
  };

  const trendInfo = trend ? trendConfig[trend] : null;

  return (
    <div className="flex items-center gap-4">
      {/* Main metric */}
      <div className="flex-1">
        <div className="text-xs text-zinc-500 mb-1">{label}</div>
        <div className="flex items-baseline gap-1">
          <motion.span
            className="text-2xl font-mono font-semibold text-cyan-400"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            style={{ textShadow: '0 0 20px rgba(6, 182, 212, 0.5)' }}
          >
            {value.toFixed(1)}
          </motion.span>
          <span className="text-sm text-zinc-500">{unit}</span>
        </div>
      </div>

      {/* Trend indicator */}
      {trendInfo && (
        <motion.div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{ backgroundColor: `${trendInfo.color}15` }}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <span
            className="text-lg font-semibold"
            style={{ color: trendInfo.color }}
          >
            {trendInfo.icon}
          </span>
          <div className="text-right">
            {trendValue && (
              <div className="text-sm font-mono font-medium" style={{ color: trendInfo.color }}>
                {trendValue}
              </div>
            )}
            <div className="text-xs text-zinc-500">{trendInfo.label}</div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
