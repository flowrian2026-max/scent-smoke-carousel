import { useEffect, useRef } from "react";
import * as THREE from "three";
import "./ThreeStageCanvas.css";

type Props = {
  onReady?: (ready: boolean) => void;
};

type Curtain = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  side: -1 | 1;
};

function makeArchCurve(z: number, radiusX = 4.05, springY = 1.2, radiusY = 3.2) {
  const points: THREE.Vector3[] = [
    new THREE.Vector3(-radiusX, 0.08, z),
    new THREE.Vector3(-radiusX, springY, z),
  ];
  for (let i = 0; i <= 48; i += 1) {
    const angle = Math.PI - (i / 48) * Math.PI;
    points.push(
      new THREE.Vector3(
        Math.cos(angle) * radiusX,
        springY + Math.sin(angle) * radiusY,
        z,
      ),
    );
  }
  points.push(new THREE.Vector3(radiusX, 0.08, z));
  return new THREE.CatmullRomCurve3(points, false, "centripetal");
}

function makeVault() {
  const arcSegments = 76;
  const depthSegments = 18;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let depth = 0; depth <= depthSegments; depth += 1) {
    const z = -1.9 - (depth / depthSegments) * 5.6;
    for (let segment = 0; segment <= arcSegments; segment += 1) {
      const angle = (segment / arcSegments) * Math.PI;
      positions.push(
        Math.cos(angle) * 4.05,
        1.2 + Math.sin(angle) * 3.2,
        z,
      );
    }
  }

  for (let depth = 0; depth < depthSegments; depth += 1) {
    for (let segment = 0; segment < arcSegments; segment += 1) {
      const a = depth * (arcSegments + 1) + segment;
      const b = a + arcSegments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeCurtain(side: -1 | 1): Curtain {
  const columns = 52;
  const rows = 34;
  const positions = new Float32Array((columns + 1) * (rows + 1) * 3);
  const colors = new Float32Array((columns + 1) * (rows + 1) * 3);
  const indices: number[] = [];
  const base = new THREE.Color(side < 0 ? 0x30233d : 0x282039);

  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    for (let column = 0; column <= columns; column += 1) {
      const u = column / columns;
      const index = row * (columns + 1) + column;
      positions[index * 3] = u * 3.72;
      positions[index * 3 + 1] = v * 5.48;
      positions[index * 3 + 2] = Math.cos(u * Math.PI * 18) * 0.11;
      const pleat = 0.44 + 0.34 * (0.5 + 0.5 * Math.cos(u * Math.PI * 18));
      const edgeLight = 0.88 + 0.12 * Math.sin(v * Math.PI);
      colors[index * 3] = base.r * pleat * edgeLight;
      colors[index * 3 + 1] = base.g * pleat * edgeLight;
      colors[index * 3 + 2] = base.b * pleat * edgeLight;
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = row * (columns + 1) + column;
      const b = a + columns + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3),
  );
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.96,
    metalness: 0.015,
    side: THREE.DoubleSide,
    emissive: 0x100b19,
    emissiveIntensity: 0.42,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(side < 0 ? -3.72 : 0, 0.04, -1.42);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return { mesh, side };
}

export function ThreeStageCanvas({ onReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
        depth: true,
        stencil: false,
      });
    } catch {
      onReady?.(false);
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 45);
    camera.position.set(0, 2.85, 9.5);
    camera.lookAt(0, 2.15, -2.15);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const ambient = new THREE.HemisphereLight(0xc7c9ef, 0x090b18, 1.7);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xd9dcff, 2.6);
    key.position.set(-3.5, 6.5, 5);
    scene.add(key);

    const violetRim = new THREE.PointLight(0x8387c3, 34, 12, 2);
    violetRim.position.set(3.3, 3.6, -3.2);
    scene.add(violetRim);

    const coldFill = new THREE.PointLight(0x8e9dbb, 17, 10, 2);
    coldFill.position.set(-3.6, 2.4, -4.4);
    scene.add(coldFill);

    const backWall = new THREE.Mesh(
      new THREE.PlaneGeometry(8.25, 5.55),
      new THREE.MeshStandardMaterial({
        color: 0x0c1022,
        roughness: 0.78,
        metalness: 0.08,
        emissive: 0x11112b,
        emissiveIntensity: 0.24,
      }),
    );
    backWall.position.set(0, 2.72, -7.62);
    scene.add(backWall);

    const vault = new THREE.Mesh(
      makeVault(),
      new THREE.MeshStandardMaterial({
        color: 0x19192e,
        roughness: 0.72,
        metalness: 0.12,
        side: THREE.DoubleSide,
        emissive: 0x111226,
        emissiveIntensity: 0.28,
      }),
    );
    scene.add(vault);

    const leftWall = new THREE.Mesh(
      new THREE.PlaneGeometry(5.7, 1.25),
      new THREE.MeshStandardMaterial({
        color: 0x101426,
        roughness: 0.82,
        side: THREE.DoubleSide,
      }),
    );
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-4.05, 0.63, -4.65);
    scene.add(leftWall);

    const rightWall = leftWall.clone();
    rightWall.position.x = 4.05;
    rightWall.rotation.y = -Math.PI / 2;
    scene.add(rightWall);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(19, 16),
      new THREE.MeshStandardMaterial({
        color: 0x111426,
        roughness: 0.43,
        metalness: 0.24,
        side: THREE.DoubleSide,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.035, -2.2);
    scene.add(floor);

    const frontArch = new THREE.Mesh(
      new THREE.TubeGeometry(makeArchCurve(-1.76), 150, 0.085, 10, false),
      new THREE.MeshStandardMaterial({
        color: 0x777cae,
        metalness: 0.62,
        roughness: 0.28,
        emissive: 0x34395f,
        emissiveIntensity: 0.62,
      }),
    );
    scene.add(frontArch);

    const innerArch = new THREE.Mesh(
      new THREE.TubeGeometry(makeArchCurve(-6.18, 3.78, 1.18, 3.03), 150, 0.035, 8, false),
      new THREE.MeshStandardMaterial({
        color: 0x8d91bd,
        metalness: 0.36,
        roughness: 0.38,
        transparent: true,
        opacity: 0.58,
        emissive: 0x353c68,
        emissiveIntensity: 0.55,
      }),
    );
    scene.add(innerArch);

    const threshold = new THREE.Mesh(
      new THREE.BoxGeometry(8.15, 0.055, 0.18),
      new THREE.MeshStandardMaterial({
        color: 0x777da8,
        metalness: 0.65,
        roughness: 0.3,
        emissive: 0x383f70,
        emissiveIntensity: 0.48,
      }),
    );
    threshold.position.set(0, 0.035, -1.72);
    scene.add(threshold);

    const topRail = new THREE.Mesh(
      new THREE.BoxGeometry(8.2, 0.12, 0.2),
      new THREE.MeshStandardMaterial({
        color: 0x191829,
        metalness: 0.42,
        roughness: 0.52,
      }),
    );
    topRail.position.set(0, 5.52, -1.5);
    scene.add(topRail);

    const curtains = [makeCurtain(-1), makeCurtain(1)];
    curtains.forEach((curtain) => scene.add(curtain.mesh));

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const start = performance.now();
    let frameId = 0;
    let lastRender = 0;
    let width = 1;
    let height = 1;
    let disposed = false;

    const resize = () => {
      width = Math.max(1, canvas.clientWidth || window.innerWidth);
      height = Math.max(1, canvas.clientHeight || window.innerHeight);
      const pixelRatio = Math.min(
        window.devicePixelRatio || 1,
        width < 768 ? 1.15 : 1.35,
      );
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = width < 768 ? 48 : 42;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };

    const updateCurtain = (curtain: Curtain, time: number, opening: number) => {
      const position = curtain.mesh.geometry.getAttribute(
        "position",
      ) as THREE.BufferAttribute;
      const positions = position.array as Float32Array;
      const columns = 52;
      const rows = 34;

      for (let row = 0; row <= rows; row += 1) {
        const v = row / rows;
        for (let column = 0; column <= columns; column += 1) {
          const u = column / columns;
          const index = row * (columns + 1) + column;
          const pleat = Math.sin(u * Math.PI * 18) * 0.105;
          const flutter = reducedMotion
            ? 0
            : Math.sin(time * 1.16 + u * 5.7 + v * 3.4 + curtain.side) *
              0.052 *
              (0.24 + v * 0.76);
          const lowerRipple = reducedMotion
            ? 0
            : Math.sin(time * 1.72 + u * 8.2 + curtain.side * 1.7) *
              0.025 *
              v;
          positions[index * 3] = u * 3.72 + pleat + flutter;
          positions[index * 3 + 1] =
            v * 5.48 +
            (reducedMotion
              ? 0
              : Math.sin(time * 0.68 + u * 4.1 + curtain.side) * 0.035 * v);
          positions[index * 3 + 2] =
            Math.cos(u * Math.PI * 18) * 0.14 + flutter * 0.9 + lowerRipple;
        }
      }

      position.needsUpdate = true;
      curtain.mesh.geometry.computeVertexNormals();
      // Gather the cloth into narrow pleated panels at the outer edges as it opens.
      curtain.mesh.scale.x = THREE.MathUtils.lerp(1, 0.32, opening);
      curtain.mesh.position.x =
        (curtain.side < 0 ? -3.72 : 0) +
        (curtain.side < 0 ? -1 : 1) * 2.32 * opening;
      curtain.mesh.rotation.y =
        (curtain.side < 0 ? -1 : 1) * (0.025 + opening * 0.045);
    };

    const render = (now: number) => {
      if (disposed) return;
      if (!document.hidden && (now - lastRender >= 32 || reducedMotion)) {
        lastRender = now;
        const elapsed = (now - start) / 1000;
        const progress = reducedMotion
          ? 1
          : THREE.MathUtils.clamp((elapsed - 0.42) / 2.8, 0, 1);
        const opening = progress * progress * (3 - 2 * progress);

        curtains.forEach((curtain) =>
          updateCurtain(curtain, elapsed, opening),
        );
        renderer.render(scene, camera);
      }
      if (!reducedMotion) frameId = requestAnimationFrame(render);
    };

    resize();
    window.addEventListener("resize", resize);
    frameId = reducedMotion ? 0 : requestAnimationFrame(render);
    if (reducedMotion) {
      curtains.forEach((curtain) => updateCurtain(curtain, 0, 1));
      renderer.render(scene, camera);
    }

    onReady?.(true);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      curtains.forEach(({ mesh }) => {
        mesh.geometry.dispose();
        mesh.material.dispose();
      });
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh && !curtains.some((item) => item.mesh === object)) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
    };
  }, [onReady]);

  return (
    <canvas
      ref={canvasRef}
      className="stage3d-canvas"
      aria-hidden="true"
    />
  );
}
