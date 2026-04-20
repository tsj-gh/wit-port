"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import { PairLinkAdSlot } from "@/components/PairLinkAdSlots";
import { GamePageHeader } from "@/components/GamePageHeader";
import { DevDebugUserStats } from "@/components/DevDebugUserStats";
import {
  GAME_AD_GAP_BEFORE_SLOT_2_PX,
  HIDDEN_STACK_PC_ANSWER_BAND_FALLBACK_PX,
  HIDDEN_STACK_PC_CANVAS_VERTICAL_FUDGE_PX,
  HIDDEN_STACK_PC_TOP_AD_SASH_HEIGHT_PX,
} from "@/lib/gameLayout";
import { generateHiddenStackPuzzle } from "@/lib/hidden-stack/hiddenStackPuzzle";
import { useI18n } from "@/lib/i18n-context";
import type { BlockMaterialVariant, CollapsePatternId, GoldLumpParams } from "./HiddenStackCanvas";

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
  const [goldLumpParams, setGoldLumpParams] = useState<GoldLumpParams>({
    color: "#e7b008",
    metalness: 1,
    roughness: 0.3,
  });
  /** メッシュ見た目のみ（隙間対策）。物理コライダは HiddenStackCanvas 側で変更しない */
  const [blockMeshVisualScale, setBlockMeshVisualScale] = useState(1.05);

  const [puzzle, setPuzzle] = useState(() => generateHiddenStackPuzzle(`${Date.now()}`, { gridSize: 3 }));
  const [phase, setPhase] = useState<Phase>("intro");
  const [twistDeg, setTwistDeg] = useState(0);
  const [selectedN, setSelectedN] = useState(4);
  const [feedbackKey, setFeedbackKey] = useState(0);
  const [resultLine, setResultLine] = useState<string | null>(null);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean | null>(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [statusMessageStyle, setStatusMessageStyle] = useState<"card" | "plain">("card");
  const [seedInput, setSeedInput] = useState("");

  const dragTwistRef = useRef<{ active: boolean; lastX: number }>({ active: false, lastX: 0 });
  const stripRef = useRef<HTMLDivElement>(null);
  const stripPointerDownRef = useRef(false);
  const topAdRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const answerBandRef = useRef<HTMLDivElement>(null);
  const didInitialAutoScrollRef = useRef(false);
  const [isLgViewport, setIsLgViewport] = useState(false);
  const [answerBandHeightPx, setAnswerBandHeightPx] = useState(HIDDEN_STACK_PC_ANSWER_BAND_FALLBACK_PX);

  useEffect(() => {
    stripPointerDownRef.current = false;
  }, [phase]);
  useEffect(() => {
    if (!seedInput) setSeedInput(puzzle.sourceSeed);
  }, [puzzle.sourceSeed, seedInput]);

  const answerSlots = useMemo(() => {
    return Math.max(ICON_SLOTS, Math.min(24, puzzle.hiddenCount + 4));
  }, [puzzle.hiddenCount]);

  const resetRoundStates = useCallback((nextHiddenCount: number) => {
    setPhase("intro");
    setTwistDeg(0);
    setSelectedN(Math.max(1, Math.min(Math.max(ICON_SLOTS, Math.min(24, nextHiddenCount + 4)), Math.floor((nextHiddenCount + 1) / 2))));
    setResultLine(null);
    setIsAnswerCorrect(null);
    setReviewMode(false);
    setFeedbackKey((k) => k + 1);
  }, []);

  const newRound = useCallback((nextGridSize?: number) => {
    const g = nextGridSize ?? gridSize;
    const next = generateHiddenStackPuzzle(`${Date.now()}:${Math.random().toString(36).slice(2)}`, { gridSize: g });
    setPuzzle(next);
    if (nextGridSize != null) setGridSize(g);
    setSeedInput(next.sourceSeed);
    resetRoundStates(next.hiddenCount);
  }, [gridSize, resetRoundStates]);

  const generateFromSeed = useCallback(() => {
    const s = seedInput.trim();
    if (!s) return;
    const next = generateHiddenStackPuzzle(s, { gridSize });
    setPuzzle(next);
    setSeedInput(next.sourceSeed);
    resetRoundStates(next.hiddenCount);
  }, [gridSize, resetRoundStates, seedInput]);

  useEffect(() => {
    setSelectedN((n) => Math.max(1, Math.min(answerSlots, n)));
  }, [answerSlots]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsLgViewport(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (didInitialAutoScrollRef.current) return;
    const t = window.setTimeout(() => {
      if (didInitialAutoScrollRef.current) return;
      if (typeof window === "undefined") return;
      if (window.innerWidth >= 1024) {
        topAdRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
      didInitialAutoScrollRef.current = true;
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!isLgViewport) return;
    const el = answerBandRef.current;
    if (!el) return;
    const apply = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      if (h > 0) setAnswerBandHeightPx(h);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isLgViewport, answerSlots, phase, puzzle]);

  const pcCanvasShellStyle = useMemo((): CSSProperties | undefined => {
    if (!isLgViewport) return undefined;
    const h = `calc(100vh - ${HIDDEN_STACK_PC_TOP_AD_SASH_HEIGHT_PX}px - ${answerBandHeightPx}px - ${HIDDEN_STACK_PC_CANVAS_VERTICAL_FUDGE_PX}px)`;
    return { height: h, minHeight: h };
  }, [isLgViewport, answerBandHeightPx]);

  const onIntroComplete = useCallback(() => {
    setPhase("think");
  }, []);

  const submitAnswer = useCallback(() => {
    if (phase !== "think") return;
    const ok = selectedN === puzzle.hiddenCount;
    const line = t(ok ? "games.hiddenStack.resultCorrect" : "games.hiddenStack.resultWrong").replace("{n}", String(puzzle.hiddenCount));
    setResultLine(line);
    setIsAnswerCorrect(ok);
    setReviewMode(false);
    setPhase("feedback");
    setFeedbackKey((k) => k + 1);
  }, [phase, selectedN, puzzle.hiddenCount, t]);

  const startReview = useCallback(() => {
    if (phase !== "feedback") return;
    setReviewMode(true);
  }, [phase]);

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
    <div className="relative isolate flex w-full flex-1 flex-col lg:min-h-0">
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
                <div className="mb-1 font-semibold text-[var(--color-text)]">{t("games.hiddenStack.debugMeshCrevice")}</div>
                <label className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <input
                    type="range"
                    min={1}
                    max={1.2}
                    step={0.001}
                    value={blockMeshVisualScale}
                    onChange={(e) => setBlockMeshVisualScale(Number(e.target.value))}
                    className="min-w-[120px] flex-1 accent-[var(--color-primary)]"
                  />
                  <span className="tabular-nums text-[var(--color-text)]">{blockMeshVisualScale.toFixed(3)}×</span>
                </label>
              </div>
              <div>
                <div className="mb-1 font-semibold text-[var(--color-text)]">{t("games.hiddenStack.debugStatusStyle")}</div>
                <div className="flex flex-wrap gap-1">
                  {(["card", "plain"] as const).map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => setStatusMessageStyle(style)}
                      className={`rounded px-2 py-0.5 text-[10px] border ${
                        statusMessageStyle === style
                          ? "border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_18%,var(--color-bg))] text-[var(--color-primary)]"
                          : "border-[color-mix(in_srgb,var(--color-text)_18%,transparent)]"
                      }`}
                    >
                      {style === "card" ? t("games.hiddenStack.statusStyleCard") : t("games.hiddenStack.statusStylePlain")}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1 font-semibold text-[var(--color-text)]">{t("games.hiddenStack.debugGoldLump")}</div>
                <div className="space-y-2">
                  <label className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="shrink-0 text-[var(--color-muted)]">{t("games.hiddenStack.debugGoldMetalness")}</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={goldLumpParams.metalness}
                      onChange={(e) => setGoldLumpParams((p) => ({ ...p, metalness: Number(e.target.value) }))}
                      className="min-w-[120px] flex-1 accent-[var(--color-primary)]"
                    />
                    <span className="tabular-nums text-[var(--color-text)]">{goldLumpParams.metalness.toFixed(2)}</span>
                  </label>
                  <label className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="shrink-0 text-[var(--color-muted)]">{t("games.hiddenStack.debugGoldRoughness")}</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={goldLumpParams.roughness}
                      onChange={(e) => setGoldLumpParams((p) => ({ ...p, roughness: Number(e.target.value) }))}
                      className="min-w-[120px] flex-1 accent-[var(--color-primary)]"
                    />
                    <span className="tabular-nums text-[var(--color-text)]">{goldLumpParams.roughness.toFixed(2)}</span>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[var(--color-muted)]">{t("games.hiddenStack.debugGoldColor")}</span>
                    <input
                      type="text"
                      value={goldLumpParams.color}
                      onChange={(e) => setGoldLumpParams((p) => ({ ...p, color: e.target.value }))}
                      spellCheck={false}
                      className="w-full rounded border border-[color-mix(in_srgb,var(--color-text)_16%,transparent)] bg-[color-mix(in_srgb,var(--color-bg)_82%,transparent)] px-2 py-1 font-mono text-[10px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                    />
                  </label>
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
              <div className="space-y-1.5 rounded border border-[color-mix(in_srgb,var(--color-text)_12%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_05%,var(--color-bg))] px-2 py-2 text-[10px]">
                <div className="flex items-center gap-1">
                  <span className="shrink-0 text-[var(--color-muted)]">{t("games.hiddenStack.debugCurrentSeed")}</span>
                  <code className="truncate rounded bg-[color-mix(in_srgb,var(--color-text)_06%,var(--color-bg))] px-1 text-[var(--color-text)]" title={puzzle.sourceSeed}>
                    {puzzle.sourceSeed}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(puzzle.sourceSeed).catch(() => {});
                    }}
                    className="ml-auto rounded border border-[color-mix(in_srgb,var(--color-text)_20%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_10%,transparent)] px-1.5 py-0.5 text-[9px]"
                  >
                    {t("games.hiddenStack.debugCopy")}
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={seedInput}
                    onChange={(e) => setSeedInput(e.target.value)}
                    placeholder={t("games.hiddenStack.debugSeedInputPlaceholder")}
                    className="min-w-0 flex-1 rounded border border-[color-mix(in_srgb,var(--color-text)_16%,transparent)] bg-[color-mix(in_srgb,var(--color-bg)_82%,transparent)] px-2 py-1 text-[10px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                  />
                  <button
                    type="button"
                    onClick={generateFromSeed}
                    disabled={!seedInput.trim()}
                    className="rounded border border-[color-mix(in_srgb,var(--color-primary)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_12%,var(--color-bg))] px-2 py-1 text-[10px] text-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t("games.hiddenStack.debugGenerateFromSeed")}
                  </button>
                </div>
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

      <div ref={headerRef} className="mx-auto w-full max-w-[min(100%,1080px)] shrink-0 px-4 pt-0 md:pt-1 lg:px-6 lg:pt-0">
        <GamePageHeader titleEn="Hidden Stack" titleJa={t("games.hiddenStack.titleJa")} className="mb-3 md:mb-4" />
      </div>

      <div
        ref={topAdRef}
        className="relative left-1/2 mb-6 w-screen max-w-[100vw] shrink-0 -translate-x-1/2 lg:mb-0 lg:left-0 lg:w-full lg:translate-x-0"
      >
        <div
          className="mx-auto flex w-full max-w-[min(100%,1200px)] min-h-0 items-center justify-center px-2 sm:px-3 lg:min-h-[var(--hs-ad)] lg:max-h-[var(--hs-ad)] lg:px-4"
          style={{ ["--hs-ad" as string]: `${HIDDEN_STACK_PC_TOP_AD_SASH_HEIGHT_PX}px` } as CSSProperties}
        >
          <PairLinkAdSlot slotIndex={1} />
        </div>
      </div>

      <div className="flex h-auto min-h-0 w-full flex-1 flex-col gap-3 px-4 pb-3 pt-1 lg:min-h-0 lg:flex-row lg:items-stretch lg:gap-6 lg:px-6 lg:pb-4 lg:pt-0">
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col lg:min-h-0 lg:flex-[1_1_0%] lg:overflow-hidden">
          <section className="relative flex h-auto w-full min-h-[280px] flex-1 flex-col overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] bg-[var(--color-surface)] shadow-inner lg:min-h-0 lg:flex-1">
            <div
              className={`relative min-h-0 w-full flex-1 overflow-hidden rounded-2xl bg-[#f1f5f9] lg:min-h-0 ${isLgViewport ? "lg:flex-none" : ""}`}
              style={pcCanvasShellStyle}
              onPointerDown={onCanvasPointerDown}
              onPointerMove={onCanvasPointerMove}
              onPointerUp={onCanvasPointerUp}
              onPointerCancel={onCanvasPointerUp}
              onPointerLeave={onCanvasPointerUp}
            >
                <div className="absolute inset-0 min-h-0">
                  <HiddenStackCanvas
                    phase={phase}
                    puzzle={puzzle}
                    twistDeg={twistDeg}
                    materialVariant={materialVariant}
                    collapsePattern={collapsePattern}
                    onIntroComplete={onIntroComplete}
                    feedbackKey={feedbackKey}
                    goldLumpParams={goldLumpParams}
                    blockMeshVisualScale={blockMeshVisualScale}
                    reviewMode={reviewMode}
                  />
                </div>
              </div>

              <div
                ref={answerBandRef}
                className="z-40 w-full shrink-0 border-t border-[color-mix(in_srgb,var(--color-text)_12%,transparent)] bg-[color-mix(in_srgb,var(--color-surface)_96%,var(--color-bg))] px-3 pb-[max(env(safe-area-inset-bottom),8px)] pt-1.5 backdrop-blur-md lg:mt-auto"
              >
                <div className="mx-auto flex w-full max-w-[520px] flex-col gap-1.5 lg:mx-0 lg:max-w-none">
                  {phase === "feedback" && reviewMode ? (
                    <div className="flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => newRound()}
                        className="rounded-full bg-[var(--color-primary)] px-5 py-2 text-sm font-bold text-[var(--color-on-primary)] sm:px-6 sm:text-base"
                      >
                        {t("games.hiddenStack.nextRound")}
                      </button>
                    </div>
                  ) : (
                    <div className="flex w-full flex-col items-center gap-2">
                      {phase === "feedback" && resultLine && (
                        <div className="flex w-full items-center justify-center">
                          {statusMessageStyle === "card" ? (
                            <p
                              className={`rounded-[8px] px-3 py-1.5 text-sm font-bold sm:px-4 ${
                                isAnswerCorrect
                                  ? "bg-[color-mix(in_srgb,#16a34a_12%,var(--color-bg))] text-[#166534]"
                                  : "bg-[color-mix(in_srgb,#1d4ed8_10%,var(--color-bg))] text-[#1e3a8a]"
                              }`}
                            >
                              {isAnswerCorrect ? (
                                resultLine
                              ) : (
                                <>
                                  {t("games.hiddenStack.resultWrongLead")}
                                  <span className="ml-1 font-black">{t("games.hiddenStack.resultWrong").replace("{n}", String(puzzle.hiddenCount))}</span>
                                </>
                              )}
                            </p>
                          ) : (
                            <p className={`text-sm font-bold sm:text-base ${isAnswerCorrect ? "text-[#166534]" : "text-[#1e3a8a]"}`}>
                              <span aria-hidden className="mr-1">
                                {isAnswerCorrect ? "✓" : "!"}
                              </span>
                              {isAnswerCorrect ? (
                                resultLine
                              ) : (
                                <>
                                  {t("games.hiddenStack.resultWrongLead")}
                                  <span className="ml-1 font-black">{t("games.hiddenStack.resultWrong").replace("{n}", String(puzzle.hiddenCount))}</span>
                                </>
                              )}
                            </p>
                          )}
                        </div>
                      )}
                      <div className="flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-2">
                        {phase === "feedback" && (
                          <button
                            type="button"
                            onClick={startReview}
                            className="rounded-full border border-[color-mix(in_srgb,var(--color-text)_24%,transparent)] bg-transparent px-4 py-2 text-sm font-bold text-[var(--color-text)] sm:px-5"
                          >
                            {t("games.hiddenStack.review")}
                          </button>
                        )}
                        <div className="relative flex min-h-[44px] min-w-[64px] items-center justify-center sm:min-h-[50px]">
                          <span className="pointer-events-none select-none text-4xl font-black tabular-nums text-[var(--color-primary)] opacity-[0.2] sm:text-5xl">
                            {selectedN}
                          </span>
                          <span className="absolute text-3xl font-black tabular-nums text-[var(--color-text)] sm:text-4xl">{selectedN}</span>
                        </div>
                        {phase === "feedback" ? (
                          <button
                            type="button"
                            onClick={() => newRound()}
                            className="rounded-full bg-[var(--color-primary)] px-5 py-2 text-sm font-bold text-[var(--color-on-primary)] sm:px-6 sm:text-base"
                          >
                            {t("games.hiddenStack.nextRound")}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={submitAnswer}
                            disabled={phase !== "think"}
                            className="rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm font-black text-[var(--color-on-primary)] disabled:opacity-40 sm:px-6 sm:text-base"
                          >
                            {t("games.hiddenStack.submit")}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {!reviewMode && (
                    <div
                      ref={stripRef}
                      role="slider"
                      aria-valuemin={1}
                      aria-valuemax={answerSlots}
                      aria-valuenow={selectedN}
                      aria-label={t("games.hiddenStack.sliderAria").replace("{max}", String(answerSlots))}
                      className={`mx-auto grid w-full max-w-[min(100%,420px)] touch-none select-none gap-1 sm:gap-1.5 lg:max-w-full ${phase === "feedback" ? "pointer-events-none opacity-45" : ""}`}
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
                            className={`flex h-9 min-w-0 flex-col items-center justify-end rounded-lg border-2 transition-colors sm:h-10 ${
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
                  )}
                </div>
              </div>
            </section>
          </div>

          <aside className="order-2 flex w-full shrink-0 flex-col lg:order-none lg:min-h-0 lg:w-[min(360px,35%)] lg:max-w-[35%] lg:flex-[0_1_auto] lg:self-start lg:overflow-y-auto lg:overflow-x-hidden lg:overscroll-y-contain">
            <div className="mt-1 flex w-full flex-col gap-2 lg:mt-0">
              <details className="rounded-xl border border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_5%,transparent)] text-[var(--color-text)] lg:hidden">
                <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--color-text)]">
                  {t("games.hiddenStack.howToTitle")}
                </summary>
                <div className="border-t border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] px-3 pb-3 pt-2 text-xs leading-relaxed text-[var(--color-muted)]">
                  <p className="m-0">{t("games.hiddenStack.howToBody")}</p>
                </div>
              </details>

              <div className="mt-1 hidden w-full flex-col gap-2 lg:mt-0 lg:flex lg:shrink-0">
                <section className="rounded-xl border border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] bg-[color-mix(in_srgb,var(--color-text)_5%,transparent)] px-3 py-2">
                  <h3 className="text-sm font-semibold text-[var(--color-text)]">{t("games.hiddenStack.howToTitle")}</h3>
                  <p className="mt-2 m-0 text-xs leading-relaxed text-[var(--color-muted)]">{t("games.hiddenStack.howToBody")}</p>
                </section>
              </div>
            </div>

            <div className="relative z-0 w-full shrink-0" style={{ marginTop: `${GAME_AD_GAP_BEFORE_SLOT_2_PX}px` }}>
              <PairLinkAdSlot slotIndex={2} />
            </div>
          </aside>
        </div>
    </div>
  );
}
