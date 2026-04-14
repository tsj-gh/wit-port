"use client";

import { useEffect, useRef, useState } from "react";
import { PairLinkAdSlot } from "@/components/PairLinkAdSlots";
import { GamePageHeader } from "@/components/GamePageHeader";
import {
  GAME_AD_GAP_BEFORE_SLOT_2_PX,
  GAME_AD_SLOT_MIN_HEIGHT_PX,
  GAME_COLUMN_CLASS,
} from "@/lib/gameLayout";
import { PopPopBubblesScene } from "@/lib/pop-pop-bubbles/PopPopBubblesScene";

const ANIMAL_PATHS = [
  "/assets/tap-coloring/Pictures/Picture_Animal_01.png",
  "/assets/tap-coloring/Pictures/Picture_Animal_02.png",
  "/assets/tap-coloring/Pictures/Picture_Animal_03.png",
  "/assets/tap-coloring/Pictures/Picture_Animal_04.png",
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${src}`));
    img.src = src;
  });
}

function playFallbackPop(audioCtxRef: { current: AudioContext | null }): void {
  if (typeof window === "undefined") return;
  const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  const ctx = audioCtxRef.current ?? new Ctx();
  audioCtxRef.current = ctx;

  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(740, t0);
  osc.frequency.exponentialRampToValueAtTime(220, t0 + 0.09);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.13);
}

export function PopPopBubblesLabShell() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<PopPopBubblesScene | null>(null);
  const popAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [collisionCount, setCollisionCount] = useState(0);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [isDebugPanelExpanded, setIsDebugPanelExpanded] = useState(true);
  const [bubbleCount, setBubbleCount] = useState(4);
  const [bubbleSpeedScale, setBubbleSpeedScale] = useState(1);
  const [animalFallGravity, setAnimalFallGravity] = useState(180);

  useEffect(() => {
    let disposed = false;
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    let ro: ResizeObserver | null = null;
    let onPointerDown: ((event: PointerEvent) => void) | null = null;

    popAudioRef.current = new Audio("/assets/pop-pop-bubbles/pop_se.mp3");
    popAudioRef.current.preload = "auto";
    popAudioRef.current.volume = 0.42;

    Promise.all(ANIMAL_PATHS.map((src) => loadImage(src)))
      .then((animalImages) => {
        if (disposed) return;
        const playPop = () => {
          const base = popAudioRef.current;
          if (base?.src) {
            const clone = base.cloneNode(true) as HTMLAudioElement;
            clone.volume = base.volume;
            clone.play().catch(() => playFallbackPop(audioCtxRef));
            return;
          }
          playFallbackPop(audioCtxRef);
        };

        const scene = new PopPopBubblesScene({
          canvas,
          animalImages,
          onPlayPop: playPop,
          onBubbleCollision: () => setCollisionCount((n) => n + 1),
        });
        sceneRef.current = scene;
        scene.setDebugConfig({ bubbleCount, bubbleSpeedScale, animalFallGravity });

        const resize = () => {
          const rect = stage.getBoundingClientRect();
          scene.resize(rect.width, rect.height);
        };
        resize();

        ro = new ResizeObserver(resize);
        ro.observe(stage);
        scene.start();
        setIsReady(true);

        onPointerDown = (event: PointerEvent) => {
          scene.handlePointerDown(event.clientX, event.clientY);
        };
        canvas.addEventListener("pointerdown", onPointerDown, { passive: true });
      })
      .catch(() => {
        if (!disposed) setIsReady(false);
      });

    return () => {
      disposed = true;
      if (onPointerDown) canvas.removeEventListener("pointerdown", onPointerDown);
      ro?.disconnect();
      sceneRef.current?.destroy();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setDebugConfig({ bubbleSpeedScale, animalFallGravity });
  }, [bubbleSpeedScale, animalFallGravity]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.setDebugConfig({ bubbleCount });
    scene.respawnWaveNow();
  }, [bubbleCount]);

  return (
    <div className={GAME_COLUMN_CLASS}>
      {!isDebugMode && (
        <div className="fixed right-4 top-4 z-50">
          <button
            type="button"
            onClick={() => setIsDebugMode(true)}
            className="rounded border border-[color-mix(in_srgb,var(--color-text)_22%,transparent)] bg-[color-mix(in_srgb,var(--color-surface)_84%,var(--color-bg))] px-2 py-1 font-mono text-xs text-[var(--color-text)] shadow-sm"
          >
            DEBUG OFF
          </button>
        </div>
      )}
      {isDebugMode && (
        <div className="fixed right-4 top-4 z-50 max-h-[90vh] w-[min(92vw,300px)] overflow-y-auto rounded-2xl border border-[color-mix(in_srgb,var(--color-text)_18%,transparent)] bg-[color-mix(in_srgb,var(--color-surface)_90%,var(--color-bg))] p-3 text-left text-xs text-[var(--color-text)] shadow-lg backdrop-blur">
          <div className="mb-2 flex items-center justify-between gap-2">
            {isDebugPanelExpanded && <span className="font-bold text-[var(--color-primary)]">はじけて！バブル DEBUG</span>}
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsDebugMode(false)}
                className="rounded border border-[color-mix(in_srgb,var(--color-text)_22%,transparent)] bg-[var(--color-primary)] px-2 py-1 text-[10px] font-semibold text-[var(--color-on-primary)]"
              >
                DEBUG ON
              </button>
              <button
                type="button"
                onClick={() => setIsDebugPanelExpanded((v) => !v)}
                className="rounded border border-[color-mix(in_srgb,var(--color-text)_20%,transparent)] p-1 text-[var(--color-muted)]"
                aria-expanded={isDebugPanelExpanded}
              >
                {isDebugPanelExpanded ? "▲" : "▼"}
              </button>
            </div>
          </div>
          {isDebugPanelExpanded && (
            <div className="space-y-3 text-[10px] text-[var(--color-muted)]">
              <label className="block">
                <div className="mb-1 font-semibold text-[var(--color-text)]">バブル数</div>
                <input
                  type="range"
                  min={1}
                  max={8}
                  step={1}
                  value={bubbleCount}
                  onChange={(e) => setBubbleCount(Number(e.target.value))}
                  className="w-full accent-[var(--color-primary)]"
                />
                <div className="tabular-nums">{bubbleCount}</div>
              </label>
              <label className="block">
                <div className="mb-1 font-semibold text-[var(--color-text)]">バブル速度倍率</div>
                <input
                  type="range"
                  min={0.3}
                  max={3}
                  step={0.1}
                  value={bubbleSpeedScale}
                  onChange={(e) => setBubbleSpeedScale(Number(e.target.value))}
                  className="w-full accent-[var(--color-primary)]"
                />
                <div className="tabular-nums">{bubbleSpeedScale.toFixed(1)}x</div>
              </label>
              <label className="block">
                <div className="mb-1 font-semibold text-[var(--color-text)]">内容物の落下速度（重力）</div>
                <input
                  type="range"
                  min={40}
                  max={520}
                  step={10}
                  value={animalFallGravity}
                  onChange={(e) => setAnimalFallGravity(Number(e.target.value))}
                  className="w-full accent-[var(--color-primary)]"
                />
                <div className="tabular-nums">{animalFallGravity.toFixed(0)}</div>
              </label>
            </div>
          )}
        </div>
      )}
      <GamePageHeader titleEn="Pop-Pop Bubbles" titleJa="はじけて！バブル" />
      <div className="hidden" aria-hidden>
        <PairLinkAdSlot slotIndex={1} />
      </div>
      <section className="relative z-[1] mb-4 w-full rounded-2xl border border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_5%,transparent)] px-4 pb-4 pt-4 backdrop-blur sm:px-5 sm:pb-5 sm:pt-4">
        <div className="mb-2 flex items-center justify-between text-xs text-[var(--color-muted)]">
          <span>タップでバブルをはじこう</span>
          <span className="tabular-nums">衝突検知: {collisionCount}</span>
        </div>
        <div
          ref={stageRef}
          className="relative mx-auto h-[min(70vw,460px)] min-h-[320px] w-full max-w-[460px] overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--color-text)_12%,transparent)] bg-[radial-gradient(circle_at_20%_18%,color-mix(in_srgb,var(--color-primary)_14%,transparent),transparent_52%),linear-gradient(180deg,color-mix(in_srgb,var(--color-bg)_92%,white_8%),color-mix(in_srgb,var(--color-bg)_98%,transparent))]"
        >
          <canvas ref={canvasRef} className="h-full w-full touch-none" />
          {!isReady && (
            <div className="absolute inset-0 grid place-items-center text-sm text-[var(--color-muted)]">読み込み中…</div>
          )}
        </div>
      </section>
      <div
        className="relative z-0 w-full"
        style={{ minHeight: GAME_AD_SLOT_MIN_HEIGHT_PX, marginTop: GAME_AD_GAP_BEFORE_SLOT_2_PX }}
      >
        <PairLinkAdSlot slotIndex={2} />
      </div>
    </div>
  );
}
