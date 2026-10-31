import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Environment, Lightformer, RoundedBox, ContactShadows } from "@react-three/drei";
import { useMemo, useRef, useState, useEffect } from "react";
import * as THREE from "three";

export type Perfume = { name: string; note: string; color: string };

const RADIUS = 1.55;

function useSmokeTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(255,255,255,0.9)");
    grd.addColorStop(0.4, "rgba(255,255,255,0.35)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
}

function Smoke({ color, active, tex }: { color: string; active: boolean; tex: THREE.Texture }) {
  const N = 70;
  const group = useRef<THREE.Group>(null);
  const parts = useMemo(
    () => Array.from({ length: N }, () => ({ life: 1, max: 1, x: 0, y: 0, z: 0, vx: 0, vz: 0, s: 0, r: 0, rv: 0 })),
    [],
  );
  const acc = useRef(0);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    acc.current += dt;
    const rate = 0.035;
    while (active && acc.current > rate) {
      acc.current -= rate;
      const p = parts.find((q) => q.life >= q.max);
      if (p) {
        p.life = 0;
        p.max = 2.6 + Math.random() * 1.4;
        p.x = (Math.random() - 0.5) * 0.04;
        p.z = (Math.random() - 0.5) * 0.04;
        p.y = 0;
        p.vx = (Math.random() - 0.5) * 0.18;
        p.vz = (Math.random() - 0.5) * 0.18;
        p.s = 0.08 + Math.random() * 0.06;
        p.r = Math.random() * 6;
        p.rv = (Math.random() - 0.5) * 0.8;
      }
    }
    if (!active) acc.current = 0;
    g.children.forEach((child, i) => {
      const p = parts[i];
      const m = child as THREE.Sprite;
      const mat = m.material as THREE.SpriteMaterial;
      if (p.life >= p.max) {
        m.visible = false;
        return;
      }
      p.life += dt;
      const k = p.life / p.max;
      const t = p.life;
      p.x += (p.vx + Math.sin(t * 2 + i) * 0.08) * dt;
      p.z += p.vz * dt;
      p.y += (0.45 - k * 0.15) * dt;
      p.r += p.rv * dt;
      m.visible = true;
      m.position.set(p.x, p.y, p.z);
      const s = p.s + k * 0.9;
      m.scale.set(s, s, s);
      mat.rotation = p.r;
      mat.opacity = Math.sin(Math.PI * Math.min(1, k * 1.1)) * 0.55 * (1 - k * 0.4);
    });
  });
  return (
    <group ref={group}>
      {parts.map((_, i) => (
        <sprite key={i} visible={false}>
          <spriteMaterial map={tex} color={color} transparent depthWrite={false} opacity={0} blending={THREE.NormalBlending} />
        </sprite>
      ))}
    </group>
  );
}

