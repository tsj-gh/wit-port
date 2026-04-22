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
import type { HiddenStackPuzzle } from "@/lib/hidden-stack/hiddenStackPuzzle";
import { createWoodTexture, setWoodTextureMaxAnisotropy } from "@/lib/hidden-stack/createWoodTexture";
import { EXTERNAL_WOOD_TEXTURE_PATHS, cloneExternalWoodTextureForMesh } from "@/lib/hidden-stack/externalWoodTextures";
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

const DEFAULT_BLOCK_MESH_VISUAL_SCALE = 1.05;
const BASE_ELEVATION_DEG = 31;
const BASE_AZIMUTH_DEG = 44;

export type BlockMaterialVariant = "A" | "B" | "C" | "Wood01" | "WoodTex";

function isWoodLikeMaterial(v: BlockMaterialVariant): boolean {
  return v === "Wood01" || v === "WoodTex";
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
      offsetU: Math.random(),
      offsetV: Math.random(),
      rotationQuarters: Math.floor(Math.random() * 4),
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
      offsetU: Math.random(),
      offsetV: Math.random(),
      rotationQuarters: Math.floor(Math.random() * 4),
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
  color: string;
  metalness: number;
  roughness: number;
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
  /** ふりかえりモード中は崩落を止めて静止表示＋自由回転 */
  reviewMode?: boolean;
  /** ふりかえり時の回転誘導：この角度（deg）を初期方位から超えたらコールバックを一度だけ呼ぶ */
  reviewAzimuthHintLimitDeg?: number;
  onReviewAzimuthHintThresholdExceeded?: () => void;
  /** 直近の解答が正解のとき、死角の「金塊」をマットな金系 PBR に切り替え（feedback / review 共通） */
  feedbackAnswerCorrect?: boolean | null;
  /** 法線確認デバッグ用: 全ブロックを MeshNormalMaterial で描画 */
  debugNormalMaterial?: boolean;
  /** 外部木目テクスチャ（0=Walnut01 … 5=Oak03）。WoodTex のみ描画に使用 */
  externalWoodTextureIndex?: number;
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

function RigCamera({ twistDeg, gridSize }: { twistDeg: number; gridSize: number }) {
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
    const zoom = THREE.MathUtils.clamp(Math.min(zoomV, zoomH), 0.12, 14);
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
  });
  return null;
}

