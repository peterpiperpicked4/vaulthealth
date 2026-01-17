/**
 * MorningRatingWidget Component
 * ==============================
 * Quick entry widget for morning energy/mood ratings.
 * Designed for fast daily input with optional expanded details.
 */

import { useState, useEffect } from 'react';
import { put, getMorningRatingByDate, getByIndex } from '../db/database';
import { generateId } from '../utils/crypto';
import type { MorningRating, MorningTag, SleepSession } from '../types/schema';

interface MorningRatingWidgetProps {
  userId?: string;
  onRatingSubmitted?: (rating: MorningRating) => void;
}

const ENERGY_LABELS: Record<1 | 2 | 3 | 4 | 5, { label: string; emoji: string; color: string }> = {
  1: { label: 'Exhausted', emoji: '😴', color: 'bg-red-500' },
  2: { label: 'Tired', emoji: '😔', color: 'bg-orange-500' },
  3: { label: 'Okay', emoji: '😐', color: 'bg-yellow-500' },
  4: { label: 'Good', emoji: '🙂', color: 'bg-lime-500' },
  5: { label: 'Energized', emoji: '😃', color: 'bg-green-500' },
};

const QUICK_TAGS: { tag: MorningTag; label: string; positive: boolean }[] = [
  { tag: 'woke_refreshed', label: 'Woke Refreshed', positive: true },
  { tag: 'woke_naturally', label: 'Woke Naturally', positive: true },
  { tag: 'slept_through', label: 'Slept Through', positive: true },
  { tag: 'feel_rested', label: 'Feel Rested', positive: true },
  { tag: 'woke_tired', label: 'Woke Tired', positive: false },
  { tag: 'hard_to_wake', label: 'Hard to Wake', positive: false },
  { tag: 'woke_during_night', label: 'Woke Up', positive: false },
  { tag: 'feel_groggy', label: 'Feel Groggy', positive: false },
];

export default function MorningRatingWidget({
  userId = 'default',
  onRatingSubmitted,
}: MorningRatingWidgetProps) {
  const [todayRating, setTodayRating] = useState<MorningRating | null>(null);
  const [selectedEnergy, setSelectedEnergy] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [selectedTags, setSelectedTags] = useState<MorningTag[]>([]);
  const [showExpanded, setShowExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastNightSession, setLastNightSession] = useState<SleepSession | null>(null);

  const today = new Date().toISOString().split('T')[0];

  // Check if already rated today
  useEffect(() => {
    async function checkTodayRating() {
      const existing = await getMorningRatingByDate(userId, today);
      if (existing) {
        setTodayRating(existing);
        setSelectedEnergy(existing.energyLevel);
        setSelectedTags(existing.tags || []);
      }

      // Find last night's sleep session
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const sessions = await getByIndex('sleepSessions', 'date', yesterdayStr);
      if (sessions.length > 0) {
        setLastNightSession(sessions[0] as SleepSession);
      }
    }
    checkTodayRating();
  }, [userId, today]);

  async function handleSubmit() {
    if (!selectedEnergy) return;

    setSaving(true);

    const rating: MorningRating = {
      id: todayRating?.id || generateId(),
      userId,
      date: today,
      sleepSessionId: lastNightSession?.id,
      energyLevel: selectedEnergy,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      ratedAt: new Date().toISOString(),
    };

    await put('morningRatings', rating);
    setTodayRating(rating);
    setSaving(false);
    setShowExpanded(false);
    onRatingSubmitted?.(rating);
  }

  function toggleTag(tag: MorningTag) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  // If already rated, show compact summary
  if (todayRating && !showExpanded) {
    const energyInfo = ENERGY_LABELS[todayRating.energyLevel];
    return (
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{energyInfo.emoji}</span>
            <div>
              <p className="text-sm text-slate-400">Today's Energy</p>
              <p className="font-medium">{energyInfo.label}</p>
            </div>
          </div>
          <button
            onClick={() => setShowExpanded(true)}
            className="text-sm text-primary-400 hover:text-primary-300"
          >
            Edit
          </button>
        </div>
        {todayRating.tags && todayRating.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {todayRating.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 bg-slate-700 rounded"
              >
                {QUICK_TAGS.find((t) => t.tag === tag)?.label || tag}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Rating entry form
  return (
    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium flex items-center gap-2">
          <span className="text-xl">☀️</span>
          How do you feel this morning?
        </h3>
        {todayRating && (
          <button
            onClick={() => setShowExpanded(false)}
            className="text-sm text-slate-400 hover:text-white"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Energy Level Selection */}
      <div className="flex justify-between gap-2 mb-4">
        {([1, 2, 3, 4, 5] as const).map((level) => {
          const info = ENERGY_LABELS[level];
          const isSelected = selectedEnergy === level;
          return (
            <button
              key={level}
              onClick={() => setSelectedEnergy(level)}
              className={`
                flex-1 py-3 rounded-lg transition-all text-center
                ${isSelected
                  ? `${info.color} text-white ring-2 ring-white/50`
                  : 'bg-slate-700/50 hover:bg-slate-700'
                }
              `}
            >
              <div className="text-2xl mb-1">{info.emoji}</div>
              <div className="text-xs">{info.label}</div>
            </button>
          );
        })}
      </div>

      {/* Quick Tags */}
      {selectedEnergy && (
        <div className="mb-4">
          <p className="text-xs text-slate-400 mb-2">Quick tags (optional)</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_TAGS.map(({ tag, label, positive }) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`
                    text-xs px-3 py-1.5 rounded-full transition-all
                    ${isSelected
                      ? positive
                        ? 'bg-green-500/30 text-green-300 ring-1 ring-green-500'
                        : 'bg-red-500/30 text-red-300 ring-1 ring-red-500'
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                    }
                  `}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Last Night's Sleep Summary (if available) */}
      {lastNightSession && selectedEnergy && (
        <div className="mb-4 p-3 bg-slate-900/50 rounded-lg text-sm">
          <p className="text-slate-400 mb-1">Last night's sleep:</p>
          <div className="flex gap-4 text-slate-300">
            <span>
              {(lastNightSession.durationSeconds / 3600).toFixed(1)}h total
            </span>
            <span>
              {((lastNightSession.deepSeconds / lastNightSession.durationSeconds) * 100).toFixed(0)}% deep
            </span>
            <span>
              {((lastNightSession.remSeconds / lastNightSession.durationSeconds) * 100).toFixed(0)}% REM
            </span>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={!selectedEnergy || saving}
        className={`
          w-full py-2.5 rounded-lg font-medium transition-all
          ${selectedEnergy
            ? 'bg-primary-500 hover:bg-primary-600 text-white'
            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          }
        `}
      >
        {saving ? 'Saving...' : todayRating ? 'Update Rating' : 'Log Morning Energy'}
      </button>

      <p className="text-xs text-slate-500 text-center mt-2">
        Track daily to improve insight accuracy
      </p>
    </div>
  );
}
