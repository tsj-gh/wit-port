"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Physics, useBox, usePlane } from "@react-three/cannon";
import * as THREE from "three";
import { Environment, Line, RoundedBox } from "@react-three/drei";
import type { HiddenStackPuzzle } from "@/lib/hidden-stack/hiddenStackPuzzle";
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

export type BlockMaterialVariant = "A" | "B" | "C";
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
    const p = cameraPositionForTwist(twistDeg, cameraRadiusForGrid(gridSize) * radiusScale, 31, 44, look);
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

function GoldLumpMaterial({ params }: { params: GoldLumpParams }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const color = useMemo(() => {
    try {
      return new THREE.Color(params.color).getStyle();
    } catch {
      return "#FFC700";
    }
  }, [params.color]);

  useEffect(() => {
    const m = matRef.current;
    if (!m) return;
    m.needsUpdate = true;
  }, [params.color, params.metalness, params.roughness, color]);

  return (
    <meshStandardMaterial
      ref={matRef}
      color={color}
      metalness={params.metalness}
      roughness={params.roughness}
      envMapIntensity={2.25}
    />
  );
}

function BlockMaterial({ variant }: { variant: BlockMaterialVariant }) {
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
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= gridSize; i++) {
    pts.push(new THREE.Vector3(i, 0.002, 0), new THREE.Vector3(i, 0.002, gridSize));
    pts.push(new THREE.Vector3(0, 0.002, i), new THREE.Vector3(gridSize, 0.002, i));
  }
  return (
    <group>
      <Line points={pts} color="#9ca3af" lineWidth={1} dashed={false} transparent opacity={0.45} />
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
}: {
  cells: { key: string; center: THREE.Vector3 }[];
  materialVariant: BlockMaterialVariant;
  onDone: () => void;
  gridSize: number;
  visualMeshScale: number;
}) {
  const doneRef = useRef(false);
  const startRef = useRef<number | null>(null);

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
              castShadow
              receiveShadow
              scale={visualMeshScale}
            >
              <BlockMaterial variant={materialVariant} />
            </RoundedBox>
          ) : (
            <mesh castShadow receiveShadow scale={visualMeshScale}>
              <boxGeometry args={[0.96, 0.96, 0.96]} />
              <BlockMaterial variant={materialVariant} />
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
}: {
  cells: { key: string; center: THREE.Vector3 }[];
  materialVariant: BlockMaterialVariant;
  visualMeshScale: number;
}) {
  return (
    <>
      {cells.map(({ key, center }) => (
        <group key={key} position={center}>
          {materialVariant === "B" ? (
            <RoundedBox
              args={[0.96, 0.96, 0.96]}
              radius={BLOCK_B_BEVEL_RADIUS}
              smoothness={BLOCK_B_BEVEL_SMOOTHNESS}
              castShadow
              receiveShadow
              scale={visualMeshScale}
            >
              <BlockMaterial variant={materialVariant} />
            </RoundedBox>
          ) : (
            <mesh castShadow receiveShadow scale={visualMeshScale}>
              <boxGeometry args={[0.96, 0.96, 0.96]} />
              <BlockMaterial variant={materialVariant} />
            </mesh>
          )}
        </group>
      ))}
    </>
  );
}

function GhostBox({ center, visualMeshScale }: { center: THREE.Vector3; visualMeshScale: number }) {
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(0.96, 0.96, 0.96)), []);
  return (
    <lineSegments position={center} geometry={edges} scale={visualMeshScale}>
      <lineBasicMaterial color="#94a3b8" transparent opacity={0.35} />
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
}: {
  position: [number, number, number];
  goldParams: GoldLumpParams;
  visualMeshScale: number;
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
        <boxGeometry args={[0.96, 0.96, 0.96]} />
        <GoldLumpMaterial params={goldParams} />
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
}: {
  position: [number, number, number];
  impulse: [number, number, number];
  torque: [number, number, number];
  materialVariant: BlockMaterialVariant;
  pattern: CollapsePatternId;
  visualMeshScale: number;
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

  return (
    <group ref={ref as unknown as RefObject<THREE.Group>}>
      <mesh ref={visualRef} castShadow receiveShadow scale={visualMeshScale}>
        <boxGeometry args={[0.96, 0.96, 0.96]} />
        {pattern === 3 && materialVariant === "C" ? (
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
}: {
  puzzle: HiddenStackPuzzle;
  materialVariant: BlockMaterialVariant;
  pattern: CollapsePatternId;
  gridSize: number;
  goldLumpParams: GoldLumpParams;
  visualMeshScale: number;
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
        <GhostBox key={`g-${k}`} center={cellCenter(parseKey(k))} visualMeshScale={visualMeshScale} />
      ))}
      {Array.from(puzzle.hiddenKeys).map((k) => {
        const p = cellCenter(parseKey(k));
        return <StaticBlock key={`h-${k}`} position={[p.x, p.y, p.z]} goldParams={goldLumpParams} visualMeshScale={visualMeshScale} />;
      })}
      {showFalling &&
        impulses.map(({ key, impulse, torque, pos }) => (
          <DynamicFallBlock
            key={`d-${key}`}
            position={pos}
            impulse={impulse}
            torque={torque}
            materialVariant={materialVariant}
            pattern={pattern}
            visualMeshScale={visualMeshScale}
          />
        ))}
    </>
  );
}

function Lights({ gridSize }: { gridSize: number }) {
  const c = gridSize / 2;
  return (
    <>
      <ambientLight intensity={0.82} />
      <directionalLight
        position={[c + 5, c + 12, c + 4]}
        intensity={2.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight position={[c + 3, c * 2.8 + 6, c + 2.5]} intensity={1.35} decay={2} distance={0} color="#fff4dc" />
      <hemisphereLight args={["#f4f4f5", "#3f3a36", 0.48]} />
    </>
  );
}

/** 金属マテリアル用 IBL（PMREM）。背景色は `<color>` のまま */
function HiddenStackEnvironment() {
  return <Environment preset="studio" background={false} />;
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
      <HiddenStackEnvironment />
      <Lights gridSize={gridSize} />
      <RigCamera twistDeg={twistDeg} gridSize={gridSize} />
      <FloorGrid gridSize={gridSize} />
      {phase === "intro" && (
        <IntroBlocks
          cells={cells}
          materialVariant={materialVariant}
          onDone={onIntroDone}
          gridSize={gridSize}
          visualMeshScale={visualMeshScale}
        />
      )}
      {phase === "think" && <ThinkBlocks cells={cells} materialVariant={materialVariant} visualMeshScale={visualMeshScale} />}
      {phase === "feedback" && (
        <Physics key={feedbackKey} gravity={[0, -16, 0]} defaultContactMaterial={{ friction: 0.6, restitution: 0.12 }}>
          <FeedbackScene
            puzzle={puzzle}
            materialVariant={materialVariant}
            pattern={collapsePattern}
            gridSize={gridSize}
            goldLumpParams={goldLumpParams}
            visualMeshScale={visualMeshScale}
          />
        </Physics>
      )}
    </Canvas>
  );
}
