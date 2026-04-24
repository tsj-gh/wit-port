"use client";

import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Physics, useBox, usePlane } from "@react-three/cannon";
import * as THREE from "three";
import { Line, OrbitControls, RoundedBox } from "@react-three/drei";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { HiddenStackPuzzle } from "@/lib/hidden-stack/hiddenStackPuzzle";
import { createWoodTexture, setWoodTextureMaxAnisotropy } from "@/lib/hidden-stack/createWoodTexture";
import { EXTERNAL_WOOD_TEXTURE_PATHS, cloneExternalWoodTextureForMesh, safeOffsetForRepeat } from "@/lib/hidden-stack/externalWoodTextures";
import { cameraPositionForTwist, cellCenter, cellKey, parseKey } from "@/lib/hidden-stack/hiddenStackPuzzle";

/** 物理ボディ（半辺 0.48）はそのまま。レンダリング丸め用の最小オーバーラップ（メッシュのみ） */
const BLOCK_MESH_BASE_OVERLAP = 1.002;

/** 積み木塊の縦方向が Canvas 高さに占める目標比率（0.80〜0.85 の中間） */
const ORTHO_STACK_VERTICAL_FILL = 0.825;

/** バウンディングボックスに対する ortho 余白（わずかに広げてクリップを避ける） */
const ORTHO_BBOX_MARGIN = 1.06;

/** 材質 B の RoundedBox：大きなベベルは谷間から背景が見えやすいため弱める */
const BLOCK_B_BEVEL_RADIUS = 0.012;
const BLOCK_B_BEVEL_SMOOTHNESS = 2;

const DEFAULT_BLOCK_MESH_VISUAL_SCALE = 1.03;

/** Cannon 衝突グループ：正誤判定で可視ダイナミックは床と衝突しない（金塊・可視同士は従来どおり） */
const PHYS_LAYER_FLOOR = 1;
const PHYS_LAYER_STATIC_GOLD = 2;
const PHYS_LAYER_DYNAMIC_VISIBLE = 4;
const BASE_ELEVATION_DEG = 31;
const BASE_AZIMUTH_DEG = 44;

/** A=手続き木目（旧 Wood01）、B=外部木目テクスチャ、C=くすみセミグロス（色は semiGlossColorId） */
export type BlockMaterialVariant = "A" | "B" | "C";

export type SemiGlossColorId = "pink" | "turquoise" | "beige" | "green" | "mauve" | "terracotta";

export const SEMI_GLOSS_COLOR_HEX: Record<SemiGlossColorId, string> = {
  pink: "#f6b8c6",
  turquoise: "#6fa1a1",
  beige: "#dfcdb7",
  green: "#8ca18c",
  mauve: "#9e8a9c",
  terracotta: "#c07a5f",
};

function isWoodLikeMaterial(v: BlockMaterialVariant): boolean {
  return v === "A" || v === "B";
}

/** 旧 B セミグロス相当：半光沢の meshStandard（roughness 0.3〜0.5 帯）。色のみ差し替え */
function SemiGlossDustyMaterial({ color }: { color: string }) {
  return <meshStandardMaterial color={color} roughness={0.38} metalness={0.06} />;
}

type ExternalWoodTexturesContextValue = {
  bases: THREE.Texture[];
  activeIndex: number;
  shadowLift: number;
  roughness: number;
  envMapIntensity: number;
  repeatScale: number;
};

const ExternalWoodTexturesContext = createContext<ExternalWoodTexturesContextValue | null>(null);
const GoldEnvMapContext = createContext<THREE.Texture | null>(null);

function ExternalWoodTexturesBridge({
  activeIndex,
  shadowLift,
  roughness,
  envMapIntensity,
  repeatScale,
  children,
}: {
  activeIndex: number;
  shadowLift: number;
  roughness: number;
  envMapIntensity: number;
  repeatScale: number;
  children: ReactNode;
}) {
  const bases = useLoader(THREE.TextureLoader, [...EXTERNAL_WOOD_TEXTURE_PATHS]);
  const { gl } = useThree();
  useLayoutEffect(() => {
    bases.forEach((t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      setWoodTextureMaxAnisotropy(t, gl);
      t.needsUpdate = true;
    });
  }, [bases, gl]);
  const value = useMemo(
    () => ({ bases, activeIndex, shadowLift, roughness, envMapIntensity, repeatScale }),
    [bases, activeIndex, shadowLift, roughness, envMapIntensity, repeatScale]
  );
  return <ExternalWoodTexturesContext.Provider value={value}>{children}</ExternalWoodTexturesContext.Provider>;
}

function BlockExternalWoodPBRMaterial({ surfaceKey }: { surfaceKey: string }) {
  const ctx = useContext(ExternalWoodTexturesContext);
  const { gl } = useThree();
  const shadowLift = ctx?.shadowLift ?? 0.42;
  const roughness = ctx?.roughness ?? 0.58;
  const envMapIntensity = ctx?.envMapIntensity ?? 1.7;
  const baseGainColor = useMemo(() => new THREE.Color().setScalar(1 + shadowLift * 0.22), [shadowLift]);
  const emissiveIntensity = useMemo(() => shadowLift * 0.24, [shadowLift]);
  const uvJitter = useMemo(
    () => ({
      offsetU: hash01(`${surfaceKey}|u`),
      offsetV: hash01(`${surfaceKey}|v`),
      rotationQuarters: Math.floor(hash01(`${surfaceKey}|r`) * 4),
    }),
    [surfaceKey]
  );
  const map = useMemo(() => {
    if (!ctx?.bases.length) return null;
    const idx = THREE.MathUtils.clamp(ctx.activeIndex, 0, ctx.bases.length - 1);
    const base = ctx.bases[idx];
    return cloneExternalWoodTextureForMesh(base, uvJitter.offsetU, uvJitter.offsetV, uvJitter.rotationQuarters, ctx.repeatScale, gl);
  }, [ctx, gl, uvJitter]);
  useEffect(() => () => map?.dispose(), [map]);
  if (!map) {
    return <meshStandardMaterial color="#c9a06c" roughness={roughness} metalness={0} envMapIntensity={envMapIntensity} />;
  }
  return (
    <meshStandardMaterial
      map={map}
      color={baseGainColor}
      roughness={roughness}
      metalness={0}
      envMapIntensity={envMapIntensity}
      emissive="#ffffff"
      emissiveMap={map}
      emissiveIntensity={emissiveIntensity}
    />
  );
}

function DynamicExternalWoodMaterial({
  surfaceKey,
  pattern,
  matRef,
}: {
  surfaceKey: string;
  pattern: CollapsePatternId;
  matRef: RefObject<THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial | null>;
}) {
  const ctx = useContext(ExternalWoodTexturesContext);
  const { gl } = useThree();
  const shadowLift = ctx?.shadowLift ?? 0.42;
  const roughness = ctx?.roughness ?? 0.58;
  const envMapIntensity = ctx?.envMapIntensity ?? 1.7;
  const baseGainColor = useMemo(() => new THREE.Color().setScalar(1 + shadowLift * 0.22), [shadowLift]);
  const emissiveIntensity = useMemo(() => shadowLift * 0.24, [shadowLift]);
  const uvJitter = useMemo(
    () => ({
      offsetU: hash01(`${surfaceKey}|u`),
      offsetV: hash01(`${surfaceKey}|v`),
      rotationQuarters: Math.floor(hash01(`${surfaceKey}|r`) * 4),
    }),
    [surfaceKey]
  );
  const map = useMemo(() => {
    if (!ctx?.bases.length) return null;
    const idx = THREE.MathUtils.clamp(ctx.activeIndex, 0, ctx.bases.length - 1);
    return cloneExternalWoodTextureForMesh(
      ctx.bases[idx],
      uvJitter.offsetU,
      uvJitter.offsetV,
      uvJitter.rotationQuarters,
      ctx.repeatScale,
      gl
    );
  }, [ctx, gl, uvJitter]);
  useEffect(() => () => map?.dispose(), [map]);
  if (!map) {
    return (
      <meshStandardMaterial
        ref={matRef as never}
        color="#c9a06c"
        roughness={roughness}
        metalness={0}
        envMapIntensity={envMapIntensity}
        transparent={pattern === 3}
        opacity={pattern === 3 ? 0.95 : 1}
      />
    );
  }
  return (
    <meshStandardMaterial
      ref={matRef as never}
      map={map}
      color={baseGainColor}
      roughness={roughness}
      metalness={0}
      envMapIntensity={envMapIntensity}
      emissive="#ffffff"
      emissiveMap={map}
      emissiveIntensity={emissiveIntensity}
      transparent={pattern === 3}
      opacity={pattern === 3 ? 0.95 : 1}
    />
  );
}