function Bottle({
  p,
  angle,
  open,
  onTap,
  tex,
}: {
  p: Perfume;
  angle: number;
  open: boolean;
  onTap: () => void;
  tex: THREE.Texture;
}) {
  const cap = useRef<THREE.Group>(null);
  const prog = useRef(0);
  useFrame((_, dt) => {
    prog.current = THREE.MathUtils.damp(prog.current, open ? 1 : 0, 6, dt);
    const k = prog.current;
    if (cap.current) {
      cap.current.position.set(0.18 * k, 1.12 + 0.42 * Math.sin(k * Math.PI * 0.5), 0.05 * k);
      cap.current.rotation.z = -0.55 * k;
    }
  });
  const x = Math.sin(angle) * RADIUS;
  const z = Math.cos(angle) * RADIUS;
  const col = useMemo(() => new THREE.Color(p.color), [p.color]);
  return (
    <group position={[x, 0.32, z]} rotation={[0, angle, 0]}>
      <group
        onPointerUp={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onTap();
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        {/* glass body */}
        <RoundedBox args={[0.62, 0.8, 0.34]} radius={0.06} smoothness={4} position={[0, 0.4, 0]}>
          <meshPhysicalMaterial
            transmission={1}
            thickness={0.6}
            roughness={0.04}
            ior={1.5}
            clearcoat={1}
            color="#ffffff"
            attenuationColor={col}
            attenuationDistance={1.6}
          />
        </RoundedBox>
        {/* liquid */}
        <RoundedBox args={[0.5, 0.58, 0.24]} radius={0.04} smoothness={3} position={[0, 0.34, 0]}>
          <meshPhysicalMaterial color={col} roughness={0.1} transmission={0.6} thickness={0.3} emissive={col} emissiveIntensity={0.15} />
        </RoundedBox>
        {/* gold collar */}
        <mesh position={[0, 0.86, 0]}>
          <cylinderGeometry args={[0.08, 0.1, 0.12, 32]} />
          <meshStandardMaterial color="#c9a45c" metalness={1} roughness={0.22} />
        </mesh>
        <mesh position={[0, 0.95, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.08, 16]} />
          <meshStandardMaterial color="#d8d8d8" metalness={1} roughness={0.2} />
        </mesh>
        {/* cap */}
        <group ref={cap} position={[0, 1.12, 0]}>
          <mesh>
            <cylinderGeometry args={[0.2, 0.22, 0.3, 8]} />
            <meshPhysicalMaterial
              color={col}
              metalness={0.2}
              roughness={0.08}
              transmission={0.5}
              thickness={0.4}
              clearcoat={1}
            />
          </mesh>
          <mesh position={[0, -0.16, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.04, 32]} />
            <meshStandardMaterial color="#c9a45c" metalness={1} roughness={0.2} />
          </mesh>
        </group>
      </group>
      <group position={[0, 0.98, 0]}>
        <Smoke color={p.color} active={open} tex={tex} />
      </group>
      {open && <pointLight position={[0, 1.4, 0]} color={col} intensity={1.5} distance={2} />}
    </group>
  );
}

function Turntable({
  perfumes,
  rotation,
  openIdx,
  onTap,
}: {
  perfumes: Perfume[];
  rotation: React.MutableRefObject<number>;
  openIdx: number | null;
  onTap: (i: number) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const tex = useSmokeTexture();
  const marble = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const g = c.getContext("2d")!;
    g.fillStyle = "#151313";
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = `rgba(${180 + Math.random() * 60},${170 + Math.random() * 50},150,${0.04 + Math.random() * 0.1})`;
      g.lineWidth = Math.random() * 2;
      g.beginPath();
      let x = Math.random() * 512,
        y = Math.random() * 512;
      g.moveTo(x, y);
      for (let j = 0; j < 8; j++) {
        x += (Math.random() - 0.3) * 90;
        y += (Math.random() - 0.5) * 90;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useFrame(() => {
    if (ref.current) ref.current.rotation.y = rotation.current;
  });
  const step = (Math.PI * 2) / perfumes.length;
  return (
    <group ref={ref}>
      <mesh position={[0, 0.15, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[2.2, 2.2, 0.32, 96]} />
        <meshPhysicalMaterial map={marble} roughness={0.25} clearcoat={0.8} clearcoatRoughness={0.15} />
      </mesh>
      <mesh position={[0, -0.03, 0]}>
        <cylinderGeometry args={[2.24, 2.24, 0.05, 96]} />
        <meshStandardMaterial color="#c9a45c" metalness={1} roughness={0.25} />
      </mesh>
      <mesh position={[0, -0.25, 0]}>
        <cylinderGeometry args={[2.0, 2.1, 0.4, 96]} />
        <meshPhysicalMaterial map={marble} roughness={0.35} />
      </mesh>
      {perfumes.map((p, i) => (
        <Bottle key={p.name} p={p} angle={-i * step} open={openIdx === i} onTap={() => onTap(i)} tex={tex} />
      ))}
    </group>
  );
}

export default function PerfumeStage({
  perfumes,
  onActiveChange,
}: {
  perfumes: Perfume[];
  onActiveChange: (i: number) => void;
}) {
  const rotation = useRef(0);
  const target = useRef(0);
  const vel = useRef(0);
  const drag = useRef<{ x: number; last: number; moved: number } | null>(null);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const step = (Math.PI * 2) / perfumes.length;
  const lastActive = useRef(0);

  useEffect(() => {
    const up = () => {
      if (!drag.current) return;
      const moved = drag.current.moved;
      drag.current = null;
      // snap with inertia
      const projected = target.current + vel.current * 8;
      target.current = Math.round(projected / step) * step;
      if (moved > 6) setOpenIdx(null);
    };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, [step]);

  function Driver() {
    useFrame((_, dt) => {
      if (!drag.current) rotation.current = THREE.MathUtils.damp(rotation.current, target.current, 5, dt);
      const n = perfumes.length;
      const idx = (((Math.round(rotation.current / step)) % n) + n) % n;
      if (idx !== lastActive.current) {
        lastActive.current = idx;
        onActiveChange(idx);
      }
    });
    return null;
  }

  return (
    <div
      className="absolute inset-0 touch-none select-none"
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, last: e.clientX, moved: 0 };
        vel.current = 0;
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.last;
        d.last = e.clientX;
        d.moved += Math.abs(dx);
        const delta = dx * 0.006;
        rotation.current += delta;
        target.current = rotation.current;
        vel.current = delta;
      }}
    >
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 2.6, 8.2], fov: 32 }} gl={{ antialias: true }}>
        <Driver />
        <fog attach="fog" args={["#0b0908", 6, 14]} />
        <ambientLight intensity={0.35} />
        <spotLight position={[2, 7, 3]} angle={0.4} penumbra={0.8} intensity={60} color="#ffe2b0" castShadow />
        <spotLight position={[-4, 3, -3]} angle={0.6} penumbra={1} intensity={20} color="#b08a50" />
        <group position={[0, -0.9, 0]}>
          <Turntable
            perfumes={perfumes}
            rotation={rotation}
            openIdx={openIdx}
            onTap={(i) => {
              if (drag.current && drag.current.moved > 6) return;
              const n = perfumes.length;
              const front = (((Math.round(rotation.current / step)) % n) + n) % n;
              if (i !== front) {
                // bring tapped bottle to front
                let diff = i - front;
                if (diff > n / 2) diff -= n;
                if (diff < -n / 2) diff += n;
                target.current = Math.round(rotation.current / step) * step + diff * step;
                setOpenIdx(i);
              } else setOpenIdx((o) => (o === i ? null : i));
            }}
          />
          <ContactShadows position={[0, -0.46, 0]} opacity={0.7} scale={8} blur={2.5} far={2} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.46, 0]} receiveShadow>
            <circleGeometry args={[12, 64]} />
            <meshStandardMaterial color="#0e0c0b" roughness={0.4} metalness={0.3} />
          </mesh>
        </group>
        <Environment resolution={256} environmentIntensity={1.6}>
          <Lightformer form="rect" intensity={3} position={[0, 4, 2]} scale={[6, 1, 1]} color="#ffe9c4" />
          <Lightformer form="rect" intensity={2} position={[-4, 1, 0]} rotation-y={Math.PI / 2} scale={[4, 2, 1]} />
          <Lightformer form="rect" intensity={2} position={[4, 1, 0]} rotation-y={-Math.PI / 2} scale={[4, 2, 1]} color="#ffd9a0" />
          <Lightformer form="ring" intensity={1} position={[0, 2, -5]} scale={3} />
        </Environment>
      </Canvas>
    </div>
  );
}
