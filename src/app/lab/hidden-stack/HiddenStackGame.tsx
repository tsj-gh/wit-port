"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { GamePageHeader } from "@/components/GamePageHeader";
import { DevDebugUserStats } from "@/components/DevDebugUserStats";
import { GAME_COLUMN_CLASS } from "@/lib/gameLayout";
import { generateHiddenStackPuzzle } from "@/lib/hidden-stack/hiddenStackPuzzle";
import { useI18n } from "@/lib/i18n-context";
import type { BlockMaterialVariant, CollapsePatternId } from "./HiddenStackCanvas";

const HiddenStackCanvas = dynamic(() => import("./HiddenStackCanvas"), { ssr: false });

const ICON_SLOTS = 10;
const TWIST_MAX = 15;

type Phase = "intro" | "think" | "feedback";

export default function HiddenStackGame() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const isDevTj = searchParams.get("devtj") === "true";
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [isDebugPanelExpanded, setIsDebugPanelExpanded] = useState(true);
  const [gridSize, setGridSize] = useState(3);

  const [materialVariant, setMaterialVariant] = useState<BlockMaterialVariant>("A");
  const [collapsePattern, setCollapsePattern] = useState<CollapsePatternId>(1);

  const [puzzle, setPuzzle] = useState(() => generateHiddenStackPuzzle(`${Date.now()}`, { gridSize: 3 }));
  const [phase, setPhase] = useState<Phase>("intro");
  const [twistDeg, setTwistDeg] = useState(0);
  const [selectedN, setSelectedN] = useState(4);
  const [feedbackKey, setFeedbackKey] = useState(0);
  const [resultLine, setResultLine] = useState<string | null>(null);

  const dragTwistRef = useRef<{ active: boolean; lastX: number }>({ active: false, lastX: 0 });
  const stripRef = useRef<HTMLDivElement>(null);
  const stripPointerDownRef = useRef(false);

  useEffect(() => {
    stripPointerDownRef.current = false;
  }, [phase]);

  const answerSlots = useMemo(() => {
    return Math.max(ICON_SLOTS, Math.min(24, puzzle.hiddenCount + 4));
  }, [puzzle.hiddenCount]);

  const newRound = useCallback((nextGridSize?: number) => {
    const g = nextGridSize ?? gridSize;
    const next = generateHiddenStackPuzzle(`${Date.now()}:${Math.random().toString(36).slice(2)}`, { gridSize: g });
    setPuzzle(next);
    if (nextGridSize != null) setGridSize(g);
    setPhase("intro");
    setTwistDeg(0);
    setSelectedN(Math.max(1, Math.min(answerSlots, Math.floor((next.hiddenCount + 1) / 2))));
    setResultLine(null);
    setFeedbackKey((k) => k + 1);
  }, [answerSlots, gridSize]);

  useEffect(() => {
    setSelectedN((n) => Math.max(1, Math.min(answerSlots, n)));
  }, [answerSlots]);

  const onIntroComplete = useCallback(() => {
    setPhase("think");
  }, []);

  const submitAnswer = useCallback(() => {
    if (phase !== "think") return;
    const ok = selectedN === puzzle.hiddenCount;
    const key = ok ? "games.hiddenStack.resultCorrect" : "games.hiddenStack.resultWrong";
    setResultLine(t(key).replace("{n}", String(puzzle.hiddenCount)));
    setPhase("feedback");
    setFeedbackKey((k) => k + 1);
  }, [phase, selectedN, puzzle.hiddenCount, t]);

  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (phase !== "think") return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragTwistRef.current = { active: true, lastX: e.clientX };
  };

  const onCanvasPointerMove = (e: React.PointerEvent) => {
    if (!dragTwistRef.current.active || phase !== "think") return;
    const dx = e.clientX - dragTwistRef.current.lastX;
    dragTwistRef.current.lastX = e.clientX;
    setTwistDeg((deg) => Math.min(TWIST_MAX, Math.max(-TWIST_MAX, deg + dx * 0.12)));
  };

  const onCanvasPointerUp = (e: React.PointerEvent) => {
    dragTwistRef.current.active = false;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const pickNFromClientX = useCallback(
    (clientX: number) => {
      const el = stripRef.current;
      if (!el || phase !== "think") return;
      const r = el.getBoundingClientRect();
      if (r.width <= 1) return;
      const x = clientX - r.left;
      const slotW = r.width / answerSlots;
      let i = Math.floor(x / slotW);
      i = Math.max(0, Math.min(answerSlots - 1, i));
      setSelectedN(i + 1);
    },
    [answerSlots, phase]
  );

  const onStripPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (phase !== "think") return;
    stripPointerDownRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    pickNFromClientX(e.clientX);
  };

  const onStripPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!stripPointerDownRef.current || phase !== "think") return;
    pickNFromClientX(e.clientX);
  };

  const onStripPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    stripPointerDownRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={`relative isolate flex min-h-0 w-full flex-1 flex-col ${GAME_COLUMN_CLASS}`}>
      {isDevTj && !isDebugMode && (
        <div className="fixed right-4 top-24 z-50">
          <button
            type="button"
            onClick={() => setIsDebugMode(true)}
            className="rounded border border-[color-mix(in_srgb,var(--color-text)_20%,transparent)] bg-[color-mix(in_srgb,var(--color-surface)_55%,var(--color-bg))] px-2 py-1 font-mono text-xs text-[var(--color-text)]"
          >
            DEBUG OFF
          </button>
        </div>
      )}
      {isDevTj && isDebugMode && (
        <div className="fixed right-4 top-24 z-50 max-h-[88vh] w-[min(100vw-2rem,280px)] overflow-y-auto rounded-2xl border border-[color-mix(in_srgb,var(--color-text)_16%,transparent)] bg-[color-mix(in_srgb,var(--color-surface)_92%,var(--color-bg))] p-3 text-left text-xs font-mono text-[var(--color-text)] shadow-lg backdrop-blur-md">
          <div className="mb-2 flex items-center justify-between gap-2">
            {isDebugPanelExpanded && <span className="font-bold text-[var(--color-primary)]">{t("games.hiddenStack.debugPanel")}</span>}
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsDebugMode(false)}
                className="rounded border border-[color-mix(in_srgb,var(--color-text)_20%,transparent)] bg-[var(--color-primary)] px-2 py-1 text-[var(--color-on-primary)]"
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
            <div className="space-y-3 text-[10px] text-[var(--color-muted)]/95">
              <DevDebugUserStats />
              <div>
                <div className="mb-1 font-semibold text-[var(--color-text)]">{t("games.hiddenStack.debugMaterial")}</div>
                <div className="flex flex-wrap gap-1">
                  {(["A", "B", "C"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setMaterialVariant(v)}
                      className={`rounded px-2 py-0.5 text-[10px] border ${
                        materialVariant === v
                          ? "border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_18%,var(--color-bg))] text-[var(--color-primary)]"
                          : "border-[color-mix(in_srgb,var(--color-text)_18%,transparent)]"
                      }`}
                    >
                      {v === "A" ? t("games.hiddenStack.matA") : v === "B" ? t("games.hiddenStack.matB") : t("games.hiddenStack.matC")}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1 font-semibold text-[var(--color-text)]">{t("games.hiddenStack.debugCollapse")}</div>
                <div className="flex flex-wrap gap-1">
                  {([1, 2, 3] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCollapsePattern(p)}
                      className={`rounded px-2 py-0.5 text-[10px] border ${
                        collapsePattern === p
                          ? "border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_18%,var(--color-bg))] text-[var(--color-primary)]"
                          : "border-[color-mix(in_srgb,var(--color-text)_18%,transparent)]"
                      }`}
                    >
                      {p === 1 ? t("games.hiddenStack.pat1") : p === 2 ? t("games.hiddenStack.pat2") : t("games.hiddenStack.pat3")}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1 font-semibold text-[var(--color-text)]">
                  {t("games.hiddenStack.debugGridSize")}: <span className="tabular-nums">{gridSize}</span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={6}
                  step={1}
                  value={gridSize}
                  onChange={(e) => {
                    const g = Number(e.target.value);
                    if (!Number.isFinite(g)) return;
                    newRound(Math.max(3, Math.min(6, Math.floor(g))));
                  }}
                  className="w-full accent-[var(--color-primary)]"
                />
              </div>
              <div className="rounded border border-[color-mix(in_srgb,var(--color-text)_12%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_05%,var(--color-bg))] px-2 py-1.5 text-[var(--color-text)]">
                {t("games.hiddenStack.debugHiddenLabel")}: <span className="font-bold tabular-nums text-[var(--color-primary)]">{puzzle.hiddenCount}</span>
              </div>
              <button
                type="button"
                onClick={() => newRound()}
                className="w-full rounded border border-[color-mix(in_srgb,var(--color-primary)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_12%,var(--color-bg))] py-1.5 text-[11px] text-[var(--color-primary)]"
              >
                {t("games.hiddenStack.debugNewRound")}
              </button>
            </div>
          )}
        </div>
      )}

      <GamePageHeader titleEn="Hidden Stack" titleJa={t("games.hiddenStack.titleJa")} />

      <div className="relative min-h-0 w-full flex-1">
        <div
          className="absolute inset-0 overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] bg-[var(--color-surface)] shadow-inner"
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
          onPointerCancel={onCanvasPointerUp}
          onPointerLeave={onCanvasPointerUp}
        >
          <HiddenStackCanvas
            phase={phase}
            puzzle={puzzle}
            twistDeg={twistDeg}
            materialVariant={materialVariant}
            collapsePattern={collapsePattern}
            onIntroComplete={onIntroComplete}
            feedbackKey={feedbackKey}
          />
          {phase === "feedback" && resultLine && (
            <div className="pointer-events-none absolute inset-x-0 top-6 z-10 flex justify-center px-3">
              <p className="max-w-[min(100%,420px)] rounded-2xl border border-[color-mix(in_srgb,var(--color-primary)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-surface)_92%,transparent)] px-5 py-4 text-center text-xl font-black leading-snug text-[var(--color-text)] shadow-lg sm:text-2xl">
                {resultLine}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="z-40 mt-auto shrink-0 border-t border-[color-mix(in_srgb,var(--color-text)_12%,transparent)] bg-[color-mix(in_srgb,var(--color-surface)_96%,var(--color-bg))] px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-2 backdrop-blur-md">
        <div className={`${GAME_COLUMN_CLASS} mx-auto flex max-w-[520px] flex-col gap-2`}>
          <div className="relative flex min-h-[54px] items-center justify-center sm:min-h-[62px]">
            <span className="pointer-events-none select-none text-5xl font-black tabular-nums text-[var(--color-primary)] opacity-[0.22] sm:text-6xl">
              {selectedN}
            </span>
            <span className="absolute text-4xl font-black tabular-nums text-[var(--color-text)] drop-shadow-sm sm:text-5xl">{selectedN}</span>
          </div>
          <div
            ref={stripRef}
            role="slider"
            aria-valuemin={1}
            aria-valuemax={answerSlots}
            aria-valuenow={selectedN}
            aria-label={t("games.hiddenStack.sliderAria").replace("{max}", String(answerSlots))}
            className={`mx-auto grid w-full max-w-[min(100%,420px)] touch-none select-none gap-1 sm:gap-1.5 ${phase === "feedback" ? "pointer-events-none opacity-45" : ""}`}
            style={{ touchAction: "none", gridTemplateColumns: `repeat(${answerSlots}, minmax(0,1fr))` }}
            onPointerDown={onStripPointerDown}
            onPointerMove={onStripPointerMove}
            onPointerUp={onStripPointerEnd}
            onPointerCancel={onStripPointerEnd}
            onLostPointerCapture={() => {
              stripPointerDownRef.current = false;
            }}
          >
            {Array.from({ length: answerSlots }, (_, i) => {
              const n = i + 1;
              const lit = n <= selectedN;
              return (
                <div
                  key={n}
                  className={`flex h-10 min-w-0 flex-col items-center justify-end rounded-lg border-2 transition-colors sm:h-11 ${
                    lit
                      ? "border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_22%,var(--color-bg))] shadow-[0_0_12px_color-mix(in_srgb,var(--color-primary)_35%,transparent)]"
                      : "border-[color-mix(in_srgb,var(--color-text)_18%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_06%,var(--color-bg))] opacity-55"
                  }`}
                >
                  <span
                    className="mb-0.5 block h-4 w-4 max-w-[88%] rounded-sm bg-[color-mix(in_srgb,var(--color-text)_25%,var(--color-bg))] sm:h-5 sm:w-5"
                    style={{ clipPath: "polygon(15% 0,85% 0,100% 35%,50% 100%,0 35%)" }}
                    aria-hidden
                  />
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-3 pb-0.5">
            {phase === "feedback" ? (
              <button
                type="button"
                onClick={() => newRound()}
                className="rounded-full bg-[var(--color-primary)] px-8 py-3 text-base font-bold text-[var(--color-on-primary)] shadow-md"
              >
                {t("games.hiddenStack.nextRound")}
              </button>
            ) : (
              <button
                type="button"
                onClick={submitAnswer}
                disabled={phase !== "think"}
                className="rounded-full bg-[var(--color-accent)] px-8 py-3 text-base font-black text-[var(--color-on-primary)] shadow-md disabled:opacity-40"
              >
                {t("games.hiddenStack.submit")}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-2 w-full">
        <div className="mb-2 flex flex-col gap-2 lg:hidden">
          <details className="rounded-xl border border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_5%,transparent)] text-[var(--color-text)]">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--color-text)]">
              {t("games.hiddenStack.howToTitle")}
            </summary>
            <div className="border-t border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] px-3 pb-3 pt-2 text-xs leading-relaxed text-[var(--color-muted)]">
              <p className="m-0">{t("games.hiddenStack.howToBody")}</p>
            </div>
          </details>
        </div>
        <section className="mb-1.5 hidden rounded-xl border border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_5%,transparent)] px-3 py-2 lg:block">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">{t("games.hiddenStack.howToTitle")}</h3>
          <p className="mt-2 m-0 text-xs leading-relaxed text-[var(--color-muted)]">{t("games.hiddenStack.howToBody")}</p>
        </section>
      </div>
    </div>
  );
}
