import { useEffect, useRef, useState } from "react";

const ENVIRONMENT_VIDEO =
  "https://raw.githubusercontent.com/flowrian2026-max/Midnight-file-test/main/Gonbad%20doodi.mp4";
const CURTAIN_VIDEO =
  "https://raw.githubusercontent.com/flowrian2026-max/Midnight-file-test/main/Entrance.mp4";
const SMOKE_VIDEO =
  "https://raw.githubusercontent.com/flowrian2026-max/Midnight-file-test/main/smoke-references/Smoke%20version%204.mp4";

export type RevealPhase = "curtain" | "smoke" | "retreat" | "revealed";

type Props = {
  replayKey: number;
  onPhaseChange?: (phase: RevealPhase) => void;
};

/** Environment film at the back; the curtain and smoke films form one reveal layer. */
export function CinematicRevealLayers({ replayKey, onPhaseChange }: Props) {
  const curtainRef = useRef<HTMLVideoElement>(null);
  const smokeRef = useRef<HTMLVideoElement>(null);
  const startSmokeRef = useRef<() => void>(() => undefined);
  const [phase, setPhase] = useState<RevealPhase>("curtain");

  useEffect(() => {
    let cancelled = false;
    const timers = new Set<number>();

    const schedule = (callback: () => void, delay: number) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        if (!cancelled) callback();
      }, delay);
      timers.add(id);
    };

    const change = (next: RevealPhase) => {
      if (cancelled) return;
      setPhase(next);
      onPhaseChange?.(next);
    };

    const reveal = () => {
      change("retreat");
      schedule(() => change("revealed"), 1650);
    };

    const startSmoke = () => {
      if (cancelled) return;
      change("smoke");
      const smoke = smokeRef.current;
      if (smoke) {
        smoke.pause();
        try { smoke.currentTime = 0; } catch { /* metadata may not be ready yet */ }
        smoke.load();
        void smoke.play().catch(() => undefined);
      }
      schedule(reveal, 3600);
    };

    startSmokeRef.current = startSmoke;
    change("curtain");
    const curtain = curtainRef.current;
    if (curtain) {
      curtain.pause();
      try { curtain.currentTime = 0; } catch { /* wait for metadata */ }
      curtain.load();
      void curtain.play().catch(() => schedule(startSmoke, 900));
    } else {
      startSmoke();
    }

    // If the remote clip never becomes playable, continue instead of trapping the gallery.
    schedule(() => {
      if (curtain && curtain.readyState < 2) startSmoke();
    }, 8500);

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
      timers.clear();
      curtain?.pause();
      smokeRef.current?.pause();
      startSmokeRef.current = () => undefined;
    };
  }, [replayKey, onPhaseChange]);

  return (
    <div className="cinematic-layers" aria-hidden="true">
      <video
        className="environment-film"
        src={ENVIRONMENT_VIDEO}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      />
      <div className="environment-grade" />

      <video
        ref={curtainRef}
        className={`curtain-film ${phase === "curtain" ? "is-playing" : "is-gone"}`}
        src={CURTAIN_VIDEO}
        muted
        playsInline
        preload="auto"
        onEnded={() => startSmokeRef.current()}
        onError={() => startSmokeRef.current()}
      />

      <div className={`smoke-film-wrap smoke-${phase}`}>
        <video
          ref={smokeRef}
          className="smoke-film"
          src={SMOKE_VIDEO}
          muted
          playsInline
          preload="none"
          loop
        />
        <div className="smoke-density" />
      </div>
    </div>
  );
}
