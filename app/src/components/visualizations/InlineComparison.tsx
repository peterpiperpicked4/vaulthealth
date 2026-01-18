/**
 * InlineComparison Component
 * ===========================
 * Period vs period comparison visualization.
 */

import { motion } from 'framer-motion';
import type { ComparePeriod } from '../../chat/types';

interface InlineComparisonProps {
  metric: string;
  periods: [ComparePeriod, ComparePeriod];
}

export function InlineComparison({ metric, periods }: InlineComparisonProps) {
  const [period1, period2] = periods;

  // Calculate difference
  const diff = period2.value - period1.value;
  const percentChange = period1.value !== 0
    ? ((diff / period1.value) * 100)
    : 0;

  const isImprovement = diff > 0;
  const isSignificant = Math.abs(percentChange) > 5;

  return (
    <div>
      <div className="text-xs text-zinc-500 mb-3">{metric} Comparison</div>

      <div className="flex items-center gap-4">
        {/* Period 1 */}
        <motion.div
          className="flex-1 text-center p-3 rounded-lg"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="text-xl font-mono font-semibold text-zinc-400">
            {period1.value.toFixed(1)}
            <span className="text-sm ml-1">{period1.unit}</span>
          </div>
          <div className="text-xs text-zinc-600 mt-1">{period1.label}</div>
        </motion.div>

        {/* Difference indicator */}
        <motion.div
          className="flex flex-col items-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className={`text-lg font-semibold ${
            isImprovement ? 'text-emerald-400' : isSignificant ? 'text-coral-400' : 'text-zinc-400'
          }`}>
            {diff > 0 ? '+' : ''}{diff.toFixed(1)}
          </div>
          <div className="text-xs text-zinc-600">
            {percentChange > 0 ? '+' : ''}{percentChange.toFixed(0)}%
          </div>
        </motion.div>

        {/* Period 2 */}
        <motion.div
          className={`flex-1 text-center p-3 rounded-lg ${
            isImprovement
              ? 'bg-emerald-500/10 border border-emerald-500/20'
              : isSignificant
              ? 'bg-coral-500/10 border border-coral-500/20'
              : 'bg-zinc-500/10 border border-zinc-500/20'
          }`}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className={`text-xl font-mono font-semibold ${
            isImprovement ? 'text-emerald-400' : isSignificant ? 'text-coral-400' : 'text-white'
          }`}>
            {period2.value.toFixed(1)}
            <span className="text-sm ml-1">{period2.unit}</span>
          </div>
          <div className="text-xs text-zinc-600 mt-1">{period2.label}</div>
        </motion.div>
      </div>
    </div>
  );
}
