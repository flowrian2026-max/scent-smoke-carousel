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

/**
 * Three independent media planes:
 * 1) the curved architectural environment film,
 * 2) the curtain film followed by the full-stage smoke film,
 * 3) the interactive GLB perfume carousel is rendered above the environment
 *    and below the curtain/smoke reveal planes.
 */
export function CinematicRevealLayers({ replayKey, onPhaseChange }: Props) {
  const curtainRef = useRef<HTMLVideoElement>(null);
  const smokeRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<RevealPhase>("curtain");

  useEffect(() => {
    let smokeTimer = 0;
    let revealTimer = 0;
    let failsafeTimer = 0;
    let cancelled = false;

    const change = (next: RevealPhase) => {
      if (cancelled) return;
      setPhase(next);
      onPhaseChange?.(next);
    };

    const reveal = () => {
      change("retreat");
      window.clearTimeout(revealTimer);
      revealTimer = window.setTimeout(() => change("revealed"), 1650);
    };

    const startSmoke = () => {
      if (cancelled) return;
      window.clearTimeout(failsafeTimer);
      change("smoke");
      const smoke = smokeRef.current;
      if (smoke) {
        smoke.pause();
        try { smoke.currentTime = 0; } catch { /* metadata may not be ready yet */ }
        smoke.load();
        void smoke.play().catch(() => undefined);
      }
      smokeTimer = window.setTimeout(reveal, 3600);
    };

    const curtain = curtainRef.current;
    if (curtain) {
      curtain.pause();
      try { curtain.currentTime = 0; } catch { /* wait for metadata */ }
      curtain.load();
      void curtain.play().catch(() => {
        window.clearTimeout(failsafeTimer);
        failsafeTimer = window.setTimeout(startSmoke, 900);
      });
    } else {
      startSmoke();
    }

    // A network-stalled film must never leave the fragrances permanently hidden.
    failsafeTimer = window.setTimeout(() => {
      if (curtain && curtain.readyState < 2) startSmoke();
    }, 8500);

    return () => {
      cancelled = true;
      window.clearTimeout(smokeTimer);
      window.clearTimeout(revealTimer);
      window.clearTimeout(failsafeTimer);
      curtain?.pause();
      smokeRef.current?.pause();
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
        onEnded={() => {
          setPhase("smoke");
          onPhaseChange?.("smoke");
          const smoke = smokeRef.current;
          if (smoke) {
            smoke.pause();
            try { smoke.currentTime = 0; } catch { /* wait for metadata */ }
            smoke.load();
            void smoke.play().catch(() => undefined);
          }
          window.setTimeout(() => {
            setPhase("retreat");
            onPhaseChange?.("retreat");
            window.setTimeout(() => {
              setPhase("revealed");
              onPhaseChange?.("revealed");
            }, 1650);
          }, 3600);
        }}
        onError={() => {
          setPhase("smoke");
          onPhaseChange?.("smoke");
          const smoke = smokeRef.current;
          if (smoke) {
            smoke.load();
            void smoke.play().catch(() => undefined);
          }
          window.setTimeout(() => {
            setPhase("retreat");
            onPhaseChange?.("retreat");
            window.setTimeout(() => {
              setPhase("revealed");
              onPhaseChange?.("revealed");
            }, 1650);
          }, 3600);
        }}
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
