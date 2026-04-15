type Bubble = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  cruiseSpeed: number;
  radius: number;
  restitution: number;
  friction: number;
  damping: number;
  mass: number;
  animalIndex: number;
  squashX: number;
  squashY: number;
  squashTimer: number;
  tintColor: string;
};

type BurstParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  color: string;
  drag: number;
  fadePerSec: number;
};

type BurstRing = {
  x: number;
  y: number;
  radius: number;
  lineWidth: number;
  alpha: number;
  expandPerSec: number;
  fadePerSec: number;
  color: string;
};

type FallingAnimal = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  scale: number;
  pulseTime: number;
  life: number;
  animalIndex: number;
};

type SceneOptions = {
  canvas: HTMLCanvasElement;
  animalImages: HTMLImageElement[];
  onPlayPop: () => void;
  onBubbleCollision?: () => void;
};

const WAVE_DELAY_MS = 1000;
const DEFAULT_BUBBLE_COUNT = 4;
const MIN_BUBBLE_COUNT = 1;
const MAX_BUBBLE_COUNT = 8;

export type PopPopBubblesDebugConfig = {
  bubbleCount: number;
  bubbleSpeedScale: number;
  animalFallGravity: number;
  bubbleRestitution: number;
  /** はじけパーティクルの半径スケール（既定 1.5 ≒ 従来比 1.5 倍） */
  burstParticleSizeScale: number;
  /** モバイル時のバブル縮小補正（0=盤面比率そのまま, 1=縮小なし） */
  mobileBubbleScaleCompensation: number;
  /** はじけ後に落ちる内容物の描画スケール */
  fallingAnimalSizeScale: number;
  /** 割れリングの線幅倍率 */
  burstRingLineWidthScale: number;
  /** 割れリングの広がり速度倍率 */
  burstRingExpandSpeedScale: number;
  /** 割れリングの残像（shadowBlur） */
  burstRingShadowBlurPx: number;
};

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function parseHexColor(color: string): { r: number; g: number; b: number } | null {
  const m = color.trim().match(/^#([0-9a-f]{6})$/i);
  if (!m) return null;
  const hex = m[1]!;
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function brightenHex(color: string, amount: number): string {
  const rgb = parseHexColor(color);
  if (!rgb) return color;
  const mix = (v: number) => v + (255 - v) * amount;
  return `rgb(${clampByte(mix(rgb.r))}, ${clampByte(mix(rgb.g))}, ${clampByte(mix(rgb.b))})`;
}

function createBubbleTexture(size = 256): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return c;

  const r = size / 2;
  const ring = ctx.createRadialGradient(r * 0.78, r * 0.72, r * 0.1, r, r, r);
  ring.addColorStop(0, "rgba(255,255,255,0.45)");
  ring.addColorStop(0.45, "rgba(192,246,255,0.22)");
  ring.addColorStop(1, "rgba(120,192,255,0.12)");
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(r, r, r * 0.93, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = Math.max(2, size * 0.02);
  ctx.strokeStyle = "rgba(255,255,255,0.78)";
  ctx.beginPath();
  ctx.arc(r, r, r * 0.89, Math.PI * 0.15, Math.PI * 1.84);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.beginPath();
  ctx.ellipse(r * 0.62, r * 0.4, r * 0.2, r * 0.12, -0.5, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

export class PopPopBubblesScene {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly animalImages: HTMLImageElement[];
  private readonly bubbleTexture: HTMLCanvasElement;
  private readonly onPlayPop: () => void;
  private readonly onBubbleCollision?: () => void;

  private bubbles: Bubble[] = [];
  private particles: BurstParticle[] = [];
  private burstRings: BurstRing[] = [];
  private fallingAnimals: FallingAnimal[] = [];
  private running = false;
  private rafId = 0;
  private lastTs = 0;
  private width = 360;
  private height = 360;
  private dpr = 1;
  private waveTimer: ReturnType<typeof setTimeout> | null = null;
  private collisionAccumulator = 0;
  private idSeq = 0;
  private config: PopPopBubblesDebugConfig = {
    bubbleCount: DEFAULT_BUBBLE_COUNT,
    bubbleSpeedScale: 1,
    animalFallGravity: 500,
    bubbleRestitution: 0.86,
    burstParticleSizeScale: 1.5,
    mobileBubbleScaleCompensation: 0.55,
    fallingAnimalSizeScale: 1.5,
    burstRingLineWidthScale: 1,
    burstRingExpandSpeedScale: 1,
    burstRingShadowBlurPx: 10,
  };

  constructor(options: SceneOptions) {
    this.canvas = options.canvas;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("2D context unavailable");
    this.ctx = ctx;
    this.animalImages = options.animalImages;
    this.onPlayPop = options.onPlayPop;
    this.onBubbleCollision = options.onBubbleCollision;
    this.bubbleTexture = createBubbleTexture();
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.spawnWave();
    this.lastTs = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  public destroy(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.waveTimer) clearTimeout(this.waveTimer);
    this.waveTimer = null;
  }

  public resize(width: number, height: number): void {
    this.width = Math.max(280, width);
    this.height = Math.max(280, height);
    this.dpr = Math.max(1, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  public handlePointerDown(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i]!;
      const dx = x - b.x;
      const dy = y - b.y;
      if (dx * dx + dy * dy <= b.radius * b.radius) {
        this.popBubble(b.id);
        return;
      }
    }
  }

  public setDebugConfig(next: Partial<PopPopBubblesDebugConfig>): void {
    const prevScale = this.config.bubbleSpeedScale;
    this.config = {
      bubbleCount: Math.max(MIN_BUBBLE_COUNT, Math.min(MAX_BUBBLE_COUNT, Math.round(next.bubbleCount ?? this.config.bubbleCount))),
      bubbleSpeedScale: Math.max(0.3, Math.min(3, next.bubbleSpeedScale ?? this.config.bubbleSpeedScale)),
      animalFallGravity: Math.max(120, Math.min(900, next.animalFallGravity ?? this.config.animalFallGravity)),
      bubbleRestitution: Math.max(0.55, Math.min(0.98, next.bubbleRestitution ?? this.config.bubbleRestitution)),
      burstParticleSizeScale: Math.max(0.25, Math.min(4, next.burstParticleSizeScale ?? this.config.burstParticleSizeScale)),
      mobileBubbleScaleCompensation: Math.max(
        0,
        Math.min(1, next.mobileBubbleScaleCompensation ?? this.config.mobileBubbleScaleCompensation)
      ),
      fallingAnimalSizeScale: Math.max(0.5, Math.min(3.5, next.fallingAnimalSizeScale ?? this.config.fallingAnimalSizeScale)),
      burstRingLineWidthScale: Math.max(0.25, Math.min(3, next.burstRingLineWidthScale ?? this.config.burstRingLineWidthScale)),
      burstRingExpandSpeedScale: Math.max(
        0.25,
        Math.min(3, next.burstRingExpandSpeedScale ?? this.config.burstRingExpandSpeedScale)
      ),
      burstRingShadowBlurPx: Math.max(0, Math.min(28, next.burstRingShadowBlurPx ?? this.config.burstRingShadowBlurPx)),
    };

    const nextScale = this.config.bubbleSpeedScale;
    if (Math.abs(prevScale - nextScale) > 0.001 && prevScale > 0) {
      const ratio = nextScale / prevScale;
      for (const b of this.bubbles) {
        b.cruiseSpeed *= ratio;
        b.vx *= ratio;
        b.vy *= ratio;
        this.enforceCruiseSpeed(b);
      }
    }
  }

  public respawnWaveNow(): void {
    this.bubbles = [];
    this.spawnWave();
  }

  private readonly tick = (ts: number): void => {
    if (!this.running) return;
    const dt = Math.min(0.033, Math.max(0.001, (ts - this.lastTs) / 1000));
    this.lastTs = ts;
    this.update(dt);
    this.render();
    this.rafId = requestAnimationFrame(this.tick);
  };

  private spawnWave(): void {
    if (this.waveTimer) {
      clearTimeout(this.waveTimer);
      this.waveTimer = null;
    }
    const count = this.config.bubbleCount;
    const bubbles: Bubble[] = [];
    const imgCount = Math.max(1, this.animalImages.length);
    const ids = Array.from({ length: imgCount }, (_, i) => i);
    const bubbleTints = ["#8fd9ff", "#9ce7ff", "#7ec8ff", "#a7dbff"];
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    }
    for (let i = 0; i < count; i++) {
      const side = Math.floor(Math.random() * 4);
      const baseRadius = rand(42, 52) * 1.5;
      const boardScale = Math.min(this.width, this.height) / 460;
      const scale =
        boardScale >= 1
          ? 1
          : boardScale + (1 - boardScale) * this.config.mobileBubbleScaleCompensation;
      const radius = baseRadius * scale;
      let x = 0;
      let y = 0;
      if (side === 0) {
        x = rand(radius, this.width - radius);
        y = -radius - rand(16, 72);
      } else if (side === 1) {
        x = this.width + radius + rand(16, 72);
        y = rand(radius, this.height - radius);
      } else if (side === 2) {
        x = rand(radius, this.width - radius);
        y = this.height + radius + rand(16, 72);
      } else {
        x = -radius - rand(16, 72);
        y = rand(radius, this.height - radius);
      }
      const baseAngle = Math.atan2(this.height * 0.5 - y, this.width * 0.5 - x);
      const angle = baseAngle + rand(-0.75, 0.75);
      const speed = rand(22, 38) * this.config.bubbleSpeedScale;
      bubbles.push({
        id: `b-${this.idSeq++}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        cruiseSpeed: speed,
        radius,
        restitution: this.config.bubbleRestitution,
        friction: 0.01,
        damping: 0.05,
        mass: 1,
        animalIndex: ids[i % ids.length] ?? Math.floor(Math.random() * imgCount),
        squashX: 1,
        squashY: 1,
        squashTimer: 0,
        tintColor: bubbleTints[Math.floor(Math.random() * bubbleTints.length)]!,
      });
    }
    this.bubbles = bubbles;
  }

  private popBubble(id: string): void {
    const idx = this.bubbles.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const b = this.bubbles[idx]!;
    this.bubbles.splice(idx, 1);
    this.spawnBurstParticles(b.x, b.y, b.radius, b.tintColor);
    this.fallingAnimals.push({
      x: b.x,
      y: b.y,
      vx: 0,
      vy: rand(10, 45),
      scale: 1,
      pulseTime: 0.2,
      life: 2.2,
      animalIndex: b.animalIndex,
    });
    this.onPlayPop();

    if (this.bubbles.length === 0 && !this.waveTimer) {
      this.waveTimer = setTimeout(() => {
        this.waveTimer = null;
        this.spawnWave();
      }, WAVE_DELAY_MS);
    }
  }

  private spawnBurstParticles(x: number, y: number, radius: number, bubbleTint: string): void {
    const count = Math.floor(rand(30, 51));
    const baseColor = brightenHex(bubbleTint, 0.38);
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const speed = rand(radius * 1.4, radius * 3.25);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        alpha: 1,
        size: rand(radius * 0.05, radius * 0.14) * this.config.burstParticleSizeScale,
        color: baseColor,
        drag: rand(0.94, 0.975),
        fadePerSec: rand(2.8, 4.5),
      });
    }

    this.burstRings.push({
      x,
      y,
      radius: radius * 0.72,
      lineWidth: Math.max(2.5, radius * 0.12),
      alpha: 0.96,
      expandPerSec: Math.max(90, radius * 3.2),
      fadePerSec: 5.2, // 0.2 秒前後で消える
      color: brightenHex(bubbleTint, 0.75),
    });
  }

  private update(dt: number): void {
    this.updateBubbles(dt);
    this.resolveBubbleCollisions();
    for (const b of this.bubbles) this.enforceCruiseSpeed(b);
    this.updateBubbleSquash(dt);
    this.updateParticles(dt);
    this.updateBurstRings(dt);
    this.updateFallingAnimals(dt);
  }

  private updateBubbleSquash(dt: number): void {
    for (const b of this.bubbles) {
      if (b.squashTimer > 0) {
        b.squashTimer = Math.max(0, b.squashTimer - dt);
        const t = 1 - b.squashTimer / 0.16;
        const ease = Math.sin(t * Math.PI);
        b.squashX = 1 + ease * 0.18;
        b.squashY = 1 - ease * 0.14;
      } else {
        b.squashX += (1 - b.squashX) * 0.24;
        b.squashY += (1 - b.squashY) * 0.24;
      }
    }
  }

  private enforceCruiseSpeed(b: Bubble): void {
    const target = Math.max(8, b.cruiseSpeed);
    const speed = Math.hypot(b.vx, b.vy);
    if (speed < 0.01) {
      const a = Math.random() * Math.PI * 2;
      b.vx = Math.cos(a) * target;
      b.vy = Math.sin(a) * target;
      return;
    }
    const k = target / speed;
    b.vx *= k;
    b.vy *= k;
  }

  private updateBubbles(dt: number): void {
    for (const b of this.bubbles) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.x - b.radius < 0) {
        b.x = b.radius;
        b.vx = Math.abs(b.vx) * b.restitution;
        b.vy *= 1 - b.friction;
        b.squashTimer = 0.16;
        b.squashX = 1.22;
        b.squashY = 0.84;
      } else if (b.x + b.radius > this.width) {
        b.x = this.width - b.radius;
        b.vx = -Math.abs(b.vx) * b.restitution;
        b.vy *= 1 - b.friction;
        b.squashTimer = 0.16;
        b.squashX = 1.22;
        b.squashY = 0.84;
      }

      if (b.y - b.radius < 0) {
        b.y = b.radius;
        b.vy = Math.abs(b.vy) * b.restitution;
        b.vx *= 1 - b.friction;
        b.squashTimer = 0.16;
        b.squashX = 0.84;
        b.squashY = 1.2;
      } else if (b.y + b.radius > this.height) {
        b.y = this.height - b.radius;
        b.vy = -Math.abs(b.vy) * b.restitution;
        b.vx *= 1 - b.friction;
        b.squashTimer = 0.16;
        b.squashX = 0.84;
        b.squashY = 1.2;
      }
    }
  }

  private resolveBubbleCollisions(): void {
    let collisionsThisFrame = 0;
    for (let i = 0; i < this.bubbles.length; i++) {
      for (let j = i + 1; j < this.bubbles.length; j++) {
        const a = this.bubbles[i]!;
        const b = this.bubbles[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minDist = a.radius + b.radius;
        const distSq = dx * dx + dy * dy;
        if (distSq >= minDist * minDist) continue;

        const dist = Math.max(0.001, Math.sqrt(distSq));
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = minDist - dist;

        a.x -= nx * overlap * 0.5;
        a.y -= ny * overlap * 0.5;
        b.x += nx * overlap * 0.5;
        b.y += ny * overlap * 0.5;

        const rvx = b.vx - a.vx;
        const rvy = b.vy - a.vy;
        const velAlongNormal = rvx * nx + rvy * ny;
        if (velAlongNormal > 0) continue;

        const restitution = Math.min(a.restitution, b.restitution);
        const impulse = (-(1 + restitution) * velAlongNormal) / ((1 / a.mass) + (1 / b.mass));
        const ix = impulse * nx;
        const iy = impulse * ny;
        a.vx -= ix / a.mass;
        a.vy -= iy / a.mass;
        b.vx += ix / b.mass;
        b.vy += iy / b.mass;

        const tangentX = -ny;
        const tangentY = nx;
        const tangentVel = rvx * tangentX + rvy * tangentY;
        const friction = (a.friction + b.friction) * 0.5;
        a.vx += tangentX * tangentVel * friction * 0.5;
        a.vy += tangentY * tangentVel * friction * 0.5;
        b.vx -= tangentX * tangentVel * friction * 0.5;
        b.vy -= tangentY * tangentVel * friction * 0.5;

        a.squashTimer = 0.16;
        b.squashTimer = 0.16;
        a.squashX = 1.2;
        a.squashY = 0.86;
        b.squashX = 1.2;
        b.squashY = 0.86;

        collisionsThisFrame += 1;
      }
    }

    if (collisionsThisFrame > 0 && this.onBubbleCollision) {
      this.collisionAccumulator += collisionsThisFrame;
      if (this.collisionAccumulator >= 1) {
        this.collisionAccumulator = 0;
        this.onBubbleCollision();
      }
    }
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.alpha -= p.fadePerSec * dt;
    }
    this.particles = this.particles.filter((p) => p.alpha > 0.01);
  }

  private updateBurstRings(dt: number): void {
    for (const r of this.burstRings) {
      r.radius += r.expandPerSec * dt * this.config.burstRingExpandSpeedScale;
      r.alpha -= r.fadePerSec * dt;
      r.lineWidth *= 0.985;
    }
    this.burstRings = this.burstRings.filter((r) => r.alpha > 0.01);
  }

  private updateFallingAnimals(dt: number): void {
    for (const a of this.fallingAnimals) {
      a.life -= dt;
      if (a.pulseTime > 0) {
        a.pulseTime -= dt;
        const pulseProgress = 1 - Math.max(0, a.pulseTime) / 0.2;
        a.scale = 1 + Math.sin(pulseProgress * Math.PI) * 0.22;
      } else {
        a.vy += this.config.animalFallGravity * dt;
        a.y += a.vy * dt;
        a.scale = Math.max(0.82, a.scale * 0.992);
      }
    }
    this.fallingAnimals = this.fallingAnimals.filter((a) => a.life > 0 && a.y < this.height + 80);
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    const bg = ctx.createLinearGradient(0, 0, 0, this.height);
    bg.addColorStop(0, "rgba(186, 242, 255, 0.42)");
    bg.addColorStop(1, "rgba(205, 224, 255, 0.18)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.width, this.height);

    this.renderParticles();
    this.renderBurstRings();
    this.renderFallingAnimals();
    this.renderBubbles();
  }

  private renderParticles(): void {
    const ctx = this.ctx;
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.shadowColor = "rgba(220, 246, 255, 0.9)";
      ctx.shadowBlur = 9;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private renderBurstRings(): void {
    const ctx = this.ctx;
    for (const r of this.burstRings) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, r.alpha);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.lineWidth * this.config.burstRingLineWidthScale;
      ctx.shadowColor = r.color;
      ctx.shadowBlur = this.config.burstRingShadowBlurPx;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderFallingAnimals(): void {
    const ctx = this.ctx;
    for (const a of this.fallingAnimals) {
      const img = this.animalImages[a.animalIndex % this.animalImages.length];
      if (!img) continue;
      const base = 44 * this.config.fallingAnimalSizeScale;
      const w = base * a.scale;
      const h = base * a.scale;
      const alpha = Math.min(1, Math.max(0, a.life / 2.2));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, a.x - w / 2, a.y - h / 2, w, h);
      ctx.restore();
    }
  }

  private renderBubbles(): void {
    const ctx = this.ctx;
    for (const b of this.bubbles) {
      const d = b.radius * 2;
      const drawW = d * b.squashX;
      const drawH = d * b.squashY;

      ctx.save();
      ctx.globalAlpha = 0.98;
      ctx.drawImage(this.bubbleTexture, b.x - drawW / 2, b.y - drawH / 2, drawW, drawH);
      ctx.restore();

      const img = this.animalImages[b.animalIndex % this.animalImages.length];
      if (!img) continue;
      const inner = b.radius * 1.25;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.radius * 0.78 * b.squashX, b.radius * 0.78 * b.squashY, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.globalAlpha = 0.94;
      ctx.drawImage(img, b.x - (inner * b.squashX) / 2, b.y - (inner * b.squashY) / 2, inner * b.squashX, inner * b.squashY);
      ctx.restore();
    }
  }
}
