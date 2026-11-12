/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { BlockBlastCanvasEngine, HudSyncPayload } from './game/canvasEngine';
import { DAILY_TARGET_SCORE, GameMode } from './game/rules';
import { soundEngine } from './game/audio';
import { loadPlayerProgress } from './game/storage';
import { TitleScreen } from './components/TitleScreen';
import { GameHud } from './components/GameHud';
import { StatusModal } from './components/StatusModal';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<BlockBlastCanvasEngine | null>(null);

  const initialProgress = loadPlayerProgress();
  const [hud, setHud] = useState<HudSyncPayload>({
    state: 'title',
    mode: 'daily',
    score: 0,
    bestScore: initialProgress.dailyBest,
    combo: 0,
    maxCombo: 0,
    linesCleared: 0,
    streakCount: initialProgress.streakCount,
    dailyCompletedToday: false,
    dailyTarget: DAILY_TARGET_SCORE,
    traySummary: [],
    selectedTrayIndex: 0,
    snapshot: null,
  });

  const [muted, setMuted] = useState<boolean>(() => soundEngine.isMuted());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new BlockBlastCanvasEngine(canvas, (payload) => {
      setHud(payload);
      setMuted(soundEngine.isMuted());
    });
    engineRef.current = engine;

    // Support ?autostart=1 or ?gameover=1 query parameters
    const params = new URLSearchParams(window.location.search);
    if (params.get('gameover') === '1') {
      const requestedMode = params.get('mode') === 'classic' ? 'classic' : 'daily';
      engine.startGame(requestedMode);
      engine.triggerGameOverState(1353, 10, 2);
    } else if (params.get('autostart') === '1') {
      const requestedMode = params.get('mode') === 'classic' ? 'classic' : 'daily';
      engine.startGame(requestedMode);
    }

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const handleSelectMode = (mode: GameMode) => {
    engineRef.current?.setMode(mode);
  };

  const handleStart = () => {
    engineRef.current?.startGame();
  };

  const handleHint = () => {
    engineRef.current?.triggerHint();
  };

  const handleToggleMute = () => {
    const nextMuted = soundEngine.toggleMute();
    setMuted(nextMuted);
  };

  const handleRestart = () => {
    engineRef.current?.startGame();
  };

  const handlePause = () => {
    engineRef.current?.togglePause();
  };

  const handleReturnTitle = () => {
    engineRef.current?.returnToTitle();
  };

  const handleSelectTray = (index: number) => {
    engineRef.current?.selectTraySlot(index);
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#141619] select-none">
      {/* Isolated 60fps Canvas2D Container (Never re-mounted on React HUD updates) */}
      <div className="fixed inset-0 z-0">
        <canvas
          ref={canvasRef}
          tabIndex={0}
          data-testid="game-canvas"
          aria-label="Papan Permainan BlokBlast 8x8"
          className="block w-full h-full outline-none cursor-grab active:cursor-grabbing"
        />
      </div>

      {/* Title Screen Overlay */}
      {hud.state === 'title' && (
        <TitleScreen
          mode={hud.mode}
          bestScore={hud.bestScore}
          streakCount={hud.streakCount}
          dailyCompletedToday={hud.dailyCompletedToday}
          onSelectMode={handleSelectMode}
          onStart={handleStart}
        />
      )}

      {/* Active Playing / Paused / GameOver Perimeter HUD */}
      {hud.state !== 'title' && (
        <GameHud
          mode={hud.mode}
          score={hud.score}
          bestScore={hud.bestScore}
          combo={hud.combo}
          streakCount={hud.streakCount}
          dailyTarget={hud.dailyTarget}
          muted={muted}
          selectedTrayIndex={hud.selectedTrayIndex}
          traySummary={hud.traySummary}
          onSelectTray={handleSelectTray}
          onHint={handleHint}
          onToggleMute={handleToggleMute}
          onRestart={handleRestart}
          onPause={handlePause}
        />
      )}

      {/* Outcome & Pause Status Modals */}
      <StatusModal
        state={hud.state}
        mode={hud.mode}
        score={hud.score}
        bestScore={hud.bestScore}
        linesCleared={hud.linesCleared}
        maxCombo={hud.maxCombo}
        snapshot={hud.snapshot}
        onResume={handlePause}
        onRestart={handleRestart}
        onSwitchMode={(newMode) => engineRef.current?.startGame(newMode)}
        onReturnTitle={handleReturnTitle}
      />
    </main>
  );
}
