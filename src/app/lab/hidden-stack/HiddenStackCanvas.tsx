"use client";

import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Physics, useBox, usePlane } from "@react-three/cannon";
import * as THREE from "three";
import { Line, RoundedBox } from "@react-three/drei";
import type { HiddenStackPuzzle } from "@/lib/hidden-stack/hiddenStackPuzzle";
import { cameraPositionForTwist, cellCenter, cellKey, parseKey } from "@/lib/hidden-stack/hiddenStackPuzzle";

/** 物理ボディ（半辺 0.48）はそのままに、メッシュ同士の接線付近の背景露出だけを塞ぐ */
const BLOCK_MESH_OVERLAP_SCALE = 1.002;

export type BlockMaterialVariant = "A" | "B" | "C";
export type CollapsePatternId = 1 | 2 | 3;

type HiddenStackCanvasProps = {
  phase: "intro" | "think" | "feedback";
  puzzle: HiddenStackPuzzle;
  twistDeg: number;
  materialVariant: BlockMaterialVariant;
  collapsePattern: CollapsePatternId;
  onIntroComplete: () => void;
  feedbackKey: number;
};

function lookAtForGrid(gridSize: number): THREE.Vector3 {
  const c = gridSize / 2;
  return new THREE.Vector3(c, c, c);
}

function cameraRadiusForGrid(gridSize: number): number {
  return gridSize * 3.1;
}

function RigCamera({ twistDeg, gridSize }: { twistDeg: number; gridSize: number }) {
  const { camera } = useThree();
  const look = useMemo(() => lookAtForGrid(gridSize), [gridSize]);
  useFrame(() => {
    const p = cameraPositionForTwist(twistDeg, cameraRadiusForGrid(gridSize), 35, 48, look);
    camera.position.copy(p);
    camera.up.set(0, 1, 0);
    camera.lookAt(look);
  });
  return null;
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
}: {
  cells: { key: string; center: THREE.Vector3 }[];
  materialVariant: BlockMaterialVariant;
  onDone: () => void;
  gridSize: number;
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
    const dur = 1.65;
    let all = true;
    for (const m of meta) {
      const u = THREE.MathUtils.clamp((t - m.stagger) / dur, 0, 1);
      const e = 1 - Math.pow(1 - u, 3);
      const g = groupRefs.current.get(m.key);
      if (!g) continue;
      g.position.lerpVectors(m.start, m.center, e);
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
              radius={0.07}
              smoothness={3}
              castShadow
              receiveShadow
              scale={BLOCK_MESH_OVERLAP_SCALE}
            >
              <BlockMaterial variant={materialVariant} />
            </RoundedBox>
          ) : (
            <mesh castShadow receiveShadow scale={BLOCK_MESH_OVERLAP_SCALE}>
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
}: {
  cells: { key: string; center: THREE.Vector3 }[];
  materialVariant: BlockMaterialVariant;
}) {
  return (
    <>
      {cells.map(({ key, center }) => (
        <group key={key} position={center}>
          {materialVariant === "B" ? (
            <RoundedBox
              args={[0.96, 0.96, 0.96]}
              radius={0.07}
              smoothness={3}
              castShadow
              receiveShadow
              scale={BLOCK_MESH_OVERLAP_SCALE}
            >
              <BlockMaterial variant={materialVariant} />
            </RoundedBox>
          ) : (
            <mesh castShadow receiveShadow scale={BLOCK_MESH_OVERLAP_SCALE}>
              <boxGeometry args={[0.96, 0.96, 0.96]} />
              <BlockMaterial variant={materialVariant} />
            </mesh>
          )}
        </group>
      ))}
    </>
  );
}

function GhostBox({ center }: { center: THREE.Vector3 }) {
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(0.96, 0.96, 0.96)), []);
  return (
    <lineSegments position={center} geometry={edges} scale={BLOCK_MESH_OVERLAP_SCALE}>
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
  materialVariant,
}: {
  position: [number, number, number];
  materialVariant: BlockMaterialVariant;
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
      <mesh castShadow receiveShadow scale={BLOCK_MESH_OVERLAP_SCALE}>
        <boxGeometry args={[0.96, 0.96, 0.96]} />
        <BlockMaterial variant={materialVariant} />
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
}: {
  position: [number, number, number];
  impulse: [number, number, number];
  torque: [number, number, number];
  materialVariant: BlockMaterialVariant;
  pattern: CollapsePatternId;
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
  useFrame((_, dt) => {
    if (pattern !== 3 || !matRef.current) return;
    const m = matRef.current;
    m.opacity = Math.max(0, (m.opacity ?? 0.9) - dt * 1.1);
    const mesh = visualRef.current;
    if (mesh) {
      const s = mesh.scale.x * (1 - dt * 0.9);
      mesh.scale.setScalar(Math.max(0.05, s));
    }
  });

  return (
    <group ref={ref as unknown as RefObject<THREE.Group>}>
      <mesh ref={visualRef} castShadow receiveShadow scale={BLOCK_MESH_OVERLAP_SCALE}>
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
        ) : (
          <BlockMaterial variant={materialVariant} />
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
}: {
  puzzle: HiddenStackPuzzle;
  materialVariant: BlockMaterialVariant;
  pattern: CollapsePatternId;
  gridSize: number;
}) {
  const center = useMemo(() => lookAtForGrid(gridSize), [gridSize]);
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
        <GhostBox key={`g-${k}`} center={cellCenter(parseKey(k))} />
      ))}
      {Array.from(puzzle.hiddenKeys).map((k) => {
        const p = cellCenter(parseKey(k));
        return <StaticBlock key={`h-${k}`} position={[p.x, p.y, p.z]} materialVariant={materialVariant} />;
      })}
      {impulses.map(({ key, impulse, torque, pos }) => (
        <DynamicFallBlock key={`d-${key}`} position={pos} impulse={impulse} torque={torque} materialVariant={materialVariant} pattern={pattern} />
      ))}
    </>
  );
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 10, 4]} intensity={1.05} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <hemisphereLight args={["#f8fafc", "#44403c", 0.35]} />
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
}: HiddenStackCanvasProps) {
  const gridSize = puzzle.gridSize;
  const cells = useMemo(
    () => puzzle.cells.map((c) => ({ key: cellKey(c), center: cellCenter(c) })),
    [puzzle.cells]
  );

  const onIntroDone = useCallback(() => {
    onIntroComplete();
  }, [onIntroComplete]);

  return (
    <Canvas
      className="h-full w-full min-h-0 touch-none"
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false }}
      camera={{ fov: 37, near: 0.1, far: 120 }}
    >
      <color attach="background" args={["#f1f5f9"]} />
      <Lights />
      <RigCamera twistDeg={twistDeg} gridSize={gridSize} />
      <FloorGrid gridSize={gridSize} />
      {phase === "intro" && <IntroBlocks cells={cells} materialVariant={materialVariant} onDone={onIntroDone} gridSize={gridSize} />}
      {phase === "think" && <ThinkBlocks cells={cells} materialVariant={materialVariant} />}
      {phase === "feedback" && (
        <Physics key={feedbackKey} gravity={[0, -16, 0]} defaultContactMaterial={{ friction: 0.6, restitution: 0.12 }}>
          <FeedbackScene puzzle={puzzle} materialVariant={materialVariant} pattern={collapsePattern} gridSize={gridSize} />
        </Physics>
      )}
    </Canvas>
  );
}