function GoldEnvMapBridge({ children }: { children: ReactNode }) {
  const { gl } = useThree();
  const [envMap, setEnvMap] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.035);
    setEnvMap(envRT.texture);
    return () => {
      setEnvMap(null);
      envRT.dispose();
      pmrem.dispose();
    };
  }, [gl]);
  return <GoldEnvMapContext.Provider value={envMap}>{children}</GoldEnvMapContext.Provider>;
}

/**
 * インデックス付き BoxGeometry を非インデックス化した上で法線を再計算し、
 * 立方体の稜で法線が平均化されないよう面ごとに独立した法線にする。
 */
function ensureFlatBoxVertexNormals(geometry: THREE.BufferGeometry) {
  if (geometry.userData.hiddenStackFlatNormals) return;
  geometry.userData.hiddenStackFlatNormals = true;
  if (!geometry.index) {
    geometry.deleteAttribute("normal");
    geometry.computeVertexNormals();
    return;
  }
  const src = geometry.toNonIndexed();
  geometry.setIndex(null);
  for (const name in src.attributes) {
    if (name === "normal") continue;
    const attr = src.getAttribute(name);
    if (attr) geometry.setAttribute(name, attr.clone());
  }
  geometry.deleteAttribute("normal");
  geometry.computeVertexNormals();
  src.dispose();
}

export type CollapsePatternId = 1 | 2 | 3;

/** 正解ブロックの「金塊」表示用（デバッグパネルから調整可） */
export type GoldLumpParams = {
  metalness: number;
  roughness: number;
  envMapIntensity: number;
  texRepeatScale: number;
};

export type FeedbackSpotlightParams = {
  overallLightRatio: number;
  spotIntensity: number;
  spotAngle: number;
  angularVelocity: number;
  movementRangeDeg: number;
  /** 正誤判定演出中のみ、金塊の envMapIntensity に加算 */
  goldEnvMapBoost: number;
  /** スポットと同軌道で追従する狭い PointLight の強度 */
  followPointIntensity: number;
};

/** 崩落ブロックを消すまでの待ち＋フェード（秒） */
const FEEDBACK_FALL_FADE_START_SEC = 1.0;
const FEEDBACK_FALL_FADE_DURATION_SEC = 1.0;

type HiddenStackCanvasProps = {
  phase: "intro" | "think" | "feedback";
  puzzle: HiddenStackPuzzle;
  twistDeg: number;
  materialVariant: BlockMaterialVariant;
  collapsePattern: CollapsePatternId;
  onIntroComplete: () => void;
  feedbackKey: number;
  goldLumpParams: GoldLumpParams;
  /** メッシュ見た目のみ（既定 1.05）。物理コライダは変更しない */
  blockMeshVisualScale?: number;
  /** ふりかえり中の見た目メッシュ倍率（ReviewScene のみ） */
  reviewBlockMeshVisualScale?: number;
  /** ふりかえりモード中は崩落を止めて静止表示＋自由回転 */
  reviewMode?: boolean;
  /** ふりかえり中：可視ブロックのソリッド表示。false のとき枠線（GhostBox）のみ */
  reviewShowVisibleSolids?: boolean;
  /** ふりかえり時の回転誘導：この角度（deg）を初期方位から超えたらコールバックを一度だけ呼ぶ */
  reviewAzimuthHintLimitDeg?: number;
  onReviewAzimuthHintThresholdExceeded?: () => void;
  /** 直近の解答が正解のとき、死角の「金塊」をマットな金系 PBR に切り替え（feedback / review 共通） */
  feedbackAnswerCorrect?: boolean | null;
  /** 法線確認デバッグ用: 全ブロックを MeshNormalMaterial で描画 */
  debugNormalMaterial?: boolean;
  /** 外部木目テクスチャ（0=Walnut01 … 5=Oak03）。質感 B のとき描画に使用 */
  externalWoodTextureIndex?: number;
  /** 質感 C（セミグロス）の面色 */
  semiGlossColorId?: SemiGlossColorId;
  /** デバッグ用の全体アンビエントライト強度 */
  ambientLightIntensity?: number;
  /** WoodTex 専用: 影持ち上げ強度（暗部視認性） */
  woodTexShadowLift?: number;
  /** WoodTex 専用: 粗さ */
  woodTexRoughness?: number;
  /** WoodTex 専用: 環境反射強度 */
  woodTexEnvMapIntensity?: number;
  /** WoodTex 専用: UV スケール（小さいほど木目が大きく見える） */
  woodTexRepeatScale?: number;
  /** WoodTex 専用: 補助フィルライト強度 */
  woodTexFillLightIntensity?: number;
  /** WoodTex 専用: 2灯目フィルライト強度 */
  woodTexFillLightSecondaryIntensity?: number;
  /** WoodTex 専用: リムライト強度 */
  woodTexRimLightIntensity?: number;
  /** 正誤判定中スポットライト演出パラメータ */
  feedbackSpotlightParams?: FeedbackSpotlightParams;
  /** 正誤判定中：可視ブロック位置の枠線（GhostBox）の不透明度 */
  feedbackVisibleCellOutlineOpacity?: number;
  /** イントロ落下：時間進み倍率（大きいほど早く着地＝初速感） */
  introFallTimeScale?: number;
  /** イントロ落下：開始高さの倍率（大きいほど高所から） */
  introDropHeightScale?: number;
  /** 正誤判定キャノン重力の Y 成分の大きさ（下向きは負で適用） */
  feedbackPhysicsGravityY?: number;
  /** 正誤判定で飛ばすブロックのインパルス・トルク倍率（初速） */
  feedbackImpulseScale?: number;
  /** 出題〜ふりかえり：キー Directional の影が床に落ちる水平角（Y 軸周り、度） */
  keyLightShadowYawDeg?: number;
  /** RigCamera の自動 zoom に掛ける倍率（デバッグ） */
  orthoCameraZoomMul?: number;
};

function lookAtForGrid(gridSize: number): THREE.Vector3 {
  const c = gridSize / 2;
  return new THREE.Vector3(c, c, c);
}

function cameraRadiusForGrid(gridSize: number): number {
  return gridSize * 2.75;
}

/** グリッド立方体の 8 頂点をビュー空間 XY に射影した軸平行バウンディングの半幅・半高 */
function gridViewSpaceBBoxHalfExtents(camera: THREE.OrthographicCamera, gridSize: number): { halfW: number; halfH: number } {
  camera.updateMatrixWorld(true);
  const inv = camera.matrixWorldInverse;
  const tmp = new THREE.Vector3();
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const g = gridSize;
  for (let i = 0; i < 8; i++) {
    tmp.set((i & 1) !== 0 ? g : 0, ((i >> 1) & 1) !== 0 ? g : 0, ((i >> 2) & 1) !== 0 ? g : 0).applyMatrix4(inv);
    minX = Math.min(minX, tmp.x);
    maxX = Math.max(maxX, tmp.x);
    minY = Math.min(minY, tmp.y);
    maxY = Math.max(maxY, tmp.y);
  }
  return { halfW: Math.max((maxX - minX) / 2, 1e-4), halfH: Math.max((maxY - minY) / 2, 1e-4) };
}

/** ビュー空間の半幅・半高から、ピクセル縦横比に合わせた ortho frustum 半幅 */
function orthoFrustumFromHalfExtents(halfW: number, halfH: number, aspect: number, gridSize: number): { vExtent: number; hExtent: number } {
  const floor = gridSize * 0.16;
  let w = Math.max(halfW, floor);
  let h = Math.max(halfH, floor);
  let vExtent = h;
  let hExtent = w;
  if (hExtent / vExtent > aspect) {
    vExtent = hExtent / aspect;
  } else {
    hExtent = vExtent * aspect;
  }
  return { vExtent, hExtent };
}

