/**
 * VisualizationRenderer Component
 * ================================
 * Routes visualizations to appropriate inline chart components.
 */

import { motion } from 'framer-motion';
import { chartRevealVariants } from '../../design-system/motion';
import type { Visualization } from '../../chat/types';
import { InlineTrendChart } from './InlineTrendChart';
import { InlineSleepStack } from './InlineSleepStack';
import { InlineMetricCard } from './InlineMetricCard';
import { InlineComparison } from './InlineComparison';

interface VisualizationRendererProps {
  visualization: Visualization;
}

export function VisualizationRenderer({ visualization }: VisualizationRendererProps) {
  return (
    <motion.div
      className="inline-viz"
      variants={chartRevealVariants}
      initial="hidden"
      animate="visible"
    >
      {renderVisualization(visualization)}
    </motion.div>
  );
}

function renderVisualization(viz: Visualization) {
  switch (viz.type) {
    case 'trend':
      return (
        <InlineTrendChart
          metric={viz.metric}
          days={viz.days}
          data={viz.data}
        />
      );
    case 'sleep-stack':
      return (
        <InlineSleepStack
          date={viz.date}
          data={viz.data}
        />
      );
    case 'metric':
      return (
        <InlineMetricCard
          value={viz.value}
          unit={viz.unit}
          label={viz.label}
          trend={viz.trend}
          trendValue={viz.trendValue}
        />
      );
    case 'comparison':
      return (
        <InlineComparison
          metric={viz.metric}
          periods={viz.periods}
        />
      );
    default:
      return null;
  }
}
