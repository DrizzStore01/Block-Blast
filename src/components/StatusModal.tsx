import React, { useEffect, useState } from 'react';
import { GameLifecycleState, GameMode, RunSnapshot } from '../game/rules';
import { GameOverThreeStage } from './GameOverThreeStage';

interface StatusModalProps {
  state: GameLifecycleState;
  mode: GameMode;
  score: number;
  bestScore: number;
  linesCleared: number;
  maxCombo: number;
  snapshot: RunSnapshot | null;
  onResume: () => void;
  onRestart: () => void;
  onSwitchMode: (mode: GameMode) => void;
  onReturnTitle: () => void;
}

export const StatusModal: React.FC<StatusModalProps> = ({
  state,
  mode,
  score,
  bestScore,
  linesCleared,
  maxCombo,
  snapshot,
  onResume,
  onRestart,
  onSwitchMode,
  onReturnTitle,
}) => {
  const isPaused = state === 'paused';
  const isVictory = !isPaused && Boolean(snapshot?.isVictory);

  const finalScore = isPaused ? score : snapshot?.score ?? score;
  const finalBest = isPaused ? bestScore : snapshot?.bestScore ?? bestScore;
  const finalLines = isPaused ? linesCleared : snapshot?.linesCleared ?? linesCleared;
  const finalCombo = isPaused ? maxCombo : snapshot?.maxCombo ?? maxCombo;
  const isNewRecord = !isPaused && finalScore > 0 && finalScore >= finalBest;

  // Smooth animated count-up for Game Over score readout
  const [animatedScore, setAnimatedScore] = useState(finalScore);

  useEffect(() => {
    if (state !== 'gameover') {
      setAnimatedScore(finalScore);
      return;
    }

    const isHeadless =
      typeof navigator !== 'undefined' &&
      Boolean(navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));
    if (isHeadless || finalScore === 0) {
      setAnimatedScore(finalScore);
      return;
    }

    let raf = 0;
    const duration = 650;
    const start = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimatedScore(Math.round(finalScore * eased));
      if (t < 1) {
        raf = requestAnimationFrame(step);
      }
    };

    setAnimatedScore(0);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [state, finalScore]);

  if (state !== 'paused' && state !== 'gameover') {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-30 bg-[#0D0F12]/88 flex items-center justify-center p-4 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-status-title"
    >
      <div className="w-full max-w-md bg-[#1B1F26] border border-[#F4F1EA]/12 rounded-2xl p-5 sm:p-7 shadow-2xl flex flex-col gap-5">
        {/* Live Interactive Three.js 3D Stage on Game Over / Victory */}
        {!isPaused && (
          <GameOverThreeStage
            isVictory={isVictory}
            score={finalScore}
            linesCleared={finalLines}
            maxCombo={finalCombo}
          />
        )}

        {/* Header Status Lockup */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold tracking-wider uppercase text-[#A39E93] whitespace-nowrap overflow-hidden">
              <span className="truncate">
                {isPaused
                  ? 'PERMAINAN DIJEDA'
                  : isVictory
                  ? 'TARGET HARIAN TERCAPAI'
                  : 'TIDAK ADA RUANG'}
              </span>
              {isNewRecord && (
                <>
                  <span aria-hidden="true" className="shrink-0">·</span>
                  <span className="text-[#E9A825] shrink-0">REKOR BARU</span>
                </>
              )}
            </div>
            <h2
              id="modal-status-title"
              className="text-2xl sm:text-3xl font-extrabold text-[#F4F1EA] mt-1 tracking-tight text-balance"
            >
              {isPaused
                ? 'Istirahat Sejenak'
                : isVictory
                ? 'Tantangan Selesai!'
                : 'Permainan Berakhir'}
            </h2>
          </div>

          {/* Diegetic Status Emblem */}
          <div className="w-11 h-11 rounded-xl bg-[#141619] border border-[#F4F1EA]/10 flex items-center justify-center shrink-0">
            {isPaused ? (
              <svg viewBox="0 0 24 24" className="w-6 h-6">
                <rect x="7" y="6" width="3.5" height="12" rx="1" fill="#E9A825" />
                <rect x="13.5" y="6" width="3.5" height="12" rx="1" fill="#E9A825" />
              </svg>
            ) : isVictory ? (
              <svg viewBox="0 0 24 24" className="w-6 h-6">
                <polygon points="12,3 20,12 12,21 4,12" fill="#E9A825" />
                <path
                  d="M9 12.2L11 14.2L15.2 10"
                  stroke="#141619"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-6 h-6">
                <rect x="5" y="5" width="14" height="14" rx="3" fill="#E06D53" />
                <path
                  d="M9 9L15 15M15 9L9 15"
                  stroke="#141619"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </div>
        </div>

        {/* 3 Tabular-Nums Stat Tiles */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 py-3.5 border-y border-[#F4F1EA]/10">
          <div>
            <span className="block text-[10px] font-mono tracking-wider text-[#A39E93] uppercase">
              SKOR AKHIR
            </span>
            <span
              data-testid="modal-final-score"
              className="text-2xl font-extrabold text-[#F4F1EA] tabular-nums"
            >
              {Math.round(animatedScore)}
            </span>
          </div>

          <div>
            <span className="block text-[10px] font-mono tracking-wider text-[#A39E93] uppercase">
              REKOR TERBAIK
            </span>
            <span className="text-2xl font-extrabold text-[#E9A825] tabular-nums">
              {Math.round(finalBest)}
            </span>
          </div>

          <div>
            <span className="block text-[10px] font-mono tracking-wider text-[#A39E93] uppercase">
              GARIS · KOMBO
            </span>
            <span className="text-xl font-extrabold text-[#2AB7CA] tabular-nums">
              {Math.round(finalLines)} · {Math.round(finalCombo)}x
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5">
          {isPaused ? (
            <>
              <button
                type="button"
                onClick={onResume}
                className="w-full min-h-[48px] py-3 px-5 rounded-xl bg-[#E06D53] hover:bg-[#eb795f] active:scale-[0.98] text-[#141619] font-extrabold text-sm transition-transform cursor-pointer whitespace-nowrap shrink-0"
              >
                Lanjutkan Permainan
              </button>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={onRestart}
                  className="min-h-[44px] py-2.5 px-3 rounded-xl bg-[#252B35] hover:bg-[#2F3642] text-[#F4F1EA] font-bold text-xs transition-colors cursor-pointer whitespace-nowrap truncate"
                >
                  Ulangi Dari Awal
                </button>
                <button
                  type="button"
                  onClick={onReturnTitle}
                  className="min-h-[44px] py-2.5 px-3 rounded-xl bg-[#252B35] hover:bg-[#2F3642] text-[#A39E93] hover:text-[#F4F1EA] font-bold text-xs transition-colors cursor-pointer whitespace-nowrap truncate"
                >
                  Menu Utama
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                data-start="true"
                onClick={onRestart}
                className="w-full min-h-[48px] py-3 px-5 rounded-xl bg-[#E06D53] hover:bg-[#eb795f] active:scale-[0.98] text-[#141619] font-extrabold text-sm transition-transform cursor-pointer whitespace-nowrap shrink-0"
              >
                {isVictory ? 'Main Lagi Tantangan Ini' : 'Coba Lagi'}
              </button>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => onSwitchMode(mode === 'daily' ? 'classic' : 'daily')}
                  className="min-h-[44px] py-2.5 px-2.5 rounded-xl bg-[#252B35] hover:bg-[#2F3642] text-[#F4F1EA] font-bold text-xs transition-colors cursor-pointer whitespace-nowrap truncate"
                >
                  {mode === 'daily' ? 'Mode Klasik' : 'Tantangan Harian'}
                </button>
                <button
                  type="button"
                  onClick={onReturnTitle}
                  className="min-h-[44px] py-2.5 px-2.5 rounded-xl bg-[#252B35] hover:bg-[#2F3642] text-[#A39E93] hover:text-[#F4F1EA] font-bold text-xs transition-colors cursor-pointer whitespace-nowrap truncate"
                >
                  Menu Utama
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
