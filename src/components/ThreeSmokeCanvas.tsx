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
 * Cinematic perfume plume: low-cost curl motion on the CPU and a domain-warped
 * volumetric-looking particle shader on the GPU. Canvas 2D is the WebGL fallback.
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
        canvas, alpha: true, antialias: false, powerPreference: "low-power",
        depth: false, stencil: false, premultipliedAlpha: true,
      });
    } catch {
      setWebglFailed(true);
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(0, 1, 0, 1, -10, 10);
    camera.position.z = 2;

    const capacity = 220;
    const positions = new Float32Array(capacity * 3);
    const sizes = new Float32Array(capacity);
    const opacities = new Float32Array(capacity);
    const colors = new Float32Array(capacity * 3);
    const ages = new Float32Array(capacity);
    const seeds = new Float32Array(capacity);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aOpacity", new THREE.BufferAttribute(opacities, 1));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("aAge", new THREE.BufferAttribute(ages, 1));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.NormalBlending,
      uniforms: { uPixelRatio: { value: 1 }, uTime: { value: 0 } },
      vertexShader: `
        attribute float aSize;
        attribute float aOpacity;
        attribute vec3 aColor;
        attribute float aAge;
        attribute float aSeed;
        uniform float uPixelRatio;
        varying float vOpacity;
        varying vec3 vColor;
        varying float vAge;
        varying float vSeed;
        void main() {
          vOpacity = aOpacity;
          vColor = aColor;
          vAge = aAge;
          vSeed = aSeed;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = max(1.0, aSize * uPixelRatio);
        }
      `,
      fragmentShader: `
        varying float vOpacity;
        varying vec3 vColor;
        varying float vAge;
        varying float vSeed;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
        }
        float fbm(vec2 p) {
          float sum = 0.0;
          float amp = 0.5;
          for (int i = 0; i < 4; i++) {
            sum += noise(p) * amp;
            p = p * 2.03 + vec2(13.1, 7.7);
            amp *= 0.5;
          }
          return sum;
        }
        void main() {
          vec2 p = (gl_PointCoord - 0.5) * vec2(1.0, 1.18);
          float t = vAge * 2.2 + vSeed;
          float broad = fbm(p * 3.4 + vec2(t * 0.13, -t * 0.09));
          float detail = fbm(p * 8.0 - vec2(t * 0.19, t * 0.12));
          vec2 warped = p + (vec2(broad, detail) - 0.5) * 0.27;
          float d = length(warped);
          float edgeNoise = fbm(warped * 6.0 + vSeed * 0.17);
          float edge = 0.34 + edgeNoise * 0.22;
          float body = 1.0 - smoothstep(edge - 0.12, edge + 0.2, d);
          float inner = exp(-d * d * 5.2);
          float wisps = smoothstep(0.28, 0.78, detail) * body;
          float alpha = vOpacity * body * (0.55 + inner * 0.48) * (0.72 + wisps * 0.28);
          if (alpha < 0.003) discard;

          vec3 deep = mix(vColor, vec3(0.13, 0.10, 0.28), 0.38);
          vec3 pearl = mix(vColor, vec3(0.76, 0.73, 0.94), 0.48);
          float lightVein = smoothstep(0.62, 0.94, detail) * (1.0 - smoothstep(0.1, 0.7, d));
          vec3 color = mix(deep, vColor, 0.48 + broad * 0.24);
          color = mix(color, pearl, lightVein * 0.42);
          gl_FragColor = vec4(color, alpha);
        }
      `,
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    scene.add(points);

    let width = 1, height = 1, dpr = 1, frame = 0;
    let previous = performance.now();
    let particles: Particle[] = [];
    let emitter: Emitter | null = null;

    const resize = () => {
      width = canvas.clientWidth || window.innerWidth;
      height = canvas.clientHeight || window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      camera.left = 0; camera.right = width; camera.top = 0; camera.bottom = height;
      camera.updateProjectionMatrix();
      material.uniforms.uPixelRatio.value = dpr;
    };

    const spawn = (kind: "cloud" | "wisp" | "core" = "cloud") => {
      if (!emitter) return;
      const scale = Math.max(0.72, Math.min(width / 1000, 1.15));
      const core = kind === "core";
      const wisp = kind === "wisp";
      particles.push({
        x: emitter.x + (Math.random() - 0.5) * (core ? 3 : wisp ? 8 : 7) * scale,
        y: emitter.y + (Math.random() - 0.5) * (core ? 4 : 7) * scale,
        vx: (Math.random() - 0.5) * (core ? 9 : wisp ? 22 : 15) * scale,
        vy: -(core ? 91 + Math.random() * 38 : wisp ? 58 + Math.random() * 34 : 43 + Math.random() * 34) * scale,
        age: 0,
        life: core ? 2.8 + Math.random() * 1.1 : 4.6 + Math.random() * 2.3,
        size: (core ? 9 + Math.random() * 6 : wisp ? 19 + Math.random() * 15 : 29 + Math.random() * 22) * scale,
        growth: (core ? 10 : wisp ? 19 : 24) * scale,
        alpha: core ? 0.14 : wisp ? 0.075 : 0.105,
        seed: Math.random() * Math.PI * 2,
        color: emitter.color.clone(),
        core,
      });
      if (particles.length > capacity) particles.splice(0, particles.length - capacity);
    };

    const render = (now: number) => {
      const dt = Math.min((now - previous) / 1000, 0.035);
      previous = now;
      material.uniforms.uTime.value = now * 0.001;

      if (emitter) {
        emitter.elapsed += dt;
        const t = emitter.elapsed;
        const rate = t < 1.7 ? 31 : t < 5.8 ? 18 : t < 9.2 ? 7 : 0;
        if (Math.random() < rate * dt) {
          spawn("cloud");
          if (Math.random() > 0.3) spawn("wisp");
        }
        if (Math.random() < (t < 3.8 ? 10 : 4) * dt) spawn("core");
        if (t > 10.5) emitter = null;
      }

      let alive = 0;
      for (const p of particles) {
        p.age += dt;
        if (p.age >= p.life) continue;
        const progress = p.age / p.life;
        const phase = p.age * 1.35 + p.seed;
        // A restrained curl field: neighboring plumes bend in different directions.
        const curl = Math.sin(p.x * 0.009 + phase) + Math.cos(p.y * 0.006 - phase * 0.72);
        const drift = Math.sin(phase * 0.63 + p.seed * 1.9);
        p.vx += (curl * 10 + drift * 8) * dt;
        p.vy -= (3.2 + Math.sin(phase * 0.7) * 2.4) * dt;
        p.vx *= Math.exp(-0.3 * dt);
        p.vy *= Math.exp(-0.045 * dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.size += p.growth * dt;

        const envelope = Math.sin(Math.PI * Math.min(1, progress)) ** 1.25;
        positions[alive * 3] = p.x;
        positions[alive * 3 + 1] = p.y;
        positions[alive * 3 + 2] = 0;
        sizes[alive] = p.size;
        opacities[alive] = p.alpha * envelope;
        colors[alive * 3] = p.color.r;
        colors[alive * 3 + 1] = p.color.g;
        colors[alive * 3 + 2] = p.color.b;
        ages[alive] = progress;
        seeds[alive] = p.seed;
        alive++;
      }
      particles = particles.filter((p) => p.age < p.life);
      for (let i = alive; i < capacity; i++) {
        sizes[i] = 0; opacities[i] = 0; ages[i] = 0; seeds[i] = 0;
      }
      for (const name of ["position", "aSize", "aOpacity", "aColor", "aAge", "aSeed"]) {
        geometry.attributes[name]!.needsUpdate = true;
      }
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
        for (let i = 0; i < 20; i++) spawn(i % 4 === 0 ? "core" : i % 3 === 0 ? "wisp" : "cloud");
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