function RigCamera({
  twistDeg,
  gridSize,
  orthoCameraZoomMul = 1,
}: {
  twistDeg: number;
  gridSize: number;
  orthoCameraZoomMul?: number;
}) {
  const { camera, size } = useThree();
  const look = useMemo(() => lookAtForGrid(gridSize), [gridSize]);

  useFrame(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) return;

    const w = Math.max(1, size.width);
    const h = Math.max(1, size.height);
    const aspect = w / h;

    const radiusScale = THREE.MathUtils.clamp(1.02 - 0.06 * Math.min(aspect, 2.4), 0.84, 1.02);
    /** 従来と同じ軌道（仰角 31°・方位 44°＋twist）。平行投影で縦エッジは互いに平行のまま、パース由来の隙間は解消 */
    const p = cameraPositionForTwist(
      twistDeg,
      cameraRadiusForGrid(gridSize) * radiusScale,
      BASE_ELEVATION_DEG,
      BASE_AZIMUTH_DEG,
      look
    );
    camera.position.copy(p);
    camera.up.set(0, 1, 0);
    camera.lookAt(look);

    const raw = gridViewSpaceBBoxHalfExtents(camera, gridSize);
    const fit = orthoFrustumFromHalfExtents(raw.halfW * ORTHO_BBOX_MARGIN, raw.halfH * ORTHO_BBOX_MARGIN, aspect, gridSize);
    camera.left = -fit.hExtent;
    camera.right = fit.hExtent;
    camera.top = fit.vExtent;
    camera.bottom = -fit.vExtent;

    /** 積み木塊の縦が Canvas 高さの ORTHO_STACK_VERTICAL_FILL になるよう zoom を決定（横ははみ出さないよう cap） */
    const zoomV = (ORTHO_STACK_VERTICAL_FILL * fit.vExtent) / raw.halfH;
    const zoomH = fit.hExtent / raw.halfW;
    const autoZoom = THREE.MathUtils.clamp(Math.min(zoomV, zoomH), 0.12, 14);
    const mul = Number.isFinite(orthoCameraZoomMul) && orthoCameraZoomMul > 0 ? orthoCameraZoomMul : 1;
    camera.zoom = THREE.MathUtils.clamp(autoZoom * mul, 0.05, 24);
    camera.updateProjectionMatrix();
  });
  return null;
}

function GoldLumpMaterial({
  params,
  surfaceKey,
  highlightSpecular = false,
  feedbackEnvMapBoost = 0,
}: {
  params: GoldLumpParams;
  surfaceKey: string;
  highlightSpecular?: boolean;
  /** 正誤判定ハイライト中のみ envMapIntensity に加算 */
  feedbackEnvMapBoost?: number;
}) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const { gl } = useThree();
  const goldEnvMap = useContext(GoldEnvMapContext);
  const baseMap = useLoader(THREE.TextureLoader, "/textures/texture_gold_albedo_01.jpg");
  const uv = useMemo(
    () => ({
      offsetU: hash01(`${surfaceKey}|gold-u`),
      offsetV: hash01(`${surfaceKey}|gold-v`),
      rotationQuarters: Math.floor(hash01(`${surfaceKey}|gold-r`) * 4),
    }),
    [surfaceKey]
  );
  const map = useMemo(() => {
    const tex = baseMap.clone();
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(params.texRepeatScale, params.texRepeatScale);
    tex.center.set(0.5, 0.5);
    tex.rotation = (Math.PI / 2) * uv.rotationQuarters;
    tex.offset.set(
      safeOffsetForRepeat(uv.offsetU, params.texRepeatScale),
      safeOffsetForRepeat(uv.offsetV, params.texRepeatScale)
    );
    setWoodTextureMaxAnisotropy(tex, gl);
    tex.needsUpdate = true;
    return tex;
  }, [baseMap, params.texRepeatScale, uv, gl]);
  useEffect(() => () => map.dispose(), [map]);

  useEffect(() => {
    const m = matRef.current;
    if (!m) return;
    m.needsUpdate = true;
  }, [params.metalness, params.roughness, params.envMapIntensity, params.texRepeatScale, map, highlightSpecular, feedbackEnvMapBoost]);

  const envMapIntensity =
    highlightSpecular && feedbackEnvMapBoost > 0 ? params.envMapIntensity + feedbackEnvMapBoost : params.envMapIntensity;

  return (
    <meshStandardMaterial
      ref={matRef}
      map={map}
      color="#ffffff"
      metalness={params.metalness}
      roughness={highlightSpecular ? Math.min(params.roughness, 0.1) : params.roughness}
      envMap={goldEnvMap ?? undefined}
      envMapIntensity={envMapIntensity}
    />
  );
}

function BlockWoodPBRMaterial({ surfaceKey }: { surfaceKey: string }) {
  const woodMap = useMemo(() => createWoodTexture(256), [surfaceKey]);
  const { gl } = useThree();
  useLayoutEffect(() => {
    setWoodTextureMaxAnisotropy(woodMap, gl);
  }, [woodMap, gl]);
  useEffect(() => () => woodMap.dispose(), [woodMap]);
  return <meshStandardMaterial map={woodMap} color="#ffffff" roughness={0.8} metalness={0} />;
}

function GoldHiddenPBRMaterial({
  surfaceKey,
  params,
  highlightSpecular = false,
  feedbackEnvMapBoost = 0,
}: {
  surfaceKey: string;
  params: GoldLumpParams;
  highlightSpecular?: boolean;
  feedbackEnvMapBoost?: number;
}) {
  return (
    <GoldLumpMaterial
      params={params}
      surfaceKey={surfaceKey}
      highlightSpecular={highlightSpecular}
      feedbackEnvMapBoost={feedbackEnvMapBoost}
    />
  );
}

function BlockMaterial({
  variant,
  debugNormalMaterial = false,
  woodSurfaceKey,
  semiGlossColor = SEMI_GLOSS_COLOR_HEX.pink,
}: {
  variant: BlockMaterialVariant;
  debugNormalMaterial?: boolean;
  /** 手続き木目・外部木目のセルごとのジッター用キー */
  woodSurfaceKey?: string;
  /** 質感 C 用の面色（ヘックス） */
  semiGlossColor?: string;
}) {
  if (debugNormalMaterial) return <meshNormalMaterial flatShading />;
  if (variant === "B") {
    return <BlockExternalWoodPBRMaterial surfaceKey={woodSurfaceKey ?? "wood-tex"} />;
  }
  if (variant === "A") {
    return <BlockWoodPBRMaterial surfaceKey={woodSurfaceKey ?? "wood-default"} />;
  }
  return <SemiGlossDustyMaterial color={semiGlossColor} />;
}

