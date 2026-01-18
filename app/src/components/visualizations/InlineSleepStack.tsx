/**
 * InlineSleepStack Component
 * ===========================
 * Single night's sleep architecture bar.
 */

import { motion } from 'framer-motion';
import type { SleepStackData } from '../../chat/types';

interface InlineSleepStackProps {
  date: string;
  data?: SleepStackData;
}

const STAGE_COLORS = {
  deep: '#1e40af',
  rem: '#7c3aed',
  light: '#475569',
  awake: '#dc2626',
};

export function InlineSleepStack({ date, data }: InlineSleepStackProps) {
  // Use provided data or defaults
  const sleepData: SleepStackData = data || {
    deepPercent: 20,
    remPercent: 25,
    lightPercent: 50,
    awakePercent: 5,
    totalHours: 7.5,
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-zinc-500">Sleep Architecture - {formatDate(date)}</span>
        <span className="text-sm font-mono text-cyan-400">{sleepData.totalHours.toFixed(1)}h</span>
      </div>

      {/* Stack bar */}
      <div className="sleep-stack">
        <motion.div
          className="h-full"
          style={{ backgroundColor: STAGE_COLORS.deep, width: `${sleepData.deepPercent}%` }}
          initial={{ width: 0 }}
          animate={{ width: `${sleepData.deepPercent}%` }}
          transition={{ duration: 0.5, delay: 0 }}
        />
        <motion.div
          className="h-full"
          style={{ backgroundColor: STAGE_COLORS.rem, width: `${sleepData.remPercent}%` }}
          initial={{ width: 0 }}
          animate={{ width: `${sleepData.remPercent}%` }}
          transition={{ duration: 0.5, delay: 0.1 }}
        />
        <motion.div
          className="h-full"
          style={{ backgroundColor: STAGE_COLORS.light, width: `${sleepData.lightPercent}%` }}
          initial={{ width: 0 }}
          animate={{ width: `${sleepData.lightPercent}%` }}
          transition={{ duration: 0.5, delay: 0.2 }}
        />
        {sleepData.awakePercent > 0 && (
          <motion.div
            className="h-full"
            style={{ backgroundColor: STAGE_COLORS.awake, width: `${sleepData.awakePercent}%` }}
            initial={{ width: 0 }}
            animate={{ width: `${sleepData.awakePercent}%` }}
            transition={{ duration: 0.5, delay: 0.3 }}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between mt-2 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: STAGE_COLORS.deep }} />
            <span className="text-zinc-500">Deep {sleepData.deepPercent}%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: STAGE_COLORS.rem }} />
            <span className="text-zinc-500">REM {sleepData.remPercent}%</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: STAGE_COLORS.light }} />
            <span className="text-zinc-500">Light {sleepData.lightPercent}%</span>
          </div>
          {sleepData.awakePercent > 0 && (
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: STAGE_COLORS.awake }} />
              <span className="text-zinc-500">Awake {sleepData.awakePercent}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
