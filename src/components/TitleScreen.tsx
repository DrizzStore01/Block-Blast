import React, { useMemo } from 'react';
import {
  BLOCK_PALETTE,
  BOARD_SIZE,
  DAILY_TARGET_SCORE,
  GameMode,
  createDailyInitialBoard,
  getTodayDateKey,
} from '../game/rules';

interface TitleScreenProps {
  mode: GameMode;
  bestScore: number;
  streakCount: number;
  dailyCompletedToday: boolean;
  onSelectMode: (mode: GameMode) => void;
  onStart: () => void;
}

const INDONESIAN_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

function formatShortIndonesianDate(dateKey: string): string {
  const parts = dateKey.split('-');
  if (parts.length !== 3) return dateKey;
  const monthIdx = Math.max(0, Math.min(11, parseInt(parts[1], 10) - 1));
  const day = parts[2];
  return `${day} ${INDONESIAN_MONTHS[monthIdx]}`;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  mode,
  bestScore,
  streakCount,
  dailyCompletedToday,
  onSelectMode,
  onStart,
}) => {
  const todayStr = getTodayDateKey();
  const formattedDate = useMemo(() => formatShortIndonesianDate(todayStr), [todayStr]);
  const dailyPreviewBoard = useMemo(() => createDailyInitialBoard(todayStr), [todayStr]);

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-4 sm:p-8 lg:p-14">
      {/* Main Negative-Space Focal Lockup (Left Third on Desktop, Centered on Mobile) */}
      <div className="my-auto mx-auto lg:mx-0 max-w-[420px] w-full pointer-events-auto flex flex-col items-start gap-4 sm:gap-5 bg-[#171A20] p-5 sm:p-7 rounded-3xl border border-[#F4F1EA]/12 shadow-[0_24px_60px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(244,241,234,0.12)]">
        {/* Custom Inline SVG Title Lockup */}
        <div className="w-full">
          <svg
            viewBox="0 0 374 92"
            className="w-full h-auto overflow-visible"
            role="img"
            aria-label="BlokBlast Daily Tactile Puzzle"
          >
            {/* Architectural Isometric Ceramic Blocks Emblem */}
            <g transform="translate(2, 6)">
              {/* Terracotta Block */}
              <rect x="0" y="6" width="34" height="34" rx="7" fill="#A8442E" />
              <rect x="0" y="2" width="34" height="31" rx="7" fill="#E06D53" />
              <rect x="5" y="6" width="24" height="10" rx="4" fill="#F29680" opacity="0.6" />

              {/* Amber Gold Gem Block */}
              <rect x="38" y="6" width="34" height="34" rx="7" fill="#AD750B" />
              <rect x="38" y="2" width="34" height="31" rx="7" fill="#E9A825" />
              <polygon points="55,8 63,17 55,26 47,17" fill="#FFF3B0" />

              {/* Jade Teal Block */}
              <rect x="0" y="44" width="34" height="34" rx="7" fill="#177E8C" />
              <rect x="0" y="40" width="34" height="31" rx="7" fill="#2AB7CA" />
              <rect x="5" y="44" width="24" height="10" rx="4" fill="#6CE0F0" opacity="0.6" />

              {/* Sage Moss Corner */}
              <rect x="38" y="44" width="34" height="34" rx="7" fill="#2D7A56" />
              <rect x="38" y="40" width="34" height="31" rx="7" fill="#52B788" />
              <rect x="43" y="44" width="24" height="10" rx="4" fill="#8CE0B9" opacity="0.6" />
            </g>

            {/* Bespoke Display Typography Lockup */}
            <g transform="translate(86, 0)">
              <text
                x="0"
                y="42"
                fill="#F4F1EA"
                fontFamily="'Plus Jakarta Sans', sans-serif"
                fontWeight="800"
                fontSize="39"
                letterSpacing="-1.2"
              >
                BLOK
              </text>
              <text
                x="105"
                y="42"
                fill="#E06D53"
                fontFamily="'Plus Jakarta Sans', sans-serif"
                fontWeight="800"
                fontSize="39"
                letterSpacing="-1.2"
              >
                BLAST
              </text>
              <rect x="2" y="53" width="44" height="3" rx="1.5" fill="#E9A825" />
              <text
                x="54"
                y="58"
                fill="#A39E93"
                fontFamily="'JetBrains Mono', monospace"
                fontWeight="700"
                fontSize="10.5"
                letterSpacing="2.1"
              >
                EDISI HARIAN · 8×8
              </text>
              <text
                x="2"
                y="79"
                fill="#D6D1C7"
                fontFamily="'Plus Jakarta Sans', sans-serif"
                fontWeight="600"
                fontSize="12"
              >
                Susun keramik, hancurkan garis &amp; jaga streak.
              </text>
            </g>
          </svg>
        </div>

        {/* Balanced 3-Column Unboxed Tactile Telemetry Strip */}
        <div className="w-full grid grid-cols-3 divide-x divide-[#F4F1EA]/10 py-3 border-y border-[#F4F1EA]/10">
          <div className="pr-2 flex flex-col justify-between">
            <span className="text-[10px] font-mono tracking-wider text-[#A39E93] whitespace-nowrap">
              STREAK HARIAN
            </span>
            <div className="mt-1 flex items-center gap-1.5">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 2C12 2 7 7.5 7 13C7 16.3137 9.46243 19 12.5 19C15.5376 19 18 16.3137 18 13C18 10.5 16.5 8 15 6.5C15 9 13.5 10.5 12 10.5C13 7.5 12 2 12 2Z"
                  fill="#E9A825"
                />
              </svg>
              <span className="text-base sm:text-lg font-extrabold text-[#E9A825] tabular-nums whitespace-nowrap">
                {streakCount} Hari
              </span>
            </div>
          </div>

          <div className="px-3 flex flex-col justify-between">
            <span className="text-[10px] font-mono tracking-wider text-[#A39E93] whitespace-nowrap">
              REKOR TERBAIK
            </span>
            <div className="mt-1 flex items-center gap-1.5">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M6 4H18V8C18 11.3137 15.3137 14 12 14C8.68629 14 6 11.3137 6 8V4ZM9 18H15M12 14V18"
                  stroke="#F4F1EA"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-base sm:text-lg font-extrabold text-[#F4F1EA] tabular-nums whitespace-nowrap">
                {Math.round(bestScore)}
              </span>
            </div>
          </div>

          <div className="pl-3 flex flex-col justify-between text-right">
            <span className="text-[10px] font-mono tracking-wider text-[#A39E93] whitespace-nowrap">
              {mode === 'daily' ? 'EDISI HARIAN' : 'TARGET HARIAN'}
            </span>
            <div className="mt-1 flex items-center justify-end gap-1.5">
              <span className="text-base sm:text-lg font-mono font-extrabold text-[#2AB7CA] tabular-nums whitespace-nowrap">
                {mode === 'daily' ? formattedDate : `${DAILY_TARGET_SCORE}`}
              </span>
            </div>
          </div>
        </div>

        {/* Interactive Mode Switcher (2 functional buttons) */}
        <div
          className="w-full grid grid-cols-2 gap-2 p-1.5 bg-[#111318] rounded-2xl border border-[#F4F1EA]/8"
          role="group"
          aria-label="Pilih Mode Permainan"
        >
          <button
            type="button"
            onClick={() => onSelectMode('daily')}
            className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.98] whitespace-nowrap shrink-0 flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'daily'
                ? 'bg-[#242933] text-[#F4F1EA] shadow-[0_2px_10px_rgba(0,0,0,0.4)] border border-[#E9A825]/45'
                : 'text-[#A39E93] hover:text-[#F4F1EA]'
            }`}
          >
            <span>Tantangan Harian</span>
            {dailyCompletedToday && (
              <span className="text-[#52B788] font-mono text-[11px]" title="Selesai Hari Ini">
                ✓
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => onSelectMode('classic')}
            className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.98] whitespace-nowrap shrink-0 flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'classic'
                ? 'bg-[#242933] text-[#F4F1EA] shadow-[0_2px_10px_rgba(0,0,0,0.4)] border border-[#2AB7CA]/45'
                : 'text-[#A39E93] hover:text-[#F4F1EA]'
            }`}
          >
            <span>Mode Klasik</span>
          </button>
        </div>

        {/* Live Mode Preview Diorama + Unboxed Context */}
        <div className="w-full flex items-center gap-3 py-1">
          {/* Mini 8x8 Tactile Board SVG Preview */}
          <svg
            viewBox="0 0 88 88"
            className="w-[72px] h-[72px] sm:w-[78px] sm:h-[78px] shrink-0 overflow-visible"
            aria-hidden="true"
          >
            <rect
              x="0"
              y="0"
              width="88"
              height="88"
              rx="12"
              fill="#111318"
              stroke="rgba(244,241,234,0.1)"
              strokeWidth="1.5"
            />
            {Array.from({ length: BOARD_SIZE }).map((_, r) =>
              Array.from({ length: BOARD_SIZE }).map((__, c) => {
                const x = 6 + c * 9.5;
                const y = 6 + r * 9.5;
                if (mode === 'daily') {
                  const cell = dailyPreviewBoard[r][c];
                  if (!cell.filled) {
                    return (
                      <rect
                        key={`${r}-${c}`}
                        x={x}
                        y={y}
                        width="8"
                        height="8"
                        rx="2"
                        fill="#1D212A"
                      />
                    );
                  }
                  if (cell.hazard === 'stone') {
                    return (
                      <g key={`${r}-${c}`}>
                        <rect x={x} y={y} width="8" height="8" rx="2" fill="#6C7582" />
                        <rect x={x + 1} y={y + 1} width="6" height="3" rx="1" fill="#99A2B0" />
                      </g>
                    );
                  }
                  const pal = BLOCK_PALETTE[cell.colorId] || BLOCK_PALETTE[2];
                  return (
                    <g key={`${r}-${c}`}>
                      <rect x={x} y={y} width="8" height="8" rx="2" fill={pal.main} />
                      {cell.hazard === 'gem' && (
                        <polygon
                          points={`${x + 4},${y + 1.2} ${x + 6.8},${y + 4} ${x + 4},${y + 6.8} ${x + 1.2},${y + 4}`}
                          fill="#FFF3B0"
                        />
                      )}
                    </g>
                  );
                } else {
                  // Classic Mode Preview: Dynamic intersecting row & column blast highlight
                  const isBlastLine = r === 3 || c === 4;
                  const isCornerBlock = (r >= 5 && c <= 2 && r + c <= 7) || (r <= 1 && c >= 6);
                  const fill = isBlastLine
                    ? '#2AB7CA'
                    : isCornerBlock
                    ? '#E06D53'
                    : '#1D212A';
                  return (
                    <rect
                      key={`${r}-${c}`}
                      x={x}
                      y={y}
                      width="8"
                      height="8"
                      rx="2"
                      fill={fill}
                      opacity={isBlastLine ? 0.95 : 1}
                    />
                  );
                }
              })
            )}
          </svg>

          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold tracking-wide text-[#F4F1EA] whitespace-nowrap">
              <span className={mode === 'daily' ? 'text-[#E9A825]' : 'text-[#2AB7CA]'}>
                {mode === 'daily' ? 'PAPAN SIMETRIS HARI INI' : 'ARENA KLASIK TANPA BATAS'}
              </span>
            </div>
            <p className="text-xs text-[#D6D1C7]/90 leading-snug">
              {mode === 'daily'
                ? 'Hancurkan Blok Batu 2× & Permata Emas (+45). Capai 1.200 poin untuk target harian.'
                : 'Susun blok tanpa batas waktu. Rangkai kombo garis beruntun & pecahkan rekor.'}
            </p>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#A39E93] whitespace-nowrap">
              {mode === 'daily' ? (
                <>
                  <span className="text-[#99A2B0]">■ Batu 2×</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#E9A825]">◆ Permata +45</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#52B788]">★ 1.200</span>
                </>
              ) : (
                <>
                  <span className="text-[#2AB7CA]">■ Kombo 2×–5×</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#E06D53]">◆ Multi-Garis</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Primary Tactile Keycap Start CTA */}
        <button
          type="button"
          data-start="true"
          onClick={onStart}
          className="w-full min-h-[52px] py-3.5 px-6 rounded-2xl bg-[#E06D53] hover:bg-[#eb795f] active:translate-y-[2px] text-[#141619] font-extrabold text-base tracking-tight transition-all shadow-[0_4px_0_#9E3E29,0_10px_24px_rgba(224,109,83,0.28)] active:shadow-[0_2px_0_#9E3E29] flex items-center justify-center gap-3 cursor-pointer whitespace-nowrap shrink-0"
        >
          <span>Mulai Bermain</span>
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M5 12H19M19 12L13 6M19 12L13 18"
              stroke="#141619"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Subtle Footer Attribution inside Main Menu */}
        <p className="w-full text-center text-[10px] font-mono font-semibold tracking-[0.16em] text-[#A39E93]/70 pt-0.5 whitespace-nowrap">
          POWERD BY SANN404 FORUM GROUP
        </p>
      </div>

      {/* Bottom Safe Margin: Single Flat Borderless Control-Hint Line */}
      <div className="w-full text-center lg:text-left pointer-events-none">
        <p className="sm:hidden text-[11px] font-mono text-[#A39E93]/85 tracking-wide whitespace-nowrap truncate">
          Sentuh &amp; Geser Blok · Ketuk Papan untuk Pasang Cepat
        </p>
        <p className="hidden sm:block text-xs font-mono text-[#A39E93]/80 tracking-wide whitespace-nowrap truncate">
          Sentuh &amp; Geser Blok · 1-3 Pilih · WASD Arahkan · Space Pasang · H Petunjuk · Esc Jeda
        </p>
      </div>
    </div>
  );
};