function FloorGrid({ gridSize }: { gridSize: number }) {
  /** 各 `<Line>` は2点のみ＝独立線分。drei の Line は points 全体が一本の折れ線になるため結合しない */
  const verticalSegments = useMemo(
    () =>
      Array.from({ length: gridSize + 1 }, (_, i) => [
        new THREE.Vector3(i, 0.002, 0),
        new THREE.Vector3(i, 0.002, gridSize),
      ]),
    [gridSize]
  );
  const horizontalSegments = useMemo(
    () =>
      Array.from({ length: gridSize + 1 }, (_, i) => [
        new THREE.Vector3(0, 0.002, i),
        new THREE.Vector3(gridSize, 0.002, i),
      ]),
    [gridSize]
  );
  const lineProps = {
    color: "#9ca3af" as const,
    lineWidth: 1,
    dashed: false,
    transparent: true,
    opacity: 0.45,
  };
  return (
    <group>
      {verticalSegments.map((points, i) => (
        <Line key={`floor-v-${i}`} points={points} {...lineProps} />
      ))}
      {horizontalSegments.map((points, i) => (
        <Line key={`floor-h-${i}`} points={points} {...lineProps} />
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[gridSize / 2, 0, gridSize / 2]}>
        <planeGeometry args={[gridSize + 0.24, gridSize + 0.24]} />
        <meshStandardMaterial color="#e8e4dc" roughness={0.95} metalness={0} transparent opacity={0.92} />
      </mesh>
    </group>
  );
}

function hash01(k: string): number {
  let h = 0;
  for (let i = 0; i < k.length; i++) h = (Math.imul(31, h) + k.charCodeAt(i)) | 0;
  return (h >>> 0) / 4294967296;
}

const INTRO_FALL_DUR_SEC = 1.45;
const INTRO_FALL_PORTION = 0.9;
/** 着地のわずかな跳ね：イントロ速さ（時間倍率）と独立した秒数 */
const INTRO_LAND_BOUNCE_REAL_SEC = 0.22;

function IntroBlocks({
  cells,
  materialVariant,
  onDone,
  gridSize,
  visualMeshScale,
  debugNormalMaterial,
  semiGlossColor,
  introFallTimeScale,
  introDropHeightScale,
}: {
  cells: { key: string; center: THREE.Vector3 }[];
  materialVariant: BlockMaterialVariant;
  onDone: () => void;
  gridSize: number;
  visualMeshScale: number;
  debugNormalMaterial?: boolean;
  semiGlossColor: string;
  introFallTimeScale: number;
  introDropHeightScale: number;
}) {
  const doneRef = useRef(false);
  const startRef = useRef<number | null>(null);

  const blockShadows = true;
  const meta = useMemo(
    () =>
      cells.map(({ key, center }) => {
        const h = hash01(key);
        const stagger = h * 0.55 + (parseKey(key).z * 0.08 + parseKey(key).x * 0.02);
        const dropExtra = (h - 0.5) * 0.35;
        const start = center
          .clone()
          .add(
            new THREE.Vector3(
              (h - 0.5) * 0.4,
              (gridSize * 1.7 + 0.4 + dropExtra) * introDropHeightScale,
              (hash01(key + "z") - 0.5) * 0.5
            )
          );
        return { key, center, stagger, start };
      }),
    [cells, gridSize, introDropHeightScale]
  );

  const introFinishTime = useMemo(() => {
    const scale = Math.max(introFallTimeScale, 0.001);
    let maxT = 0;
    for (const m of meta) {
      const fallEndRel = (INTRO_FALL_PORTION * INTRO_FALL_DUR_SEC) / scale;
      const end = m.stagger + fallEndRel + INTRO_LAND_BOUNCE_REAL_SEC;
      if (end > maxT) maxT = end;
    }
    return maxT + 0.12;
  }, [meta, introFallTimeScale]);

  const groupRefs = useRef<Map<string, THREE.Group>>(new Map());

  useFrame((state) => {
    if (doneRef.current) return;
    if (startRef.current === null) startRef.current = state.clock.elapsedTime;
    const t0 = startRef.current;
    const t = state.clock.elapsedTime - t0;
    const scale = introFallTimeScale;
    const dur = INTRO_FALL_DUR_SEC;
    const fallPortion = INTRO_FALL_PORTION;
    const fallEndRel = (fallPortion * dur) / Math.max(scale, 0.001);
    let all = true;
    for (const m of meta) {
      const tRel = t - m.stagger;
      const g = groupRefs.current.get(m.key);
      if (!g) continue;
      if (tRel < 0) {
        g.position.copy(m.start);
        all = false;
        continue;
      }
      const pos = m.start.clone();
      if (tRel < fallEndRel) {
        const u = THREE.MathUtils.clamp((tRel * scale) / dur, 0, fallPortion);
        const w = u / fallPortion;
        const e = w * w;
        pos.lerpVectors(m.start, m.center, e);
        all = false;
      } else if (tRel < fallEndRel + INTRO_LAND_BOUNCE_REAL_SEC) {
        pos.copy(m.center);
        const bounceT = tRel - fallEndRel;
        const v = Math.min(1, bounceT / INTRO_LAND_BOUNCE_REAL_SEC);
        const amp = 0.065 * (1 - v);
        pos.y += Math.sin(v * Math.PI) * amp;
        if (bounceT < INTRO_LAND_BOUNCE_REAL_SEC - 1e-5) all = false;
      } else {
        pos.copy(m.center);
      }
      g.position.copy(pos);
    }
    if (all && t >= introFinishTime) {
      doneRef.current = true;
      onDone();
    }
  });

  return (
    <>
      {meta.map(({ key, start }) => (
        <group key={key} ref={(r) => void (r ? groupRefs.current.set(key, r) : groupRefs.current.delete(key))} position={start.clone()}>
          {materialVariant === "C" ? (
            <RoundedBox
              args={[0.96, 0.96, 0.96]}
              radius={BLOCK_B_BEVEL_RADIUS}
              smoothness={BLOCK_B_BEVEL_SMOOTHNESS}
              castShadow={blockShadows}
              receiveShadow={blockShadows}
              scale={visualMeshScale}
            >
              <BlockMaterial
                variant={materialVariant}
                debugNormalMaterial={debugNormalMaterial}
                semiGlossColor={semiGlossColor}
              />
            </RoundedBox>
          ) : (
            <mesh castShadow={blockShadows} receiveShadow={blockShadows} scale={visualMeshScale}>
              <boxGeometry args={[0.96, 0.96, 0.96]} onUpdate={(g) => ensureFlatBoxVertexNormals(g)} />
              <BlockMaterial
                variant={materialVariant}
                debugNormalMaterial={debugNormalMaterial}
                woodSurfaceKey={isWoodLikeMaterial(materialVariant) ? key : undefined}
                semiGlossColor={semiGlossColor}
              />
            </mesh>
          )}
        </group>
      ))}
    </>
  );
}

function ThinkBlocks({
  cells,
  materialVariant,
  visualMeshScale,
  debugNormalMaterial,
  semiGlossColor,
}: {
  cells: { key: string; center: THREE.Vector3 }[];
  materialVariant: BlockMaterialVariant;
  visualMeshScale: number;
  debugNormalMaterial?: boolean;
  semiGlossColor: string;
}) {
  const blockShadows = true;
  return (
    <>
      {cells.map(({ key, center }) => (
        <group key={key} position={center}>
          {materialVariant === "C" ? (
            <RoundedBox
              args={[0.96, 0.96, 0.96]}
              radius={BLOCK_B_BEVEL_RADIUS}
              smoothness={BLOCK_B_BEVEL_SMOOTHNESS}
              castShadow={blockShadows}
              receiveShadow={blockShadows}
              scale={visualMeshScale}
            >
              <BlockMaterial
                variant={materialVariant}
                debugNormalMaterial={debugNormalMaterial}
                semiGlossColor={semiGlossColor}
              />
            </RoundedBox>
          ) : (
            <mesh castShadow={blockShadows} receiveShadow={blockShadows} scale={visualMeshScale}>
              <boxGeometry args={[0.96, 0.96, 0.96]} onUpdate={(g) => ensureFlatBoxVertexNormals(g)} />
              <BlockMaterial
                variant={materialVariant}
                debugNormalMaterial={debugNormalMaterial}
                woodSurfaceKey={isWoodLikeMaterial(materialVariant) ? key : undefined}
                semiGlossColor={semiGlossColor}
              />
            </mesh>
          )}
        </group>
      ))}
    </>
  );
}

function GhostBox({
  center,
  visualMeshScale,
  materialVariant,
  correctGoldFeedback,
  outlineOpacity,
}: {
  center: THREE.Vector3;
  visualMeshScale: number;
  materialVariant: BlockMaterialVariant;
  /** 正解時の金塊演出中はエッジを細いゴールドブラウンに */
  correctGoldFeedback?: boolean;
  /** 指定時は可視セル枠の不透明度（正誤判定デバッグ）。未指定は従来の木目／非木目で固定 */
  outlineOpacity?: number;
}) {
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(0.96, 0.96, 0.96)), []);
  const o = outlineOpacity != null ? THREE.MathUtils.clamp(outlineOpacity, 0.04, 0.85) : null;
  const edge = correctGoldFeedback
    ? ({ color: "#7a5e38" as const, opacity: 0.2 } as const)
    : o != null
      ? isWoodLikeMaterial(materialVariant)
        ? ({ color: "#0a0a0b" as const, opacity: o } as const)
        : ({ color: "#0f172a" as const, opacity: o } as const)
      : isWoodLikeMaterial(materialVariant)
        ? ({ color: "#0a0a0b" as const, opacity: 0.58 } as const)
        : ({ color: "#0f172a" as const, opacity: 0.48 } as const);
  return (
    <lineSegments position={center} geometry={edges} scale={visualMeshScale} renderOrder={1}>
      <lineBasicMaterial color={edge.color} transparent opacity={edge.opacity} depthTest depthWrite={false} />
    </lineSegments>
  );
}

function PhysFloor() {
  const [ref] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, 0, 0],
    material: "ground",
    friction: 0.9,
    restitution: 0.05,
    collisionFilterGroup: PHYS_LAYER_FLOOR,
    collisionFilterMask: PHYS_LAYER_STATIC_GOLD,
  }));
  return (
    <mesh ref={ref as unknown as RefObject<THREE.Mesh>} visible={false}>
      <planeGeometry args={[40, 40]} />
    </mesh>
  );
}

