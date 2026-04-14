type Bubble = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  restitution: number;
  friction: number;
  damping: number;
  mass: number;
  animalIndex: number;
};

type BurstParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
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

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
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
    const count = DEFAULT_BUBBLE_COUNT;
    const bubbles: Bubble[] = [];
    const ids = [0, 1, 2, 3];
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    }
    for (let i = 0; i < count; i++) {
      const side = Math.floor(Math.random() * 4);
      const radius = rand(42, 52);
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
      const speed = rand(22, 38);
      bubbles.push({
        id: `b-${this.idSeq++}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius,
        restitution: 0.86,
        friction: 0.01,
        damping: 0.05,
        mass: 1,
        animalIndex: ids[i % ids.length] ?? 0,
      });
    }
    this.bubbles = bubbles;
  }

  private popBubble(id: string): void {
    const idx = this.bubbles.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const b = this.bubbles[idx]!;
    this.bubbles.splice(idx, 1);
    this.spawnBurstParticles(b.x, b.y, b.radius);
    this.fallingAnimals.push({
      x: b.x,
      y: b.y,
      vx: rand(-20, 20),
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

  private spawnBurstParticles(x: number, y: number, radius: number): void {
    const count = 16;
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + rand(-0.2, 0.2);
      const speed = rand(55, 140);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - rand(10, 40),
        life: rand(0.45, 0.85),
        size: rand(radius * 0.05, radius * 0.14),
      });
    }
  }

  private update(dt: number): void {
    this.updateBubbles(dt);
    this.resolveBubbleCollisions();
    this.updateParticles(dt);
    this.updateFallingAnimals(dt);
  }

  private updateBubbles(dt: number): void {
    for (const b of this.bubbles) {
      const dampingFactor = Math.max(0, 1 - b.damping * dt * 60);
      b.vx *= dampingFactor;
      b.vy *= dampingFactor;

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.x - b.radius < 0) {
        b.x = b.radius;
        b.vx = Math.abs(b.vx) * b.restitution;
        b.vy *= 1 - b.friction;
      } else if (b.x + b.radius > this.width) {
        b.x = this.width - b.radius;
        b.vx = -Math.abs(b.vx) * b.restitution;
        b.vy *= 1 - b.friction;
      }

      if (b.y - b.radius < 0) {
        b.y = b.radius;
        b.vy = Math.abs(b.vy) * b.restitution;
        b.vx *= 1 - b.friction;
      } else if (b.y + b.radius > this.height) {
        b.y = this.height - b.radius;
        b.vy = -Math.abs(b.vy) * b.restitution;
        b.vx *= 1 - b.friction;
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
      p.vy += 160 * dt;
      p.vx *= 0.985;
      p.life -= dt * 1.6;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  private updateFallingAnimals(dt: number): void {
    for (const a of this.fallingAnimals) {
      a.life -= dt;
      if (a.pulseTime > 0) {
        a.pulseTime -= dt;
        const pulseProgress = 1 - Math.max(0, a.pulseTime) / 0.2;
        a.scale = 1 + Math.sin(pulseProgress * Math.PI) * 0.22;
      } else {
        a.vy += 180 * dt;
        a.y += a.vy * dt;
        a.x += a.vx * dt;
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
    this.renderFallingAnimals();
    this.renderBubbles();
  }

  private renderParticles(): void {
    const ctx = this.ctx;
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = "rgba(225, 250, 255, 0.95)";
      ctx.shadowColor = "rgba(180, 240, 255, 0.75)";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private renderFallingAnimals(): void {
    const ctx = this.ctx;
    for (const a of this.fallingAnimals) {
      const img = this.animalImages[a.animalIndex % this.animalImages.length];
      if (!img) continue;
      const base = 44;
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

      ctx.save();
      ctx.globalAlpha = 0.98;
      ctx.drawImage(this.bubbleTexture, b.x - b.radius, b.y - b.radius, d, d);
      ctx.restore();

      const img = this.animalImages[b.animalIndex % this.animalImages.length];
      if (!img) continue;
      const inner = b.radius * 1.25;
      ctx.save();
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 0.78, 0, Math.PI * 2);
      ctx.clip();
      ctx.globalAlpha = 0.94;
      ctx.drawImage(img, b.x - inner / 2, b.y - inner / 2, inner, inner);
      ctx.restore();
    }
  }
}
