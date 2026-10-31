import { useEffect, useRef, useState } from "react";
import type { SmokeHandle } from "@/components/SmokeCanvas";

export type ThreeSmokeHandle = SmokeHandle;

const FRAME_ARCHIVES = [
  "https://raw.githubusercontent.com/flowrian2026-max/Midnight-file-test/main/Untitled%20video_000.zip",
  "https://raw.githubusercontent.com/flowrian2026-max/Midnight-file-test/main/Untitled%20video%20(1)_000.zip",
];
const FALLBACK_CLIPS = [
  "https://raw.githubusercontent.com/flowrian2026-max/Midnight-file-test/7fd7c9c33163a6a0975827ab1399e69740d0e0b4/smoke-references/Untitled%20video.mp4",
  "https://raw.githubusercontent.com/flowrian2026-max/Midnight-file-test/7fd7c9c33163a6a0975827ab1399e69740d0e0b4/smoke-references/Untitled%20video%20(1).mp4",
];

type SmokeShot = { clip: number; x: number; y: number; hue: number; key: number };

function naturalCompare(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") throw new Error("ZIP decompression is unavailable");
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Remove the dark studio background from each real smoke frame and preserve soft smoke edges. */
async function keyDarkBackground(source: string): Promise<string> {
  const image = new Image();
  image.decoding = "async";
  image.src = source;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return source;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    const luminance = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
    const t = Math.max(0, Math.min(1, (luminance - 9) / 58));
    data[i + 3] = Math.round(data[i + 3] * t * t * (3 - 2 * t));
  }
  context.putImageData(pixels, 0, 0);
  return new Promise((resolve) => canvas.toBlob((blob) => {
    resolve(blob ? URL.createObjectURL(blob) : source);
  }, "image/webp", 0.92));
}

/** Read image entries directly from the user's ZIP exports; no generated smoke is used. */
async function readFrameArchive(url: string): Promise<string[]> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load smoke frame archive (${response.status})`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error("Invalid smoke ZIP archive");

  const entryCount = view.getUint16(end + 10, true);
  const directoryOffset = view.getUint32(end + 16, true);
  const names: Array<{ name: string; method: number; compressed: number; size: number; offset: number }> = [];
  let cursor = directoryOffset;

  for (let i = 0; i < entryCount; i++) {
    if (view.getUint32(cursor, true) !== 0x02014b50) break;
    const method = view.getUint16(cursor + 10, true);
    const compressed = view.getUint32(cursor + 20, true);
    const size = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const offset = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    if (/\.(png|jpe?g|webp)$/i.test(name) && !name.includes("__MACOSX/") && !name.split("/").some((part) => part.startsWith("."))) {
      names.push({ name, method, compressed, size, offset });
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  names.sort((a, b) => naturalCompare(a.name, b.name));
  if (!names.length) throw new Error("No image frames found in smoke ZIP");

  const urls: string[] = [];
  for (const entry of names) {
    const local = entry.offset;
    if (view.getUint32(local, true) !== 0x04034b50) continue;
    const nameLength = view.getUint16(local + 26, true);
    const extraLength = view.getUint16(local + 28, true);
    const start = local + 30 + nameLength + extraLength;
    const packed = bytes.subarray(start, start + entry.compressed);
    const raw = entry.method === 0 ? packed : entry.method === 8 ? await inflateRaw(packed) : null;
    if (!raw) continue;
    const extension = entry.name.split(".").pop()?.toLowerCase();
    const mime = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
    const original = URL.createObjectURL(new Blob([raw], { type: mime }));
    try {
      urls.push(await keyDarkBackground(original));
    } finally {
      URL.revokeObjectURL(original);
    }
  }
  if (!urls.length) throw new Error("Could not decode smoke image frames");
  return urls;
}

function hueFromHex(hex: string) {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 0;
  let hue = 0;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  return (hue * 60 + 360) % 360;
}

export function ThreeSmokeCanvas({ api }: { api: React.MutableRefObject<SmokeHandle | null> }) {
  const videos = useRef<Array<HTMLVideoElement | null>>([null, null]);
  const nextClip = useRef(0);
  const [frameSets, setFrameSets] = useState<string[][]>([]);
  const [shot, setShot] = useState<SmokeShot | null>(null);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    let alive = true;
    const created: string[][] = [];
    void Promise.all(FRAME_ARCHIVES.map(async (url) => {
      try {
        const frames = await readFrameArchive(url);
        created.push(frames);
        return frames;
      } catch (error) {
        console.warn("Smoke frame archive unavailable; using original video:", error);
        return [];
      }
    })).then((sets) => {
      if (alive) setFrameSets(sets);
      else created.flat().forEach(URL.revokeObjectURL);
    });
    return () => {
      alive = false;
      created.flat().forEach(URL.revokeObjectURL);
    };
  }, []);

  useEffect(() => {
    if (!shot) return;
    const frames = frameSets[shot.clip] ?? [];
    if (!frames.length) {
      const video = videos.current[shot.clip];
      if (!video) return;
      video.pause();
      try { video.currentTime = 0; } catch { /* metadata may still be loading */ }
      const play = () => { void video.play().catch(() => setShot(null)); };
      if (video.readyState >= 2) play();
      else {
        video.addEventListener("canplay", play, { once: true });
        return () => video.removeEventListener("canplay", play);
      }
      return;
    }

    let raf = 0;
    let last = 0;
    let index = 0;
    setFrame(0);
    const tick = (now: number) => {
      if (now - last >= 1000 / 14) {
        last = now;
        index += 1;
        if (index >= frames.length) {
          setShot(null);
          return;
        }
        setFrame(index);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [shot?.key, frameSets]);

  useEffect(() => {
    api.current = {
      burst: (x, y, color) => {
        const clip = nextClip.current;
        nextClip.current = (nextClip.current + 1) % FRAME_ARCHIVES.length;
        setShot({ clip, x, y, hue: hueFromHex(color), key: Date.now() });
      },
      stop: () => {
        videos.current.forEach((video) => video?.pause());
        setShot(null);
      },
    };
    return () => {
      api.current = null;
      videos.current.forEach((video) => video?.pause());
    };
  }, [api]);

  const activeFrames = shot ? frameSets[shot.clip] ?? [] : [];
  const frameSrc = activeFrames.length ? activeFrames[frame] : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden" aria-hidden="true">
      {frameSrc && shot && (
        <img
          src={frameSrc}
          alt=""
          draggable={false}
          className="absolute max-w-none object-contain mix-blend-screen"
          style={{
            left: shot.x,
            top: shot.y,
            width: "clamp(230px, 38vw, 560px)",
            height: "auto",
            transform: "translate(-50%, -94%)",
            opacity: 1,
            filter: "brightness(1.12) contrast(1.06)",
          }}
        />
      )}
      {FALLBACK_CLIPS.map((src, index) => (
        <video
          key={src}
          ref={(node) => { videos.current[index] = node; }}
          src={src}
          muted
          playsInline
          preload="auto"
          onEnded={() => setShot((current) => current?.clip === index ? null : current)}
          className="absolute max-w-none object-contain mix-blend-screen"
          style={{
            display: shot?.clip === index && !activeFrames.length ? "block" : "none",
            left: shot?.x ?? 0,
            top: shot?.y ?? 0,
            width: "clamp(230px, 38vw, 560px)",
            height: "auto",
            transform: "translate(-50%, -94%)",
            opacity: 1,
            filter: "brightness(1.12) contrast(1.06)",
          }}
        />
      ))}
    </div>
  );
}