function StaticBlock({
  position,
  goldParams,
  visualMeshScale,
  useGoldMatcap,
  goldSurfaceKey,
  highlightGoldSpecular,
  feedbackGoldEnvMapBoost = 0,
  debugNormalMaterial,
}: {
  position: [number, number, number];
  goldParams: GoldLumpParams;
  visualMeshScale: number;
  /** 正解時：死角ブロックをマットな金系 PBR に */
  useGoldMatcap?: boolean;
  /** useGoldMatcap 時の明度ジッター用キー（セルキー） */
  goldSurfaceKey?: string;
  highlightGoldSpecular?: boolean;
  feedbackGoldEnvMapBoost?: number;
  debugNormalMaterial?: boolean;
}) {
  const [ref] = useBox(() => ({
    type: "Static",
    args: [0.48, 0.48, 0.48],
    position,
    material: "stack",
    friction: 0.75,
    restitution: 0.02,
    collisionFilterGroup: PHYS_LAYER_STATIC_GOLD,
    collisionFilterMask: PHYS_LAYER_FLOOR | PHYS_LAYER_DYNAMIC_VISIBLE,
  }));
  return (
    <group ref={ref as unknown as RefObject<THREE.Group>}>
      <mesh castShadow receiveShadow scale={visualMeshScale}>
        <boxGeometry args={[0.96, 0.96, 0.96]} onUpdate={(g) => ensureFlatBoxVertexNormals(g)} />
        {debugNormalMaterial ? (
          <meshNormalMaterial flatShading />
        ) : useGoldMatcap && goldSurfaceKey ? (
          <GoldHiddenPBRMaterial
            surfaceKey={goldSurfaceKey}
            params={goldParams}
            highlightSpecular={highlightGoldSpecular}
            feedbackEnvMapBoost={feedbackGoldEnvMapBoost}
          />
        ) : (
          <GoldLumpMaterial
            params={goldParams}
            surfaceKey={goldSurfaceKey ?? `${position.join("|")}|gold`}
            highlightSpecular={highlightGoldSpecular}
            feedbackEnvMapBoost={feedbackGoldEnvMapBoost}
          />
        )}
      </mesh>
    </group>
  );
}

function DynamicFallBlock({
  position,
  impulse,
  torque,
  materialVariant,
  pattern,
  visualMeshScale,
  debugNormalMaterial,
  surfaceKey,
  semiGlossColor,
}: {
  position: [number, number, number];
  impulse: [number, number, number];
  torque: [number, number, number];
  materialVariant: BlockMaterialVariant;
  pattern: CollapsePatternId;
  visualMeshScale: number;
  debugNormalMaterial?: boolean;
  /** 表示ブロックのセルキー（手続き木目のジッター用） */
  surfaceKey: string;
  semiGlossColor: string;
}) {
  const [ref, api] = useBox(() => ({
    mass: pattern === 3 ? 0.4 : 1.2,
    args: [0.48, 0.48, 0.48],
    position,
    material: "stack",
    linearDamping: pattern === 3 ? 0.85 : pattern === 2 ? 0.12 : 0.08,
    angularDamping: pattern === 3 ? 0.9 : 0.15,
    friction: 0.55,
    restitution: pattern === 1 ? 0.35 : 0.08,
    collisionFilterGroup: PHYS_LAYER_DYNAMIC_VISIBLE,
    collisionFilterMask: PHYS_LAYER_STATIC_GOLD | PHYS_LAYER_DYNAMIC_VISIBLE,
  }));

  const visualRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    api.applyImpulse(impulse, [0, 0, 0]);
    const av = api as unknown as { angularVelocity?: { set: (x: number, y: number, z: number) => void } };
    av.angularVelocity?.set(torque[0], torque[1], torque[2]);
  }, [api, impulse, torque]);

  const woodMap = useMemo(() => (materialVariant === "A" ? createWoodTexture(256) : null), [materialVariant, surfaceKey]);
  const { gl } = useThree();
  useLayoutEffect(() => {
    if (woodMap) setWoodTextureMaxAnisotropy(woodMap, gl);
  }, [woodMap, gl]);
  useEffect(() => () => woodMap?.dispose(), [woodMap]);
  const matRef = useRef<THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial>(null);
  const t0Ref = useRef<number | null>(null);
  const visualMeshScaleRef = useRef(visualMeshScale);
  visualMeshScaleRef.current = visualMeshScale;
  useFrame((state, dt) => {
    if (t0Ref.current === null) t0Ref.current = state.clock.elapsedTime;
    const t = state.clock.elapsedTime - t0Ref.current;
    const mesh = visualRef.current;
    const m = matRef.current;
    if (pattern === 3 && mesh && t < FEEDBACK_FALL_FADE_START_SEC) {
      const s = mesh.scale.x * (1 - dt * 0.9);
      mesh.scale.setScalar(Math.max(0.05 * visualMeshScaleRef.current, s));
    }
    if (m) {
      if (t >= FEEDBACK_FALL_FADE_START_SEC) {
        m.transparent = true;
        const u = THREE.MathUtils.clamp((t - FEEDBACK_FALL_FADE_START_SEC) / FEEDBACK_FALL_FADE_DURATION_SEC, 0, 1);
        const base = pattern === 3 ? 0.95 : 1;
        m.opacity = base * (1 - u);
      }
    }
    if (mesh && t > FEEDBACK_FALL_FADE_START_SEC + FEEDBACK_FALL_FADE_DURATION_SEC + 0.08) {
      mesh.visible = false;
    }
  });

  const blockShadows = true;
  return (
    <group ref={ref as unknown as RefObject<THREE.Group>}>
      <mesh ref={visualRef} castShadow={blockShadows} receiveShadow={blockShadows} scale={visualMeshScale}>
        <boxGeometry args={[0.96, 0.96, 0.96]} onUpdate={(g) => ensureFlatBoxVertexNormals(g)} />
        {debugNormalMaterial ? (
          <meshNormalMaterial ref={matRef as never} flatShading transparent={pattern === 3} opacity={pattern === 3 ? 0.95 : 1} />
        ) : pattern === 3 && materialVariant === "C" ? (
          <meshStandardMaterial
            ref={matRef as never}
            color={semiGlossColor}
            roughness={0.38}
            metalness={0.06}
            transparent
            opacity={0.95}
          />
        ) : pattern === 3 && materialVariant === "B" ? (
          <DynamicExternalWoodMaterial surfaceKey={surfaceKey} pattern={pattern} matRef={matRef} />
        ) : pattern === 3 && materialVariant === "A" && woodMap ? (
          <meshStandardMaterial
            ref={matRef as never}
            map={woodMap}
            color="#ffffff"
            roughness={0.8}
            metalness={0}
            transparent
            opacity={0.95}
          />
        ) : pattern === 3 ? (
          <meshStandardMaterial ref={matRef as never} color="#c9a06c" roughness={0.88} transparent opacity={0.95} />
        ) : materialVariant === "B" ? (
          <DynamicExternalWoodMaterial surfaceKey={surfaceKey} pattern={pattern} matRef={matRef} />
        ) : materialVariant === "A" && woodMap ? (
          <meshStandardMaterial
            ref={matRef as never}
            map={woodMap}
            color="#ffffff"
            roughness={0.8}
            metalness={0}
          />
        ) : materialVariant === "C" ? (
          <meshStandardMaterial
            ref={matRef as never}
            color={semiGlossColor}
            roughness={0.38}
            metalness={0.06}
          />
        ) : (
          <meshStandardMaterial ref={matRef as never} color="#c9a06c" roughness={0.88} metalness={0.06} />
        )}
      </mesh>
    </group>
  );
}

