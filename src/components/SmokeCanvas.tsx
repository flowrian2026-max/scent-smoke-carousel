import { useEffect, useRef } from "react";

type P = { x: number; y: number; vx: number; vy: number; r: number; gr: number; a: number; life: number; max: number; seed: number; base: boolean };

export type SmokeHandle = { burst: (x: number, y: number, color: string) => void; stop: () => void };

/** Full-screen canvas that draws soft billowing / wispy coloured smoke. */
export function SmokeCanvas({ api }: { api: React.MutableRefObject<SmokeHandle | null> }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    let parts: P[] = [];
    let emitter: { x: number; y: number; t: number } | null = null;
    let rgb = "255,180,200";
    let raf = 0;
    let last = performance.now();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      c.width = c.clientWidth * dpr;
      c.height = c.clientHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    const hex = (h: string) => {
      const n = parseInt(h.slice(1), 16);
      return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
    };

    const spawn = (base: boolean) => {
      if (!emitter) return;
      const s = c.clientWidth / 1000;
      const side = Math.random() < 0.5 ? -1 : 1;
      parts.push(
        base
          ? {
              x: emitter.x + (Math.random() - 0.5) * 60 * s,
              y: emitter.y + (Math.random() - 0.5) * 14 * s,
              vx: side * (40 + Math.random() * 90) * s,
              vy: -(Math.random() * 12) * s,
              r: (26 + Math.random() * 20) * s,
              gr: 22 * s,
              a: 0.32,
              life: 0,
              max: 3.5 + Math.random() * 2.5,
              seed: Math.random() * 100,
              base,
            }
          : {
              x: emitter.x + (Math.random() - 0.5) * 70 * s,
              y: emitter.y - Math.random() * 120 * s,
              vx: (Math.random() - 0.5) * 20 * s,
              vy: -(50 + Math.random() * 60) * s,
              r: (8 + Math.random() * 10) * s,
              gr: 28 * s,
              a: 0.18,
              life: 0,
              max: 4 + Math.random() * 3,
              seed: Math.random() * 100,
              base,
            },
      );
    };

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, c.clientWidth, c.clientHeight);
      if (emitter) {
        emitter.t += dt;
        const e = emitter.t;
        const baseRate = e < 1.6 ? 40 : e < 4 ? 8 : 2;
        const wispRate = e < 0.5 ? 0 : e < 5 ? 26 : 10;
        if (Math.random() < baseRate * dt) spawn(true);
        if (Math.random() < baseRate * dt) spawn(true);
        if (Math.random() < wispRate * dt) spawn(true && false);
        if (Math.random() < wispRate * dt) spawn(false);
      }
      ctx.globalCompositeOperation = "screen";
      parts = parts.filter((p) => p.life < p.max);
      for (const p of parts) {
        p.life += dt;
        const k = p.life / p.max;
        const t = p.life + p.seed;
        if (p.base) {
          p.vx *= Math.exp(-0.9 * dt);
          p.vy -= 6 * dt;
        } else {
          p.vx += Math.sin(t * 1.7) * 30 * dt;
          p.vy *= Math.exp(-0.15 * dt);
        }
        p.x += p.vx * dt + Math.sin(t * 2.3) * 0.3;
        p.y += p.vy * dt;
        p.r += p.gr * dt;
        const alpha = p.a * Math.sin(Math.PI * Math.min(1, k)) ** 1.2;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, `rgba(${rgb},${alpha})`);
        g.addColorStop(0.55, `rgba(${rgb},${alpha * 0.45})`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.r * (p.base ? 1.5 : 0.8), p.r, Math.sin(t) * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    api.current = {
      burst: (x, y, color) => {
        rgb = hex(color);
        parts = [];
        emitter = { x, y, t: 0 };
      },
      stop: () => {
        emitter = null;
      },
    };
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [api]);

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 z-30 h-full w-full" />;
}
