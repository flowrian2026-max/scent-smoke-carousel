import { useCallback, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CinematicRevealLayers, type RevealPhase } from "@/components/CinematicRevealLayers";
import { ThreePerfumeCarousel, type FragranceChoice } from "@/components/ThreePerfumeCarousel";
import "@/components/CinematicScene.css";

const PERFUMES: FragranceChoice[] = [
  { name: "Aurelia", note: "AMBER · VANILLA · OUD" },
  { name: "Rose Velours", note: "ROSE PETAL · MUSK · PINK PEPPER" },
  { name: "Elysian", note: "IRIS · VIOLET · SOFT LEATHER" },
  { name: "Ocean Breeze", note: "CITRUS · SEA SALT · VETIVER" },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Maison d'Essence — The Fragrance Gallery" },
      { name: "description", content: "A cinematic perfume gallery with independent video layers and interactive 3D fragrance bottles." },
      { property: "og:title", content: "Maison d'Essence — The Fragrance Gallery" },
      { property: "og:description", content: "Curtains and smoke reveal an interactive 3D perfume collection inside a curved architectural stage." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [phase, setPhase] = useState<RevealPhase>("curtain");
  const [replayKey, setReplayKey] = useState(0);
  const active = PERFUMES[selectedIndex] ?? PERFUMES[0]!;

  const handlePhaseChange = useCallback((next: RevealPhase) => {
    setPhase(next);
  }, []);
  const handleSelect = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  return (
    <main dir="ltr" className="cinematic-main">
      <CinematicRevealLayers replayKey={replayKey} onPhaseChange={handlePhaseChange} />

      <ThreePerfumeCarousel
        fragrances={PERFUMES}
        selectedIndex={selectedIndex}
        visible={phase === "revealed"}
        onSelect={handleSelect}
      />

      <div className="pointer-events-none absolute inset-0 z-[31] bg-[radial-gradient(ellipse_44%_42%_at_50%_65%,transparent_20%,rgba(4,7,17,.28)_100%)]" />

      <header className="cinematic-header">
        <div className="cinematic-wordmark">
          Maison d'Essence
          <small>THE PRIVATE FRAGRANCE GALLERY</small>
        </div>
        <span className="cinematic-header-index">EXHIBITION 01 / 04</span>
      </header>

      <section className={`fragrance-copy ${phase === "revealed" ? "is-visible" : ""}`} aria-live="polite">
        <p className="fragrance-eyebrow">A STUDY IN FRAGRANCE · 0{selectedIndex + 1}</p>
        <h1>{active.name}</h1>
        <p>{active.note}</p>
      </section>

      <p className="stage-instruction">
        DRAG A BOTTLE TO ROTATE IT 360° · DRAG THE EMPTY STAGE TO TURN THE COLLECTION
      </p>

      <button
        type="button"
        className="replay-reveal"
        onClick={() => {
          setSelectedIndex(0);
          setReplayKey((key) => key + 1);
        }}
      >
        REPLAY THE REVEAL
      </button>
    </main>
  );
}
