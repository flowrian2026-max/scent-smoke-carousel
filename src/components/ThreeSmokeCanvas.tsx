import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { SmokeCanvas as CanvasSmoke, type SmokeHandle } from "@/components/SmokeCanvas";

type Particle = {
  x: number; y: number; vx: number; vy: number;
  age: number; life: number; size: number; growth: number;
  alpha: number; seed: number; color: THREE.Color; core: boolean;
};
type Emitter = { x: number; y: number; elapsed: number; color: THREE.Color };

export type ThreeSmokeHandle = SmokeHandle;

/**
 * Lightweight GPU-rendered smoke using Three.js Points + a soft custom shader.
 * Particle motion is intentionally modest and the renderer is DPR-capped for mobile.
 * Canvas 2D remains as an automatic fallback when WebGL is unavailable.
 */
export function ThreeSmokeCanvas({ api }: { api: React.MutableRefObject<SmokeHandle | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        powerPreference: "low-power",
        depth: false,
        stencil: false,
        premultipliedAlpha: true,
      });
    } catch {
      setWebglFailed(true);
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(0, 1, 0, 1, -10, 10);
    camera.position.z = 2;

    const capacity = 190;
    const positions = new Float32Array(capacity * 3);
    const sizes = new Float32Array(capacity);
    const opacities = new Float32Array(capacity);
    const colors = new Float32Array(capacity * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aOpacity", new THREE.BufferAttribute(opacities, 1));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      uniforms: { uPixelRatio: { value: 1 } },
      vertexShader: `
        attribute float aSize;
        attribute float aOpacity;
        attribute vec3 aColor;
        uniform float uPixelRatio;
        varying float vOpacity;
        varying vec3 vColor;
        void main() {
          vOpacity = aOpacity;
          vColor = aColor;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = max(1.0, aSize * uPixelRatio);
        }
      `,
      fragmentShader: `
        varying float vOpacity;
        varying vec3 vColor;
        void main() {
          vec2 p = gl_PointCoord - vec2(0.5);
          float d = length(p);
          float soft = 1.0 - smoothstep(0.04, 0.5, d);
          float body = exp(-d * d * 8.0);
          float alpha = vOpacity * soft * body;
          if (alpha < 0.004) discard;
          vec3 smokeColor = mix(vColor, vec3(0.88, 0.86, 1.0), 0.16 * soft);
          gl_FragColor = vec4(smokeColor, alpha);
        }
      `,
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    scene.add(points);

    let width = 1;
    let height = 1;
    let dpr = 1;
    let frame = 0;
    let previous = performance.now();
    let particles: Particle[] = [];
    let emitter: Emitter | null = null;

    const resize = () => {
      width = canvas.clientWidth || window.innerWidth;
      height = canvas.clientHeight || window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.35);
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      camera.left = 0;
      camera.right = width;
      camera.top = 0;
      camera.bottom = height;
      camera.updateProjectionMatrix();
      material.uniforms.uPixelRatio.value = dpr;
    };

    const spawn = (kind: "cloud" | "wisp" | "core" = "cloud") => {
      if (!emitter) return;
      const scale = Math.max(0.72, Math.min(width / 1000, 1.2));
      const core = kind === "core";
      const wisp = kind === "wisp";
      particles.push({
        x: emitter.x + (Math.random() - 0.5) * (core ? 4 : wisp ? 11 : 8) * scale,
        y: emitter.y + (Math.random() - 0.5) * (core ? 5 : 9) * scale,
        vx: (Math.random() - 0.5) * (core ? 13 : wisp ? 30 : 21) * scale,
        vy: -(core ? 102 + Math.random() * 45 : wisp ? 64 + Math.random() * 48 : 48 + Math.random() * 43) * scale,
        age: 0,
        life: core ? 2.7 + Math.random() * 1.2 : 4 + Math.random() * 2.5,
        size: (core ? 7 + Math.random() * 5 : wisp ? 17 + Math.random() * 15 : 25 + Math.random() * 20) * scale,
        growth: (core ? 13 : wisp ? 22 : 27) * scale,
        alpha: core ? 0.2 : wisp ? 0.105 : 0.12,
        seed: Math.random() * Math.PI * 2,
        color: emitter.color.clone(),
        core,
      });
      if (particles.length > capacity) particles.splice(0, particles.length - capacity);
    };

    const render = (now: number) => {
      const dt = Math.min((now - previous) / 1000, 0.04);
      previous = now;

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

      let alive = 0;
      for (const p of particles) {
        p.age += dt;
        if (p.age >= p.life) continue;
        const turbulence = Math.sin(p.age * 1.55 + p.seed);
        const curl = Math.cos(p.age * 1.12 + p.seed * 1.7);
        p.vx += (turbulence * 17 + curl * 7) * dt;
        p.vy -= (4.5 + Math.sin(p.age * 0.8 + p.seed) * 3.5) * dt;
        p.vx *= Math.exp(-0.34 * dt);
        p.vy *= Math.exp(-0.055 * dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.size += p.growth * dt;

        const progress = p.age / p.life;
        const envelope = Math.sin(Math.PI * Math.min(1, progress)) ** 1.15;
        positions[alive * 3] = p.x;
        positions[alive * 3 + 1] = p.y;
        positions[alive * 3 + 2] = 0;
        sizes[alive] = p.size;
        opacities[alive] = p.alpha * envelope;
        colors[alive * 3] = p.color.r;
        colors[alive * 3 + 1] = p.color.g;
        colors[alive * 3 + 2] = p.color.b;
        alive++;
      }
      particles = particles.filter((p) => p.age < p.life);
      for (let i = alive; i < capacity; i++) {
        sizes[i] = 0;
        opacities[i] = 0;
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.aSize.needsUpdate = true;
      geometry.attributes.aOpacity.needsUpdate = true;
      geometry.attributes.aColor.needsUpdate = true;

      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };

    resize();
    window.addEventListener("resize", resize);
    frame = requestAnimationFrame(render);
    api.current = {
      burst: (x, y, color) => {
        particles = [];
        emitter = { x, y, elapsed: 0, color: new THREE.Color(color) };
        for (let i = 0; i < 18; i++) spawn(i % 3 === 0 ? "core" : i % 3 === 1 ? "wisp" : "cloud");
      },
      stop: () => { emitter = null; },
    };

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      api.current = null;
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [api]);

  if (webglFailed) return <CanvasSmoke api={api} />;
  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-30 h-full w-full" aria-hidden="true" />;
}
