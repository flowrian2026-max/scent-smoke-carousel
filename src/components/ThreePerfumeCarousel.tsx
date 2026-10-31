import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const MODEL_URL = `${import.meta.env.BASE_URL}models/scent-scribe-bottle.glb`;
const BOTTLE_TINTS = ["#b1a4d4", "#b889a7", "#8e96c6", "#7896b7"];

export type FragranceChoice = {
  name: string;
  note: string;
};

type Props = {
  fragrances: FragranceChoice[];
  selectedIndex: number;
  visible: boolean;
  onSelect: (index: number) => void;
};

type Slot = {
  group: THREE.Group;
  bottle: THREE.Object3D;
  index: number;
};

/** Real GLB bottles with local lighting and direct pointer interaction. */
export function ThreePerfumeCarousel({
  fragrances,
  selectedIndex,
  visible,
  onSelect,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [modelReady, setModelReady] = useState(false);
  const [modelError, setModelError] = useState(false);
  const visibleRef = useRef(visible);
  const selectedIndexRef = useRef(selectedIndex);
  const onSelectRef = useRef(onSelect);

  useEffect(() => { visibleRef.current = visible; }, [visible]);
  useEffect(() => { selectedIndexRef.current = selectedIndex; }, [selectedIndex]);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

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
      setModelError(true);
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);
    camera.position.set(0, 1.28, 9.8);
    camera.lookAt(0, 1.05, 0);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.16;

    scene.add(new THREE.HemisphereLight(0xcfd4ff, 0x090b18, 2.05));
    const key = new THREE.DirectionalLight(0xf0efff, 2.15);
    key.position.set(-3.6, 5.4, 5.2);
    scene.add(key);
    const rim = new THREE.PointLight(0x8589c8, 24, 12, 2);
    rim.position.set(3.2, 2.8, -2.8);
    scene.add(rim);
    const fill = new THREE.PointLight(0xa7a9df, 10, 9, 2);
    fill.position.set(-3.5, 1.8, 3.5);
    scene.add(fill);

    const carousel = new THREE.Group();
    scene.add(carousel);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const slots: Slot[] = [];
    const ownedMaterials = new Set<THREE.Material>();
    const ownedGeometries = new Set<THREE.BufferGeometry>();
    let targetRotation = 0;
    let frame = 0;
    let lastRender = 0;
    let disposed = false;
    let pointerDown: { x: number; y: number; lastX: number; slot: Slot | null; moved: boolean } | null = null;
    let ready = false;

    const resize = () => {
      const width = Math.max(1, canvas.clientWidth || window.innerWidth);
      const height = Math.max(1, canvas.clientHeight || window.innerHeight);
      const mobile = width < 700;
      const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.05 : 1.35);
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = mobile ? 43 : 36;
      camera.position.z = mobile ? 8.4 : 9.8;
      camera.updateProjectionMatrix();

      const radiusX = mobile ? 1.56 : Math.min(2.55, width * 0.0021);
      const radiusZ = mobile ? 0.52 : 0.9;
      slots.forEach(({ group }, index) => {
        const angle = (index / Math.max(1, fragrances.length)) * Math.PI * 2;
        group.position.set(Math.sin(angle) * radiusX, mobile ? -0.06 : 0, Math.cos(angle) * radiusZ);
      });
    };

    const pickSlot = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
        -(((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1),
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(carousel.children, true)[0];
      if (!hit) return null;
      let node: THREE.Object3D | null = hit.object;
      while (node && typeof node.userData.fragranceIndex !== "number") node = node.parent;
      if (!node) return null;
      return slots.find((slot) => slot.index === node!.userData.fragranceIndex) ?? null;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!ready) return;
      pointerDown = {
        x: event.clientX,
        y: event.clientY,
        lastX: event.clientX,
        slot: pickSlot(event),
        moved: false,
      };
      canvas.setPointerCapture?.(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!pointerDown) return;
      const dx = event.clientX - pointerDown.lastX;
      pointerDown.lastX = event.clientX;
      if (Math.abs(event.clientX - pointerDown.x) + Math.abs(event.clientY - pointerDown.y) > 5) {
        pointerDown.moved = true;
      }
      if (!pointerDown.moved) return;
      if (pointerDown.slot) {
        pointerDown.slot.bottle.rotation.y += dx * 0.012;
      } else {
        targetRotation += dx * 0.006;
      }
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!pointerDown) return;
      const previous = pointerDown;
      pointerDown = null;
      if (!previous.moved) {
        const selected = pickSlot(event);
        if (selected) {
          targetRotation = -(selected.index / Math.max(1, fragrances.length)) * Math.PI * 2;
          onSelectRef.current(selected.index);
        }
      }
    };
    const onPointerCancel = () => { pointerDown = null; };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);

    const loader = new GLTFLoader();
    let originalScene: THREE.Group | null = null;
    loader.load(
      MODEL_URL,
      (gltf) => {
        if (disposed) return;
        originalScene = gltf.scene;
        const bounds = new THREE.Box3().setFromObject(gltf.scene);
        const dimensions = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const scale = 2.42 / Math.max(0.01, dimensions.y);

        fragrances.forEach((fragrance, index) => {
          const model = gltf.scene.clone(true);
          model.scale.setScalar(scale);
          model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
          model.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            object.castShadow = false;
            object.receiveShadow = false;
            ownedGeometries.add(object.geometry);
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            const nextMaterials = materials.map((source) => {
              const material = source.clone();
              ownedMaterials.add(material);
              if ("color" in material) {
                (material as THREE.MeshStandardMaterial).color.set(BOTTLE_TINTS[index % BOTTLE_TINTS.length]);
              }
              if ("roughness" in material) (material as THREE.MeshStandardMaterial).roughness = 0.28;
              if ("metalness" in material) (material as THREE.MeshStandardMaterial).metalness = 0.18;
              return material;
            });
            object.material = Array.isArray(object.material) ? nextMaterials : nextMaterials[0]!;
          });

          const slotGroup = new THREE.Group();
          const angle = (index / Math.max(1, fragrances.length)) * Math.PI * 2;
          slotGroup.rotation.y = angle;
          slotGroup.userData.fragranceIndex = index;
          slotGroup.add(model);
          slotGroup.position.set(
            Math.sin(angle) * 2.55,
            0,
            Math.cos(angle) * 0.9,
          );
          carousel.add(slotGroup);
          slots.push({ group: slotGroup, bottle: model, index });
        });

        resize();
        ready = true;
        setModelReady(true);
      },
      undefined,
      () => setModelError(true),
    );

    const render = (now: number) => {
      if (disposed) return;
      if (!document.hidden && now - lastRender > (visibleRef.current ? 32 : 100)) {
        lastRender = now;
        carousel.rotation.y += (targetRotation - carousel.rotation.y) * 0.095;
        slots.forEach(({ group, index }) => {
          const isSelected = index === selectedIndexRef.current;
          const desired = isSelected ? 1.045 : 1;
          group.scale.x += (desired - group.scale.x) * 0.08;
          group.scale.y += (desired - group.scale.y) * 0.08;
          group.scale.z += (desired - group.scale.z) * 0.08;
        });
        renderer.render(scene, camera);
      }
      frame = requestAnimationFrame(render);
    };

    const onVisibility = () => { if (!document.hidden) lastRender = 0; };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", resize);
    resize();
    frame = requestAnimationFrame(render);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      ownedGeometries.forEach((geometry) => geometry.dispose());
      ownedMaterials.forEach((material) => material.dispose());
      originalScene?.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            if ("map" in material && material.map) material.map.dispose();
          });
        }
      });
      renderer.dispose();
    };
  }, [fragrances.length]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className={`perfume-3d-canvas ${visible ? "is-visible" : ""}`}
        aria-label="بطری‌های سه‌بعدی عطر؛ روی بطری بزنید و بکشید تا بچرخد"
      />
      {modelError && (
        <div className="model-error" role="status">
          مدل سه‌بعدی بارگذاری نشد. اتصال اینترنت یا WebGL مرورگر را بررسی کنید.
        </div>
      )}
      {!modelReady && !modelError && (
        <div className="model-loading" aria-hidden="true">PREPARING THE FRAGRANCE MODELS</div>
      )}
    </>
  );
}