function GoldLumpMaterial({ params, envMapIntensity = 1.35 }: { params: GoldLumpParams; envMapIntensity?: number }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const color = useMemo(() => {
    try {
      return new THREE.Color(params.color).getStyle();
    } catch {
      return "#e7b008";
    }
  }, [params.color]);

  useEffect(() => {
    const m = matRef.current;
    if (!m) return;
    m.needsUpdate = true;
  }, [params.color, params.metalness, params.roughness, color, envMapIntensity]);

  return (
    <meshStandardMaterial
      ref={matRef}
      color={color}
      metalness={params.metalness}
      roughness={params.roughness}
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

function GoldHiddenPBRMaterial({ surfaceKey }: { surfaceKey: string }) {
  const colorHex = useMemo(() => {
    const c = new THREE.Color("#fff8e7");
    c.offsetHSL(0, 0, (Math.random() - 0.5) * 0.1);
    return `#${c.getHexString()}`;
  }, [surfaceKey]);
  return <meshStandardMaterial color={colorHex} roughness={0.8} metalness={0} />;
}

function BlockMaterial({
  variant,
  debugNormalMaterial = false,
  woodSurfaceKey,
}: {
  variant: BlockMaterialVariant;
  debugNormalMaterial?: boolean;
  /** Wood01 のときセルキー等（手続き木目テクスチャの個体用） */
  woodSurfaceKey?: string;
}) {
  if (debugNormalMaterial) return <meshNormalMaterial flatShading />;
  if (variant === "WoodTex") {
    return <BlockExternalWoodPBRMaterial surfaceKey={woodSurfaceKey ?? "wood-tex"} />;
  }
  if (variant === "Wood01") {
    return <BlockWoodPBRMaterial surfaceKey={woodSurfaceKey ?? "wood-default"} />;
  }
  if (variant === "A") {
    return <meshStandardMaterial color="#c9a06c" roughness={0.88} metalness={0.06} />;
  }
  if (variant === "B") {
    return <meshPhysicalMaterial color="#f6b8c6" roughness={0.32} metalness={0} clearcoat={0.35} clearcoatRoughness={0.4} />;
  }
  return (
    <meshPhysicalMaterial
      color="#bcd4e6"
      roughness={0.5}
      metalness={0}
      transmission={0.38}
      thickness={0.75}
      transparent
      opacity={0.9}
    />
  );
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

function IntroBlocks({
  cells,
  materialVariant,
  onDone,
  gridSize,
  visualMeshScale,
  debugNormalMaterial,
}: {
  cells: { key: string; center: THREE.Vector3 }[];
  materialVariant: BlockMaterialVariant;
  onDone: () => void;
  gridSize: number;
  visualMeshScale: number;
  debugNormalMaterial?: boolean;
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
          .add(new THREE.Vector3((h - 0.5) * 0.4, gridSize * 1.7 + 0.4 + dropExtra, (hash01(key + "z") - 0.5) * 0.5));
        return { key, center, stagger, start };
      }),
    [cells, gridSize]
  );

  const groupRefs = useRef<Map<string, THREE.Group>>(new Map());

  useFrame((state) => {
    if (doneRef.current) return;
    if (startRef.current === null) startRef.current = state.clock.elapsedTime;
    const t0 = startRef.current;
    const t = state.clock.elapsedTime - t0;
    const dur = 1.45;
    /** 等加速度に近い ease-in（従来の ease-out は着地手前で不自然に減速する） */
    const fallPortion = 0.9;
    let all = true;
    for (const m of meta) {
      const u = THREE.MathUtils.clamp((t - m.stagger) / dur, 0, 1);
      const g = groupRefs.current.get(m.key);
      if (!g) continue;
      const pos = m.start.clone();
      if (u < fallPortion) {
        const w = u / fallPortion;
        const e = w * w;
        pos.lerpVectors(m.start, m.center, e);
      } else {
        pos.copy(m.center);
        const v = (u - fallPortion) / (1 - fallPortion);
        const amp = 0.065 * (1 - v);
        pos.y += Math.sin(v * Math.PI) * amp;
      }
      if (u >= 1) pos.copy(m.center);
      g.position.copy(pos);
      if (u < 1) all = false;
    }
    if (all && t > dur + 0.2) {
      doneRef.current = true;
      onDone();
    }
  });

  return (
    <>
      {meta.map(({ key, start }) => (
        <group key={key} ref={(r) => void (r ? groupRefs.current.set(key, r) : groupRefs.current.delete(key))} position={start.clone()}>
          {materialVariant === "B" ? (
            <RoundedBox
              args={[0.96, 0.96, 0.96]}
              radius={BLOCK_B_BEVEL_RADIUS}
              smoothness={BLOCK_B_BEVEL_SMOOTHNESS}
              castShadow={blockShadows}
              receiveShadow={blockShadows}
              scale={visualMeshScale}
            >
              <BlockMaterial variant={materialVariant} debugNormalMaterial={debugNormalMaterial} />
            </RoundedBox>
          ) : (
            <mesh castShadow={blockShadows} receiveShadow={blockShadows} scale={visualMeshScale}>
              <boxGeometry args={[0.96, 0.96, 0.96]} onUpdate={(g) => ensureFlatBoxVertexNormals(g)} />
              <BlockMaterial
                variant={materialVariant}
                debugNormalMaterial={debugNormalMaterial}
                woodSurfaceKey={isWoodLikeMaterial(materialVariant) ? key : undefined}
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
}: {
  cells: { key: string; center: THREE.Vector3 }[];
  materialVariant: BlockMaterialVariant;
  visualMeshScale: number;
  debugNormalMaterial?: boolean;
}) {
  const blockShadows = true;
  return (
    <>
      {cells.map(({ key, center }) => (
        <group key={key} position={center}>
          {materialVariant === "B" ? (
            <RoundedBox
              args={[0.96, 0.96, 0.96]}
              radius={BLOCK_B_BEVEL_RADIUS}
              smoothness={BLOCK_B_BEVEL_SMOOTHNESS}
              castShadow={blockShadows}
              receiveShadow={blockShadows}
              scale={visualMeshScale}
            >
              <BlockMaterial variant={materialVariant} debugNormalMaterial={debugNormalMaterial} />
            </RoundedBox>
          ) : (
            <mesh castShadow={blockShadows} receiveShadow={blockShadows} scale={visualMeshScale}>
              <boxGeometry args={[0.96, 0.96, 0.96]} onUpdate={(g) => ensureFlatBoxVertexNormals(g)} />
              <BlockMaterial
                variant={materialVariant}
                debugNormalMaterial={debugNormalMaterial}
                woodSurfaceKey={isWoodLikeMaterial(materialVariant) ? key : undefined}
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
}: {
  center: THREE.Vector3;
  visualMeshScale: number;
  materialVariant: BlockMaterialVariant;
  /** 正解時の金塊演出中はエッジを細いゴールドブラウンに */
  correctGoldFeedback?: boolean;
}) {
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(0.96, 0.96, 0.96)), []);
  const edge = correctGoldFeedback
    ? ({ color: "#7a5e38" as const, opacity: 0.2 } as const)
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
  goldEnvMapIntensity,
  useGoldMatcap,
  goldSurfaceKey,
  debugNormalMaterial,
}: {
  position: [number, number, number];
  goldParams: GoldLumpParams;
  visualMeshScale: number;
  goldEnvMapIntensity?: number;
  /** 正解時：死角ブロックをマットな金系 PBR に */
  useGoldMatcap?: boolean;
  /** useGoldMatcap 時の明度ジッター用キー（セルキー） */
  goldSurfaceKey?: string;
  debugNormalMaterial?: boolean;
}) {
  const [ref] = useBox(() => ({
    type: "Static",
    args: [0.48, 0.48, 0.48],
    position,
    material: "stack",
    friction: 0.75,
    restitution: 0.02,
  }));
  return (
    <group ref={ref as unknown as RefObject<THREE.Group>}>
      <mesh castShadow receiveShadow scale={visualMeshScale}>
        <boxGeometry args={[0.96, 0.96, 0.96]} onUpdate={(g) => ensureFlatBoxVertexNormals(g)} />
        {debugNormalMaterial ? (
          <meshNormalMaterial flatShading />
        ) : useGoldMatcap && goldSurfaceKey ? (
          <GoldHiddenPBRMaterial surfaceKey={goldSurfaceKey} />
        ) : (
          <GoldLumpMaterial params={goldParams} envMapIntensity={goldEnvMapIntensity} />
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
}: {
  position: [number, number, number];
  impulse: [number, number, number];
  torque: [number, number, number];
  materialVariant: BlockMaterialVariant;
  pattern: CollapsePatternId;
  visualMeshScale: number;
  debugNormalMaterial?: boolean;
  /** 表示ブロックのセルキー（Wood01 の色ジッター用） */
  surfaceKey: string;
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
  }));

  const visualRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    api.applyImpulse(impulse, [0, 0, 0]);
    const av = api as unknown as { angularVelocity?: { set: (x: number, y: number, z: number) => void } };
    av.angularVelocity?.set(torque[0], torque[1], torque[2]);
  }, [api, impulse, torque]);

  const woodMap = useMemo(() => (materialVariant === "Wood01" ? createWoodTexture(256) : null), [materialVariant, surfaceKey]);
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
        const base =
          pattern === 3 && materialVariant === "C"
            ? 0.9
            : pattern === 3 && materialVariant === "B"
              ? 0.95
              : pattern === 3
                ? 0.95
                : 1;
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
          <meshPhysicalMaterial
            ref={matRef as never}
            color="#bcd4e6"
            roughness={0.5}
            metalness={0}
            transmission={0.38}
            thickness={0.75}
            transparent
            opacity={0.9}
          />
        ) : pattern === 3 && materialVariant === "B" ? (
          <meshPhysicalMaterial
            ref={matRef as never}
            color="#f6b8c6"
            roughness={0.32}
            metalness={0}
            clearcoat={0.35}
            transparent
            opacity={0.95}
          />
        ) : materialVariant === "Wood01" && woodMap ? (
          <meshStandardMaterial
            ref={matRef as never}
            map={woodMap}
            color="#ffffff"
            roughness={0.8}
            metalness={0}
            transparent={pattern === 3}
            opacity={pattern === 3 ? 0.95 : 1}
          />
        ) : materialVariant === "WoodTex" ? (
          <DynamicExternalWoodMaterial surfaceKey={surfaceKey} pattern={pattern} matRef={matRef} />
        ) : pattern === 3 ? (
          <meshStandardMaterial ref={matRef as never} color="#c9a06c" roughness={0.88} transparent opacity={0.95} />
        ) : materialVariant === "A" ? (
          <meshStandardMaterial ref={matRef as never} color="#c9a06c" roughness={0.88} metalness={0.06} />
        ) : materialVariant === "B" ? (
          <meshPhysicalMaterial
            ref={matRef as never}
            color="#f6b8c6"
            roughness={0.32}
            metalness={0}
            clearcoat={0.35}
            clearcoatRoughness={0.4}
          />
        ) : (
          <meshPhysicalMaterial
            ref={matRef as never}
            color="#bcd4e6"
            roughness={0.5}
            metalness={0}
            transmission={0.38}
            thickness={0.75}
            transparent
            opacity={0.9}
          />
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
  debugNormalMaterial,
}: {
  puzzle: HiddenStackPuzzle;
  materialVariant: BlockMaterialVariant;
  pattern: CollapsePatternId;
  gridSize: number;
  goldLumpParams: GoldLumpParams;
  visualMeshScale: number;
  feedbackAnswerCorrect: boolean | null;
  debugNormalMaterial?: boolean;
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
      out.push({
        key: k,
        impulse,
        torque,
        pos: [p.x, p.y, p.z],
      });
    }
    return out;
  }, [puzzle.visibleKeys, center, pattern]);

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
            goldEnvMapIntensity={isWoodLikeMaterial(materialVariant) ? 1.78 : 1.35}
            useGoldMatcap={feedbackAnswerCorrect === true}
            goldSurfaceKey={k}
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
  debugNormalMaterial,
}: {
  puzzle: HiddenStackPuzzle;
  materialVariant: BlockMaterialVariant;
  goldLumpParams: GoldLumpParams;
  feedbackAnswerCorrect: boolean | null;
  debugNormalMaterial?: boolean;
}) {
  const reviewVisibleScale = BLOCK_MESH_BASE_OVERLAP * 0.95;
  const reviewHiddenScale = BLOCK_MESH_BASE_OVERLAP * DEFAULT_BLOCK_MESH_VISUAL_SCALE;
  const blockShadows = true;
  return (
    <>
      {Array.from(puzzle.visibleKeys).map((k) => {
        const p = cellCenter(parseKey(k));
        return (
          <group key={`rv-${k}`} position={[p.x, p.y, p.z]}>
            {materialVariant === "B" ? (
              <RoundedBox
                args={[0.96, 0.96, 0.96]}
                radius={BLOCK_B_BEVEL_RADIUS}
                smoothness={BLOCK_B_BEVEL_SMOOTHNESS}
                castShadow={blockShadows}
                receiveShadow={blockShadows}
                scale={reviewVisibleScale}
              >
                <BlockMaterial variant={materialVariant} debugNormalMaterial={debugNormalMaterial} />
              </RoundedBox>
            ) : (
              <mesh castShadow={blockShadows} receiveShadow={blockShadows} scale={reviewVisibleScale}>
                <boxGeometry args={[0.96, 0.96, 0.96]} onUpdate={(g) => ensureFlatBoxVertexNormals(g)} />
                <BlockMaterial
                  variant={materialVariant}
                  debugNormalMaterial={debugNormalMaterial}
                  woodSurfaceKey={isWoodLikeMaterial(materialVariant) ? k : undefined}
                />
              </mesh>
            )}
          </group>
        );
      })}
      {Array.from(puzzle.hiddenKeys).map((k) => {
        const p = cellCenter(parseKey(k));
        return (
          <group key={`rh-${k}`} position={[p.x, p.y, p.z]}>
            <mesh castShadow={blockShadows} receiveShadow={blockShadows} scale={reviewHiddenScale}>
              <boxGeometry args={[0.96, 0.96, 0.96]} onUpdate={(g) => ensureFlatBoxVertexNormals(g)} />
              {debugNormalMaterial ? (
                <meshNormalMaterial flatShading />
              ) : feedbackAnswerCorrect === true ? (
                <GoldHiddenPBRMaterial surfaceKey={k} />
              ) : (
                <GoldLumpMaterial params={goldLumpParams} envMapIntensity={isWoodLikeMaterial(materialVariant) ? 1.78 : 1.35} />
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

function Lights({
  ambientIntensity = 0.7,
  woodTexFillLightIntensity = 0.8,
  woodTexFillLightSecondaryIntensity = 0.9,
  woodTexRimLightIntensity = 0.5,
  enableWoodTexFill = false,
}: {
  ambientIntensity?: number;
  woodTexFillLightIntensity?: number;
  woodTexFillLightSecondaryIntensity?: number;
  woodTexRimLightIntensity?: number;
  enableWoodTexFill?: boolean;
}) {
  return (
    <>
      <ambientLight intensity={ambientIntensity} />
      <directionalLight
        position={[7, 12, 5]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      {enableWoodTexFill && woodTexFillLightIntensity > 0 ? (
        <directionalLight position={[-8, 7, -6]} intensity={woodTexFillLightIntensity} color="#ffe3c5" />
      ) : null}
      {enableWoodTexFill && woodTexFillLightSecondaryIntensity > 0 ? (
        <directionalLight position={[8.5, 5.5, 6.5]} intensity={woodTexFillLightSecondaryIntensity} color="#f9e8d1" />
      ) : null}
      {enableWoodTexFill && woodTexRimLightIntensity > 0 ? (
        <directionalLight position={[0.5, 8.5, -10]} intensity={woodTexRimLightIntensity} color="#fff2dc" />
      ) : null}
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
  reviewMode = false,
  reviewAzimuthHintLimitDeg,
  onReviewAzimuthHintThresholdExceeded,
  feedbackAnswerCorrect = null,
  debugNormalMaterial = false,
  externalWoodTextureIndex = 0,
  ambientLightIntensity = 0.7,
  woodTexShadowLift = 0.7,
  woodTexRoughness = 0.9,
  woodTexEnvMapIntensity = 1.7,
  woodTexRepeatScale = 0.5,
  woodTexFillLightIntensity = 0.8,
  woodTexFillLightSecondaryIntensity = 0.9,
  woodTexRimLightIntensity = 0.5,
}: HiddenStackCanvasProps) {
  const gridSize = puzzle.gridSize;
  const visualMeshScale = useMemo(() => BLOCK_MESH_BASE_OVERLAP * blockMeshVisualScale, [blockMeshVisualScale]);
  const cells = useMemo(
    () => puzzle.cells.map((c) => ({ key: cellKey(c), center: cellCenter(c) })),
    [puzzle.cells]
  );

  const onIntroDone = useCallback(() => {
    onIntroComplete();
  }, [onIntroComplete]);
  const isWalnutTexture = externalWoodTextureIndex <= 2;
  const effectiveWoodTexShadowLift = isWalnutTexture ? woodTexShadowLift : 0.42;
  const effectiveWoodTexRoughness = isWalnutTexture ? woodTexRoughness : 0.58;
  const effectiveWoodTexFillLight = isWalnutTexture ? woodTexFillLightIntensity : 1.2;
  const effectiveWoodTexFillLight2 = isWalnutTexture ? woodTexFillLightSecondaryIntensity : 0.38;
  const effectiveWoodTexRimLight = isWalnutTexture ? woodTexRimLightIntensity : 0.26;

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
      <Lights
        ambientIntensity={ambientLightIntensity}
        woodTexFillLightIntensity={effectiveWoodTexFillLight}
        woodTexFillLightSecondaryIntensity={effectiveWoodTexFillLight2}
        woodTexRimLightIntensity={effectiveWoodTexRimLight}
        enableWoodTexFill={materialVariant === "WoodTex"}
      />
      {reviewMode ? (
        <ReviewOrbitControls
          gridSize={gridSize}
          twistDeg={twistDeg}
          reviewAzimuthHintLimitDeg={reviewAzimuthHintLimitDeg}
          onReviewAzimuthHintThresholdExceeded={onReviewAzimuthHintThresholdExceeded}
        />
      ) : (
        <RigCamera twistDeg={twistDeg} gridSize={gridSize} />
      )}
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
            />
          )}
          {phase === "think" && (
            <ThinkBlocks
              cells={cells}
              materialVariant={materialVariant}
              visualMeshScale={visualMeshScale}
              debugNormalMaterial={debugNormalMaterial}
            />
          )}
          {phase === "feedback" && !reviewMode && (
            <Physics key={feedbackKey} gravity={[0, -16, 0]} defaultContactMaterial={{ friction: 0.6, restitution: 0.12 }}>
              <FeedbackScene
                puzzle={puzzle}
                materialVariant={materialVariant}
                pattern={collapsePattern}
                gridSize={gridSize}
                goldLumpParams={goldLumpParams}
                visualMeshScale={visualMeshScale}
                feedbackAnswerCorrect={feedbackAnswerCorrect}
                debugNormalMaterial={debugNormalMaterial}
              />
            </Physics>
          )}
          {phase === "feedback" && reviewMode && (
            <ReviewScene
              puzzle={puzzle}
              materialVariant={materialVariant}
              goldLumpParams={goldLumpParams}
              feedbackAnswerCorrect={feedbackAnswerCorrect}
              debugNormalMaterial={debugNormalMaterial}
            />
          )}
        </ExternalWoodTexturesBridge>
      </Suspense>
    </Canvas>
  );
}
