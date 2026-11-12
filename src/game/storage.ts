import { GameMode, getTodayDateKey } from './rules';

export interface PlayerProgress {
  classicBest: number;
  dailyBest: number;
  streakCount: number;
  lastCompletedDailyDate: string | null;
  completedDailyDates: string[];
  totalGamesPlayed: number;
  totalLinesCleared: number;
}

const STORAGE_KEY = 'blokblast_player_progress_v1';

const DEFAULT_PROGRESS: PlayerProgress = {
  classicBest: 0,
  dailyBest: 0,
  streakCount: 1,
  lastCompletedDailyDate: null,
  completedDailyDates: [],
  totalGamesPlayed: 0,
  totalLinesCleared: 0,
};

export function loadPlayerProgress(): PlayerProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROGRESS };
    const parsed = JSON.parse(raw);
    return {
      classicBest: Number(parsed.classicBest) || 0,
      dailyBest: Number(parsed.dailyBest) || 0,
      streakCount: Math.max(1, Number(parsed.streakCount) || 1),
      lastCompletedDailyDate: parsed.lastCompletedDailyDate || null,
      completedDailyDates: Array.isArray(parsed.completedDailyDates)
        ? parsed.completedDailyDates
        : [],
      totalGamesPlayed: Number(parsed.totalGamesPlayed) || 0,
      totalLinesCleared: Number(parsed.totalLinesCleared) || 0,
    };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

export function savePlayerProgress(progress: PlayerProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // ignore storage errors
  }
}

export function recordScoreUpdate(
  mode: GameMode,
  score: number,
  linesDelta: number,
  dailyTargetReached: boolean
): PlayerProgress {
  const current = loadPlayerProgress();
  const todayKey = getTodayDateKey();

  if (mode === 'classic' && score > current.classicBest) {
    current.classicBest = score;
  }
  if (mode === 'daily' && score > current.dailyBest) {
    current.dailyBest = score;
  }

  current.totalLinesCleared += linesDelta;

  if (dailyTargetReached && !current.completedDailyDates.includes(todayKey)) {
    current.completedDailyDates.push(todayKey);
    if (current.lastCompletedDailyDate && current.lastCompletedDailyDate !== todayKey) {
      current.streakCount += 1;
    }
    current.lastCompletedDailyDate = todayKey;
  }

  savePlayerProgress(current);
  return current;
}
