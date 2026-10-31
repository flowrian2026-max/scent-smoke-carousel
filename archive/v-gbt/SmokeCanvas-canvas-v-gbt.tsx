import { useEffect, useRef } from "react";

type Particle = {
  x: number; y: number; vx: number; vy: number;
  radius: number; growth: number; alpha: number;
  age: number; lifetime: number; seed: number;
  color: string; core: boolean;
};

type Emitter = { x: number; y: number; elapsed: number; color: string };

export type SmokeHandle = {
  burst: (x: number, y: number, color: string) => void;
  stop: () => void;
};

/**
 * Lightweight cinematic smoke plume.
 * The plume is emitted from the selected bottle's atomizer coordinates,
 * then rises narrowly before expanding into soft turbulent layers.
 */
export function SmokeCanvas({ api }: { api: React.MutableRefObject<SmokeHandle | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let particles: Particle[] = [];
    let emitter: Emitter | null = null;
    let frame = 0;
    let previous = performance.now();
    let width = 1;
    let height = 1;
    let dpr = Math.min(window.devicePixelRatio || 1, 1.75);

    const resize = () => {
      width = canvas.clientWidth || window.innerWidth;
      height = canvas.clientHeight || window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    };

    const toRgb = (hex: string) => {
      const value = Number.parseInt(hex.replace("#", ""), 16);
      if (!Number.isFinite(value)) return "154,143,202";
      return `${(value >> 16) & 255},${(value >> 8) & 255},${value & 255}`;
    };

    const spawn = (kind: "cloud" | "wisp" | "core" = "cloud") => {
      if (!emitter) return;
      const scale = Math.max(0.72, Math.min(width / 1000, 1.25));
      const isCore = kind === "core";
      const isWisp = kind === "wisp";
      const spread = isCore ? 4 : isWisp ? 11 : 8;
      particles.push({
        x: emitter.x + (Math.random() - 0.5) * spread * scale,
        y: emitter.y + (Math.random() - 0.5) * (isCore ? 5 : 9) * scale,
        vx: (Math.random() - 0.5) * (isCore ? 15 : isWisp ? 34 : 23) * scale,
        vy: -(isCore ? 105 + Math.random() * 55 : isWisp ? 65 + Math.random() * 55 : 48 + Math.random() * 48) * scale,
        radius: (isCore ? 5 + Math.random() * 5 : isWisp ? 9 + Math.random() * 12 : 15 + Math.random() * 19) * scale,
        growth: (isCore ? 17 : isWisp ? 24 : 31) * scale,
        alpha: isCore ? 0.16 : isWisp ? 0.09 : 0.115,
        age: 0,
        lifetime: isCore ? 2.8 + Math.random() * 1.4 : 4.2 + Math.random() * 2.8,
        seed: Math.random() * Math.PI * 2,
        color: emitter.color,
        core: isCore,
      });
      if (particles.length > 230) particles.splice(0, particles.length - 230);
    };

    const drawParticle = (p: Particle, dt: number) => {
      p.age += dt;
      const progress = p.age / p.lifetime;
      const turbulence = Math.sin(p.age * 1.55 + p.seed);
      const curl = Math.cos(p.age * 1.12 + p.seed * 1.7);
      p.vx += (turbulence * 19 + curl * 8) * dt;
      p.vy -= (5 + Math.sin(p.age * 0.8 + p.seed) * 4) * dt;
      p.vx *= Math.exp(-0.34 * dt);
      p.vy *= Math.exp(-0.055 * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.radius += p.growth * dt;

      const envelope = Math.sin(Math.PI * Math.min(1, progress)) ** 1.15;
      const alpha = p.alpha * envelope;
      if (alpha < 0.002) return;

      const rx = p.radius * (p.core ? 0.78 : 1.12);
      const ry = p.radius * (p.core ? 1.55 : 1.35);
      const gradient = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
      gradient.addColorStop(0, `rgba(226,222,255,${alpha * (p.core ? 0.8 : 0.48)})`);
      gradient.addColorStop(0.22, `rgba(${p.color},${alpha * 0.88})`);
      gradient.addColorStop(0.58, `rgba(${p.color},${alpha * 0.34})`);
      gradient.addColorStop(1, `rgba(${p.color},0)`);
      ctx!.fillStyle = gradient;
      ctx!.beginPath();
      ctx!.ellipse(p.x, p.y, rx, ry, turbulence * 0.24, 0, Math.PI * 2);
      ctx!.fill();
    };

    const loop = (now: number) => {
      const dt = Math.min((now - previous) / 1000, 0.04);
      previous = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      if (emitter) {
        emitter.elapsed += dt;
        const t = emitter.elapsed;
        const rate = t < 1.8 ? 34 : t < 5.5 ? 19 : t < 9 ? 8 : 0;
        if (Math.random() < rate * dt) {
          spawn("cloud");
          if (Math.random() > 0.38) spawn("wisp");
        }
        if (Math.random() < (t < 4 ? 14 : 5) * dt) spawn("core");
        if (t > 10.5) emitter = null;
      }

      ctx.globalCompositeOperation = "screen";
      particles = particles.filter((p) => p.age < p.lifetime);
      for (const particle of particles) drawParticle(particle, dt);
      ctx.globalCompositeOperation = "source-over";
      frame = requestAnimationFrame(loop);
    };

    resize();
    window.addEventListener("resize", resize);
    frame = requestAnimationFrame(loop);

    api.current = {
      burst: (x, y, color) => {
        particles = [];
        emitter = { x, y, elapsed: 0, color: toRgb(color) };
        // A small, dense ignition at the atomizer makes the source unmistakable.
        for (let i = 0; i < 16; i++) spawn(i % 3 === 0 ? "core" : i % 3 === 1 ? "wisp" : "cloud");
      },
      stop: () => {
        emitter = null;
      },
    };

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      api.current = null;
    };
  }, [api]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-30 h-full w-full" aria-hidden="true" />;
}
