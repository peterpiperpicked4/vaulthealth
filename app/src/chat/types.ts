/**
 * Chat Types
 * ===========
 * Type definitions for the AI chat feature.
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isStreaming?: boolean;
}

export interface SleepSessionSummary {
  date: string;
  sleepHours: number;
  deepPercent: number;
  remPercent: number;
  efficiency: number | null;
  restingHR: number | null;
  hrv: number | null;
}

export interface WorkoutSummary {
  date: string;
  type: string;
  durationMinutes: number;
  calories: number | null;
  avgHR: number | null;
}

export interface InsightSummary {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export interface HealthContext {
  summary: {
    totalNights: number;
    dateRange: { start: string; end: string };
    avgSleepHours: number;
    avgQuality: number;
    avgHRV: number | null;
    avgRestingHR: number | null;
  };
  recentNights: SleepSessionSummary[];
  recentWorkouts: WorkoutSummary[];
  insights: InsightSummary[];
  trends: {
    sleepTrending: 'improving' | 'declining' | 'stable';
    qualityTrending: 'improving' | 'declining' | 'stable';
  };
}

export interface ChatRequest {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  healthContext: HealthContext;
  stream?: boolean;
}

export interface StreamChunk {
  text?: string;
  done?: boolean;
  error?: string;
}