function FeedbackScene({
  puzzle,
  materialVariant,
  pattern,
  gridSize,
  goldLumpParams,
  visualMeshScale,
  feedbackAnswerCorrect,
  highlightGoldSpecular,
  goldEnvMapBoost = 0,
  debugNormalMaterial,
  semiGlossColor,
  feedbackImpulseScale = 1,
  feedbackVisibleCellOutlineOpacity = 0.1,
}: {
  puzzle: HiddenStackPuzzle;
  materialVariant: BlockMaterialVariant;
  pattern: CollapsePatternId;
  gridSize: number;
  goldLumpParams: GoldLumpParams;
  visualMeshScale: number;
  feedbackAnswerCorrect: boolean | null;
  highlightGoldSpecular?: boolean;
  goldEnvMapBoost?: number;
  debugNormalMaterial?: boolean;
  semiGlossColor: string;
  feedbackImpulseScale?: number;
  feedbackVisibleCellOutlineOpacity: number;
}) {
  const center = useMemo(() => lookAtForGrid(gridSize), [gridSize]);
  const [showFalling, setShowFalling] = useState(true);

  useEffect(() => {
    setShowFalling(true);
    const ms = Math.ceil((FEEDBACK_FALL_FADE_START_SEC + FEEDBACK_FALL_FADE_DURATION_SEC + 0.15) * 1000);
    const id = window.setTimeout(() => {
      setShowFalling(false);
    }, ms);
    return () => {
      window.clearTimeout(id);
    };
  }, [puzzle.sourceSeed, pattern]);

  const impulses = useMemo(() => {
    const out: { key: string; impulse: [number, number, number]; torque: [number, number, number]; pos: [number, number, number] }[] = [];
    for (const k of Array.from(puzzle.visibleKeys)) {
      const c = parseKey(k);
      const p = cellCenter(c);
      const dir = p.clone().sub(center);
      dir.y *= 0.85;
      if (dir.lengthSq() < 1e-6) dir.set((Math.random() - 0.5) * 2, 0.2, (Math.random() - 0.5) * 2);
      dir.normalize();
      let impulse: [number, number, number];
      let torque: [number, number, number];
      if (pattern === 1) {
        impulse = [dir.x * 9 + (Math.random() - 0.5) * 2, dir.y * 6 + 5, dir.z * 9 + (Math.random() - 0.5) * 2];
        torque = [(Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3];
      } else if (pattern === 2) {
        impulse = [(Math.random() - 0.5) * 1.2, -4.5 - Math.random() * 1.5, (Math.random() - 0.5) * 1.2];
        torque = [(Math.random() - 0.5) * 1.5, 0.1, (Math.random() - 0.5) * 1.5];
      } else {
        impulse = [dir.x * 0.8, -1.2, dir.z * 0.8];
        torque = [0.05, 0.02, 0.05];
      }
      const s = feedbackImpulseScale;
      impulse = [impulse[0] * s, impulse[1] * s, impulse[2] * s];
      torque = [torque[0] * s, torque[1] * s, torque[2] * s];
      out.push({
        key: k,
        impulse,
        torque,
        pos: [p.x, p.y, p.z],
      });
    }
    return out;
  }, [puzzle.visibleKeys, center, pattern, feedbackImpulseScale]);

  return (
    <>
      <PhysFloor />
      {Array.from(puzzle.visibleKeys).map((k) => (
        <GhostBox
          key={`g-${k}`}
          center={cellCenter(parseKey(k))}
          visualMeshScale={visualMeshScale}
          materialVariant={materialVariant}
          correctGoldFeedback={feedbackAnswerCorrect === true}
          outlineOpacity={feedbackVisibleCellOutlineOpacity}
        />
      ))}
      {Array.from(puzzle.hiddenKeys).map((k) => {
        const p = cellCenter(parseKey(k));
        return (
          <StaticBlock
            key={`h-${k}`}
            position={[p.x, p.y, p.z]}
            goldParams={goldLumpParams}
            visualMeshScale={visualMeshScale}
            useGoldMatcap={feedbackAnswerCorrect === true}
            goldSurfaceKey={k}
            highlightGoldSpecular={highlightGoldSpecular}
            feedbackGoldEnvMapBoost={goldEnvMapBoost}
            debugNormalMaterial={debugNormalMaterial}
          />
        );
      })}
      {showFalling &&
        impulses.map(({ key, impulse, torque, pos }) => (
          <DynamicFallBlock
            key={`d-${key}`}
            surfaceKey={key}
            position={pos}
            impulse={impulse}
            torque={torque}
            materialVariant={materialVariant}
            pattern={pattern}
            visualMeshScale={visualMeshScale}
            debugNormalMaterial={debugNormalMaterial}
            semiGlossColor={semiGlossColor}
          />
        ))}
    </>
  );
}

function ReviewScene({
  puzzle,
  materialVariant,
  goldLumpParams,
  feedbackAnswerCorrect,
  highlightGoldSpecular,
  reviewMeshVisualScale = 1,
  reviewShowVisibleSolids = true,
  reviewGhostOutlineOpacity = 0.1,
  debugNormalMaterial,
  semiGlossColor,
}: {
  puzzle: HiddenStackPuzzle;
  materialVariant: BlockMaterialVariant;
  goldLumpParams: GoldLumpParams;
  feedbackAnswerCorrect: boolean | null;
  highlightGoldSpecular?: boolean;
  reviewMeshVisualScale?: number;
  reviewShowVisibleSolids?: boolean;
  reviewGhostOutlineOpacity?: number;
  debugNormalMaterial?: boolean;
  semiGlossColor: string;
}) {
  const reviewVisibleScale = BLOCK_MESH_BASE_OVERLAP * 0.95 * reviewMeshVisualScale;
  /** 死角（金塊）はふりかえり用メッシュ倍率の対象外（反射・サイズを安定させる） */
  const reviewHiddenScale = BLOCK_MESH_BASE_OVERLAP * DEFAULT_BLOCK_MESH_VISUAL_SCALE;
  const blockShadows = true;
  return (
    <>
      {reviewShowVisibleSolids &&
        Array.from(puzzle.visibleKeys).map((k) => {
          const p = cellCenter(parseKey(k));
          return (
            <group key={`rv-${k}`} position={[p.x, p.y, p.z]}>
              {materialVariant === "C" ? (
                <RoundedBox
                  args={[0.96, 0.96, 0.96]}
                  radius={BLOCK_B_BEVEL_RADIUS}
                  smoothness={BLOCK_B_BEVEL_SMOOTHNESS}
                  castShadow={blockShadows}
                  receiveShadow={blockShadows}
                  scale={reviewVisibleScale}
                >
                  <BlockMaterial
                    variant={materialVariant}
                    debugNormalMaterial={debugNormalMaterial}
                    semiGlossColor={semiGlossColor}
                  />
                </RoundedBox>
              ) : (
                <mesh castShadow={blockShadows} receiveShadow={blockShadows} scale={reviewVisibleScale}>
                  <boxGeometry args={[0.96, 0.96, 0.96]} onUpdate={(g) => ensureFlatBoxVertexNormals(g)} />
                  <BlockMaterial
                    variant={materialVariant}
                    debugNormalMaterial={debugNormalMaterial}
                    woodSurfaceKey={isWoodLikeMaterial(materialVariant) ? k : undefined}
                    semiGlossColor={semiGlossColor}
                  />
                </mesh>
              )}
            </group>
          );
        })}
      {!reviewShowVisibleSolids &&
        Array.from(puzzle.visibleKeys).map((k) => (
          <GhostBox
            key={`rg-${k}`}
            center={cellCenter(parseKey(k))}
            visualMeshScale={reviewVisibleScale}
            materialVariant={materialVariant}
            correctGoldFeedback={feedbackAnswerCorrect === true}
            outlineOpacity={reviewGhostOutlineOpacity}
          />
        ))}
      {Array.from(puzzle.hiddenKeys).map((k) => {
        const p = cellCenter(parseKey(k));
        return (
          <group key={`rh-${k}`} position={[p.x, p.y, p.z]}>
            <mesh castShadow={blockShadows} receiveShadow={blockShadows} scale={reviewHiddenScale}>
              <boxGeometry args={[0.96, 0.96, 0.96]} onUpdate={(g) => ensureFlatBoxVertexNormals(g)} />
              {debugNormalMaterial ? (
                <meshNormalMaterial flatShading />
              ) : feedbackAnswerCorrect === true ? (
                <GoldHiddenPBRMaterial surfaceKey={k} params={goldLumpParams} highlightSpecular={highlightGoldSpecular} />
              ) : (
                <GoldLumpMaterial params={goldLumpParams} surfaceKey={k} highlightSpecular={highlightGoldSpecular} />
              )}
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function shortestAngleDeltaRad(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

function ReviewOrbitControls({
  gridSize,
  twistDeg,
  reviewAzimuthHintLimitDeg,
  onReviewAzimuthHintThresholdExceeded,
}: {
  gridSize: number;
  twistDeg: number;
  reviewAzimuthHintLimitDeg?: number;
  onReviewAzimuthHintThresholdExceeded?: () => void;
}) {
  const { camera, size } = useThree();
  const controlsRef = useRef<any>(null);
  const initializedRef = useRef(false);
  const lockedZoomRef = useRef<number | null>(null);
  const reviewHintInitialAzimuthRef = useRef<number | null>(null);
  const reviewHintExceededRef = useRef(false);
  const c = gridSize / 2;
  const look = useMemo(() => new THREE.Vector3(c, c, c), [c]);
  const fixedPolar = useMemo(() => Math.PI / 2 - (BASE_ELEVATION_DEG * Math.PI) / 180, []);

  const applyRigProjection = useCallback(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) return;
    const w = Math.max(1, size.width);
    const h = Math.max(1, size.height);
    const aspect = w / h;
    const raw = gridViewSpaceBBoxHalfExtents(camera, gridSize);
    const fit = orthoFrustumFromHalfExtents(raw.halfW * ORTHO_BBOX_MARGIN, raw.halfH * ORTHO_BBOX_MARGIN, aspect, gridSize);
    camera.left = -fit.hExtent;
    camera.right = fit.hExtent;
    camera.top = fit.vExtent;
    camera.bottom = -fit.vExtent;
    const zoomV = (ORTHO_STACK_VERTICAL_FILL * fit.vExtent) / raw.halfH;
    const zoomH = fit.hExtent / raw.halfW;
    if (lockedZoomRef.current == null) {
      lockedZoomRef.current = THREE.MathUtils.clamp(Math.min(zoomV, zoomH), 0.12, 14);
    }
    camera.zoom = lockedZoomRef.current;
    camera.updateProjectionMatrix();
  }, [camera, gridSize, size.width, size.height]);

  useEffect(() => {
    lockedZoomRef.current = null;
    if (initializedRef.current) return;
    if (!(camera instanceof THREE.OrthographicCamera)) return;
    const radiusScale = THREE.MathUtils.clamp(1.02 - 0.06 * Math.min(Math.max(1, size.width) / Math.max(1, size.height), 2.4), 0.84, 1.02);
    const p = cameraPositionForTwist(
      twistDeg,
      cameraRadiusForGrid(gridSize) * radiusScale,
      BASE_ELEVATION_DEG,
      BASE_AZIMUTH_DEG,
      look
    );
    camera.position.copy(p);
    camera.up.set(0, 1, 0);
    camera.lookAt(look);
    applyRigProjection();
    const ctrl = controlsRef.current;
    if (ctrl) {
      ctrl.target.copy(look);
      ctrl.minPolarAngle = fixedPolar;
      ctrl.maxPolarAngle = fixedPolar;
      ctrl.minAzimuthAngle = -Infinity;
      ctrl.maxAzimuthAngle = Infinity;
      ctrl.update();
    }
    initializedRef.current = true;
  }, [applyRigProjection, camera, fixedPolar, gridSize, look, size.height, size.width, twistDeg]);

  useFrame(() => {
    const ctrl = controlsRef.current;
    if (!ctrl || !(camera instanceof THREE.OrthographicCamera)) return;
    ctrl.target.copy(look);
    camera.lookAt(look);
    applyRigProjection();

    if (
      initializedRef.current &&
      onReviewAzimuthHintThresholdExceeded &&
      reviewAzimuthHintLimitDeg != null &&
      reviewAzimuthHintLimitDeg > 0 &&
      !reviewHintExceededRef.current
    ) {
      const getAz = ctrl.getAzimuthalAngle as (() => number) | undefined;
      if (typeof getAz !== "function") return;
      const cur = getAz.call(ctrl);
      if (reviewHintInitialAzimuthRef.current == null) {
        reviewHintInitialAzimuthRef.current = cur;
      } else {
        const limRad = (reviewAzimuthHintLimitDeg * Math.PI) / 180;
        const delta = shortestAngleDeltaRad(reviewHintInitialAzimuthRef.current, cur);
        if (Math.abs(delta) > limRad) {
          reviewHintExceededRef.current = true;
          onReviewAzimuthHintThresholdExceeded();
        }
      }
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan={false}
      enableZoom={false}
      enableDamping
      dampingFactor={0.08}
      target={[c, c, c]}
      minPolarAngle={fixedPolar}
      maxPolarAngle={fixedPolar}
      minAzimuthAngle={-Infinity}
      maxAzimuthAngle={Infinity}
    />
  );
}

function SceneLightingRig({
  gridSize,
  targetCenter,
  phase,
  reviewMode,
  ambientIntensity = 0.7,
  woodTexFillLightIntensity = 0.8,
  woodTexFillLightSecondaryIntensity = 0.9,
  woodTexRimLightIntensity = 0.5,
  enableWoodTexFill = false,
  spotlightParams,
  keyLightShadowYawDeg = 0,
  cameraTwistDeg = 0,
}: {
  gridSize: number;
  targetCenter: THREE.Vector3;
  phase: "intro" | "think" | "feedback";
  reviewMode: boolean;
  ambientIntensity?: number;
  woodTexFillLightIntensity?: number;
  woodTexFillLightSecondaryIntensity?: number;
  woodTexRimLightIntensity?: number;
  enableWoodTexFill?: boolean;
  spotlightParams: FeedbackSpotlightParams;
  keyLightShadowYawDeg?: number;
  /** RigCamera の twist（ふりかえり Orbit 時は 0）。影を盤面基準に固定するためキー光の水平角から差し引く */
  cameraTwistDeg?: number;
}) {
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const keyDirRef = useRef<THREE.DirectionalLight>(null);
  const fill1Ref = useRef<THREE.DirectionalLight>(null);
  const fill2Ref = useRef<THREE.DirectionalLight>(null);
  const rimRef = useRef<THREE.DirectionalLight>(null);
  const spotRef = useRef<THREE.SpotLight>(null);
  const followPointRef = useRef<THREE.PointLight>(null);
  const spotTargetRef = useRef<THREE.Object3D>(null);
  const feedbackStartRef = useRef<number | null>(null);

  const isFeedbackEffect = phase === "feedback" && !reviewMode;
  useEffect(() => {
    if (!isFeedbackEffect) feedbackStartRef.current = null;
  }, [isFeedbackEffect]);

  useEffect(() => {
    const s = spotRef.current;
    const t = spotTargetRef.current;
    if (!s || !t) return;
    s.target = t;
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (isFeedbackEffect && feedbackStartRef.current == null) feedbackStartRef.current = t;
    const elapsed = isFeedbackEffect && feedbackStartRef.current != null ? t - feedbackStartRef.current : 0;
    const fadeU = isFeedbackEffect ? THREE.MathUtils.clamp(elapsed / 0.5, 0, 1) : 0;
    const lightFactor = THREE.MathUtils.lerp(1, spotlightParams.overallLightRatio, fadeU);

    const apply = (l: { intensity: number } | null, base: number) => {
      if (!l) return;
      l.intensity = base * lightFactor;
    };
    apply(ambientRef.current, ambientIntensity);
    apply(keyDirRef.current, 0.8);
    apply(fill1Ref.current, enableWoodTexFill ? woodTexFillLightIntensity : 0);
    apply(fill2Ref.current, enableWoodTexFill ? woodTexFillLightSecondaryIntensity : 0);
    apply(rimRef.current, enableWoodTexFill ? woodTexRimLightIntensity : 0);

    const key = keyDirRef.current;
    if (key) {
      const anchor = lookAtForGrid(gridSize);
      const base = new THREE.Vector3(7, 12, 5).sub(anchor);
      const yawRad = ((keyLightShadowYawDeg - cameraTwistDeg) * Math.PI) / 180;
      base.applyAxisAngle(new THREE.Vector3(0, 1, 0), yawRad);
      key.position.copy(anchor).add(base);
      key.target.position.copy(targetCenter);
      key.target.updateMatrixWorld();
    }

    const spot = spotRef.current;
    const point = followPointRef.current;
    const tgt = spotTargetRef.current;
    if (!spot || !tgt) return;
    tgt.position.copy(targetCenter);
    tgt.updateMatrixWorld();
    if (!isFeedbackEffect || spotlightParams.spotIntensity <= 0) {
      spot.visible = false;
      if (point) point.visible = false;
      return;
    }
    spot.visible = true;
    const maxRange = Math.max(0, (spotlightParams.movementRangeDeg * Math.PI) / 180);
    const rawAngle = elapsed * spotlightParams.angularVelocity;
    const fullTurn = Math.PI * 2;
    /** 360° 以上なら連続1周（反射が周期的に通る）。未満なら従来どおり最大角で止まる */
    const angle =
      maxRange >= fullTurn - 1e-6 ? THREE.MathUtils.euclideanModulo(rawAngle, fullTurn) : Math.min(rawAngle, maxRange);
    const radius = gridSize * 2.1;
    /** 低めのスポット（従来 gridSize * 2.2 より下げて金塊へ当てやすく） */
    const height = gridSize * 1.32;
    const px = targetCenter.x + Math.cos(angle) * radius;
    const py = targetCenter.y + height;
    const pz = targetCenter.z + Math.sin(angle) * radius;
    spot.position.set(px, py, pz);
    spot.intensity = spotlightParams.spotIntensity;
    spot.angle = spotlightParams.spotAngle;
    spot.penumbra = 0.38;
    spot.decay = 2;
    spot.distance = gridSize * 8;
    /** 暖色スポット＋強めの既定（Intensity はパネルで調整） */
    spot.color.set("#ffcc8a");

    if (point) {
      point.visible = spotlightParams.followPointIntensity > 0;
      if (point.visible) {
        point.position.set(px, py, pz);
        point.intensity = spotlightParams.followPointIntensity;
        point.decay = 2;
        /** 狭いフォールオフ（距離を短め） */
        point.distance = Math.max(gridSize * 3.2, 2.5);
        point.color.set("#ffd4a8");
      }
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={ambientIntensity} />
      <directionalLight
        ref={keyDirRef}
        position={[7, 12, 5]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight ref={fill1Ref} position={[-8, 7, -6]} intensity={enableWoodTexFill ? woodTexFillLightIntensity : 0} color="#ffe3c5" />
      <directionalLight
        ref={fill2Ref}
        position={[8.5, 5.5, 6.5]}
        intensity={enableWoodTexFill ? woodTexFillLightSecondaryIntensity : 0}
        color="#f9e8d1"
      />
      <directionalLight ref={rimRef} position={[0.5, 8.5, -10]} intensity={enableWoodTexFill ? woodTexRimLightIntensity : 0} color="#fff2dc" />
      <spotLight ref={spotRef} visible={false} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} color="#ffcc8a" />
      <pointLight ref={followPointRef} visible={false} />
      <object3D ref={spotTargetRef} position={[targetCenter.x, targetCenter.y, targetCenter.z]} />
    </>
  );
}

export default function HiddenStackCanvas({
  phase,
  puzzle,
  twistDeg,
  materialVariant,
  collapsePattern,
  onIntroComplete,
  feedbackKey,
  goldLumpParams,
  blockMeshVisualScale = DEFAULT_BLOCK_MESH_VISUAL_SCALE,
  reviewBlockMeshVisualScale = 1,
  reviewMode = false,
  reviewShowVisibleSolids = true,
  reviewAzimuthHintLimitDeg,
  onReviewAzimuthHintThresholdExceeded,
  feedbackAnswerCorrect = null,
  debugNormalMaterial = false,
  externalWoodTextureIndex = 0,
  semiGlossColorId = "pink",
  ambientLightIntensity = 0.7,
  woodTexShadowLift = 0.7,
  woodTexRoughness = 0.9,
  woodTexEnvMapIntensity = 1.7,
  woodTexRepeatScale = 0.5,
  woodTexFillLightIntensity = 0.8,
  woodTexFillLightSecondaryIntensity = 0.9,
  woodTexRimLightIntensity = 0.5,
  feedbackSpotlightParams = {
    overallLightRatio: 0.32,
    spotIntensity: 40,
    spotAngle: 0.5,
    angularVelocity: 2.85,
    movementRangeDeg: 360,
    goldEnvMapBoost: 1.25,
    followPointIntensity: 18.5,
  },
  feedbackVisibleCellOutlineOpacity = 0.1,
  introFallTimeScale = 3,
  introDropHeightScale = 1,
  feedbackPhysicsGravityY = 16,
  feedbackImpulseScale = 1,
  keyLightShadowYawDeg = 14,
  orthoCameraZoomMul = 1,
}: HiddenStackCanvasProps) {
  const gridSize = puzzle.gridSize;
  const visualMeshScale = useMemo(() => BLOCK_MESH_BASE_OVERLAP * blockMeshVisualScale, [blockMeshVisualScale]);
  const cells = useMemo(
    () => puzzle.cells.map((c) => ({ key: cellKey(c), center: cellCenter(c) })),
    [puzzle.cells]
  );
  const spotlightTargetCenter = useMemo(() => {
    if (cells.length === 0) return lookAtForGrid(gridSize);
    const sum = new THREE.Vector3();
    for (const c of cells) sum.add(c.center);
    return sum.multiplyScalar(1 / cells.length);
  }, [cells, gridSize]);

  const onIntroDone = useCallback(() => {
    onIntroComplete();
  }, [onIntroComplete]);
  const isWalnutTexture = externalWoodTextureIndex <= 2;
  const effectiveWoodTexShadowLift = isWalnutTexture ? woodTexShadowLift : 0.42;
  const effectiveWoodTexRoughness = isWalnutTexture ? woodTexRoughness : 0.58;
  const effectiveWoodTexFillLight = isWalnutTexture ? woodTexFillLightIntensity : 1.2;
  const effectiveWoodTexFillLight2 = isWalnutTexture ? woodTexFillLightSecondaryIntensity : 0.38;
  const effectiveWoodTexRimLight = isWalnutTexture ? woodTexRimLightIntensity : 0.26;
  const semiGlossColor = SEMI_GLOSS_COLOR_HEX[semiGlossColorId];

  return (
    <Canvas
      className="!absolute inset-0 h-full w-full min-h-0 touch-none"
      orthographic
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false, logarithmicDepthBuffer: true }}
      camera={{ position: [0, 0, 1], near: 0.1, far: 320, zoom: 1 }}
    >
      <color attach="background" args={["#f1f5f9"]} />
      <SceneLightingRig
        gridSize={gridSize}
        targetCenter={spotlightTargetCenter}
        phase={phase}
        reviewMode={reviewMode}
        ambientIntensity={ambientLightIntensity}
        woodTexFillLightIntensity={effectiveWoodTexFillLight}
        woodTexFillLightSecondaryIntensity={effectiveWoodTexFillLight2}
        woodTexRimLightIntensity={effectiveWoodTexRimLight}
        enableWoodTexFill={materialVariant === "B"}
        spotlightParams={feedbackSpotlightParams}
        keyLightShadowYawDeg={keyLightShadowYawDeg}
        cameraTwistDeg={reviewMode ? 0 : twistDeg}
      />
      {reviewMode ? (
        <ReviewOrbitControls
          gridSize={gridSize}
          twistDeg={twistDeg}
          reviewAzimuthHintLimitDeg={reviewAzimuthHintLimitDeg}
          onReviewAzimuthHintThresholdExceeded={onReviewAzimuthHintThresholdExceeded}
        />
      ) : (
        <RigCamera twistDeg={twistDeg} gridSize={gridSize} orthoCameraZoomMul={orthoCameraZoomMul} />
      )}
      <GoldEnvMapBridge>
        <Suspense fallback={null}>
          <ExternalWoodTexturesBridge
            activeIndex={THREE.MathUtils.clamp(externalWoodTextureIndex, 0, EXTERNAL_WOOD_TEXTURE_PATHS.length - 1)}
            shadowLift={effectiveWoodTexShadowLift}
            roughness={effectiveWoodTexRoughness}
            envMapIntensity={woodTexEnvMapIntensity}
            repeatScale={woodTexRepeatScale}
          >
            <FloorGrid gridSize={gridSize} />
            {phase === "intro" && (
              <IntroBlocks
                cells={cells}
                materialVariant={materialVariant}
                onDone={onIntroDone}
                gridSize={gridSize}
                visualMeshScale={visualMeshScale}
                debugNormalMaterial={debugNormalMaterial}
                semiGlossColor={semiGlossColor}
                introFallTimeScale={introFallTimeScale}
                introDropHeightScale={introDropHeightScale}
              />
            )}
            {phase === "think" && (
              <ThinkBlocks
                cells={cells}
                materialVariant={materialVariant}
                visualMeshScale={visualMeshScale}
                debugNormalMaterial={debugNormalMaterial}
                semiGlossColor={semiGlossColor}
              />
            )}
            {phase === "feedback" && !reviewMode && (
              <Physics
                key={feedbackKey}
                gravity={[0, -Math.max(1, feedbackPhysicsGravityY), 0]}
                defaultContactMaterial={{ friction: 0.6, restitution: 0.12 }}
              >
                <FeedbackScene
                  puzzle={puzzle}
                  materialVariant={materialVariant}
                  pattern={collapsePattern}
                  gridSize={gridSize}
                  goldLumpParams={goldLumpParams}
                  visualMeshScale={visualMeshScale}
                  feedbackAnswerCorrect={feedbackAnswerCorrect}
                  highlightGoldSpecular
                  goldEnvMapBoost={feedbackSpotlightParams.goldEnvMapBoost}
                  debugNormalMaterial={debugNormalMaterial}
                  semiGlossColor={semiGlossColor}
                  feedbackImpulseScale={feedbackImpulseScale}
                  feedbackVisibleCellOutlineOpacity={feedbackVisibleCellOutlineOpacity}
                />
              </Physics>
            )}
            {phase === "feedback" && reviewMode && (
              <ReviewScene
                puzzle={puzzle}
                materialVariant={materialVariant}
                goldLumpParams={goldLumpParams}
                feedbackAnswerCorrect={feedbackAnswerCorrect}
                reviewMeshVisualScale={reviewBlockMeshVisualScale}
                reviewShowVisibleSolids={reviewShowVisibleSolids}
                reviewGhostOutlineOpacity={feedbackVisibleCellOutlineOpacity}
                debugNormalMaterial={debugNormalMaterial}
                semiGlossColor={semiGlossColor}
              />
            )}
          </ExternalWoodTexturesBridge>
        </Suspense>
      </GoldEnvMapBridge>
    </Canvas>
  );
}
