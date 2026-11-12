import React from 'react';
import { GameMode } from '../game/rules';

interface GameHudProps {
  mode: GameMode;
  score: number;
  bestScore: number;
  combo: number;
  streakCount: number;
  dailyTarget: number;
  muted: boolean;
  selectedTrayIndex: number;
  traySummary: { index: number; placed: boolean; name: string; colorId: number }[];
  onSelectTray: (index: number) => void;
  onHint: () => void;
  onToggleMute: () => void;
  onRestart: () => void;
  onPause: () => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  mode,
  score,
  bestScore,
  combo,
  streakCount,
  dailyTarget,
  muted,
  selectedTrayIndex,
  traySummary,
  onSelectTray,
  onHint,
  onToggleMute,
  onRestart,
  onPause,
}) => {
  const progressPct = Math.min(100, Math.round((score / dailyTarget) * 100));

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between px-3 sm:px-6 py-2.5 sm:py-4">
      {/* Top Unified Perimeter Status Bar (<= 12% viewport height, zero backdrop-filter) */}
      <div className="w-full max-w-[540px] mx-auto flex items-center justify-between gap-2">
        {/* Left Cluster: Hero Score & Best Score */}
        <div className="flex items-center gap-4 sm:gap-6 bg-[#1B1F26] px-3.5 py-2 rounded-xl border border-[#F4F1EA]/10 shadow-md">
          <div>
            <span className="block text-[10px] font-mono font-bold tracking-wider text-[#A39E93] uppercase">
              SKOR
            </span>
            <span
              data-testid="hud-score"
              className="text-2xl sm:text-3xl font-extrabold text-[#F4F1EA] tabular-nums leading-none stroke-text"
            >
              {Math.round(score)}
            </span>
          </div>

          <div className="h-7 w-[1px] bg-[#F4F1EA]/10" />

          <div>
            <span className="block text-[10px] font-mono font-bold tracking-wider text-[#A39E93] uppercase">
              {mode === 'daily' ? `TARGET ${dailyTarget}` : 'REKOR'}
            </span>
            {mode === 'daily' ? (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm sm:text-base font-extrabold text-[#E9A825] tabular-nums leading-none">
                  {progressPct}%
                </span>
                <div className="w-14 sm:w-20 h-2 bg-[#141619] rounded-full overflow-hidden border border-[#F4F1EA]/10">
                  <div
                    className="h-full bg-[#E9A825] transition-transform duration-150 origin-left"
                    style={{ transform: `scaleX(${progressPct / 100})` }}
                  />
                </div>
              </div>
            ) : (
              <span
                data-testid="hud-best"
                className="text-lg sm:text-xl font-bold text-[#E9A825] tabular-nums leading-none"
              >
                {Math.round(bestScore)}
              </span>
            )}
          </div>

          {combo > 0 && (
            <>
              <div className="h-7 w-[1px] bg-[#F4F1EA]/10 hidden sm:block" />
              <div className="hidden sm:block">
                <span className="block text-[10px] font-mono font-bold tracking-wider text-[#2AB7CA] uppercase">
                  KOMBO
                </span>
                <span className="text-lg font-extrabold text-[#2AB7CA] tabular-nums leading-none">
                  {combo}x
                </span>
              </div>
            </>
          )}
        </div>

        {/* Right Cluster: Compact Tactile Square SVG Utility Buttons */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Hint [H] */}
          <button
            type="button"
            tabIndex={-1}
            aria-label="Petunjuk Langkah Terbaik"
            title="Petunjuk [H]"
            onClick={(e) => {
              e.currentTarget.blur();
              onHint();
            }}
            className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl bg-[#1B1F26] hover:bg-[#252B35] active:scale-95 border border-[#F4F1EA]/10 flex items-center justify-center transition-transform cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5">
              <circle cx="12" cy="12" r="10" fill="#141619" />
              <path
                d="M9.5 14.5C9.2 13.7 8.5 12.8 8.5 11C8.5 8.8 10.1 7 12 7C13.9 7 15.5 8.8 15.5 11C15.5 12.8 14.8 13.7 14.5 14.5M10 17.5H14"
                stroke="#E9A825"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </button>

          {/* Mute [M] */}
          <button
            type="button"
            tabIndex={-1}
            aria-label={muted ? 'Nyalakan Suara' : 'Matikan Suara'}
            title="Suara [M]"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl bg-[#1B1F26] hover:bg-[#252B35] active:scale-95 border border-[#F4F1EA]/10 flex items-center justify-center transition-transform cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5">
              <circle cx="12" cy="12" r="10" fill="#141619" />
              <path
                d="M7 10V14H10L14 17V7L10 10H7Z"
                fill={muted ? '#A39E93' : '#2AB7CA'}
              />
              {muted ? (
                <path
                  d="M16.5 9.5L19.5 14.5M19.5 9.5L16.5 14.5"
                  stroke="#E06D53"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M16.5 9.5C17.3 10.3 17.3 13.7 16.5 14.5"
                  stroke="#6CE0F0"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </button>

          {/* Restart [R] */}
          <button
            type="button"
            tabIndex={-1}
            aria-label="Ulangi Permainan"
            title="Ulangi [R]"
            onClick={(e) => {
              e.currentTarget.blur();
              onRestart();
            }}
            className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl bg-[#1B1F26] hover:bg-[#252B35] active:scale-95 border border-[#F4F1EA]/10 flex items-center justify-center transition-transform cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5">
              <circle cx="12" cy="12" r="10" fill="#141619" />
              <path
                d="M16.5 12A4.5 4.5 0 1 1 15 8.5M16.5 6.5V9.5H13.5"
                stroke="#F4F1EA"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* Pause [P / Esc] */}
          <button
            type="button"
            tabIndex={-1}
            aria-label="Jeda Permainan"
            title="Jeda [P / Esc]"
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl bg-[#1B1F26] hover:bg-[#252B35] active:scale-95 border border-[#F4F1EA]/10 flex items-center justify-center transition-transform cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5">
              <circle cx="12" cy="12" r="10" fill="#141619" />
              <rect x="9" y="8" width="2.4" height="8" rx="1" fill="#E06D53" />
              <rect x="12.6" y="8" width="2.4" height="8" rx="1" fill="#E06D53" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
