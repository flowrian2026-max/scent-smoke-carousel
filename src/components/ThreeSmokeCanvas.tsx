import { useEffect, useRef, useState } from "react";
import type { SmokeHandle } from "@/components/SmokeCanvas";

export type ThreeSmokeHandle = SmokeHandle;

const SMOKE_CLIPS = [
  "https://raw.githubusercontent.com/flowrian2026-max/Midnight-file-test/7fd7c9c33163a6a0975827ab1399e69740d0e0b4/smoke-references/Untitled%20video.mp4",
  "https://raw.githubusercontent.com/flowrian2026-max/Midnight-file-test/7fd7c9c33163a6a0975827ab1399e69740d0e0b4/smoke-references/Untitled%20video%20(1).mp4",
];

/**
 * Real-footage smoke layer. The source clips stay neutral silver/white;
 * fragrance color is deliberately not baked into the footage.
 */
export function ThreeSmokeCanvas({ api }: { api: React.MutableRefObject<SmokeHandle | null> }) {
  const videos = useRef<Array<HTMLVideoElement | null>>([null, null]);
  const nextClip = useRef(0);
  const [shot, setShot] = useState<{ clip: number; x: number; y: number; key: number } | null>(null);

  useEffect(() => {
    if (!shot) return;
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
  }, [shot]);

  useEffect(() => {
    api.current = {
      burst: (x, y) => {
        const clip = nextClip.current;
        nextClip.current = (nextClip.current + 1) % SMOKE_CLIPS.length;
        setShot({ clip, x, y, key: Date.now() });
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

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden" aria-hidden="true">
      {SMOKE_CLIPS.map((src, index) => (
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
            display: shot?.clip === index ? "block" : "none",
            left: shot?.x ?? 0,
            top: shot?.y ?? 0,
            width: "clamp(230px, 38vw, 560px)",
            height: "clamp(300px, 58vh, 680px)",
            transform: "translate(-50%, -88%)",
            opacity: 0.94,
            filter: "brightness(1.18) contrast(1.08)",
          }}
        />
      ))}
    </div>
  );
}
