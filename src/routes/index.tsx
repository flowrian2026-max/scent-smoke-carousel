import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import amber from "@/assets/bottle-amber.png";
import rose from "@/assets/bottle-rose.png";
import violet from "@/assets/bottle-violet.png";
import blue from "@/assets/bottle-blue.png";
import { ThreeSmokeCanvas, type ThreeSmokeHandle } from "@/components/ThreeSmokeCanvas";
import { ThreeStageCanvas } from "@/components/ThreeStageCanvas";

type Perfume = { name: string; note: string; color: string; img: string };

const PERFUMES: Perfume[] = [
  { name: "Aurelia", note: "عنبر · وانیل · عود", color: "#a99acb", img: amber },
  { name: "Rose Velours", note: "گل رز · مشک · فلفل صورتی", color: "#bd8eae", img: rose },
  { name: "Elysian", note: "زنبق · بنفشه · چرم", color: "#9b8fd0", img: violet },
  { name: "Ocean Breeze", note: "مرکبات · نمک دریا · وتیور", color: "#879fcb", img: blue },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Maison d'Essence — عطرهای لوکس" },
      { name: "description", content: "ویترین سینمایی عطرها با سکوی گردان، معماری قوس‌دار سه‌بعدی و مه رایحه." },
      { property: "og:title", content: "Maison d'Essence — عطرهای لوکس" },
      { property: "og:description", content: "ویترین تعاملی عطرها با عمق‌نمایی و دود رنگی." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const N = PERFUMES.length;
const STEP = (Math.PI * 2) / N;

function Index() {
  const [rot, setRot] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const rotRef = useRef(0);
  const target = useRef(0);
  const drag = useRef<{ last: number; moved: number; vel: number } | null>(null);
  const suppressClick = useRef(false);
  const smoke = useRef<ThreeSmokeHandle | null>(null);
  const smokeTimer = useRef<number | null>(null);
  const [size, setSize] = useState({ w: 1000, h: 800 });
  const [stageReady, setStageReady] = useState(false);

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    let raf = 0;
    let lastPaint = 0;
    const loop = (now: number) => {
      if (!drag.current) rotRef.current += (target.current - rotRef.current) * 0.09;
      // Keep the smooth motion but avoid forcing a React render on every display frame.
      if (now - lastPaint > 32) {
        setRot(rotRef.current);
        lastPaint = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      if (smokeTimer.current !== null) window.clearTimeout(smokeTimer.current);
    };
  }, []);

  const front = ((Math.round(-rotRef.current / STEP) % N) + N) % N;
  const active = PERFUMES[front]!;
  const mobile = size.w < 768;
  const R = mobile ? size.w * 0.36 : Math.min(size.w * 0.26, 380);
  const tilt = 0.28;
  const cx = mobile ? size.w / 2 : size.w * 0.42;
  const cy = size.h * (mobile ? 0.6 : 0.62);
  const bottleH = mobile ? size.h * 0.3 : size.h * 0.42;

  const stopSmoke = () => {
    if (smokeTimer.current !== null) {
      window.clearTimeout(smokeTimer.current);
      smokeTimer.current = null;
    }
    setOpen(null);
    smoke.current?.stop();
  };

  const releaseSmoke = (i: number) => {
    if (smokeTimer.current !== null) window.clearTimeout(smokeTimer.current);
    setOpen(i);
    const angle = i * STEP + rotRef.current;
    const depth = Math.cos(angle);
    const bottleX = cx + Math.sin(angle) * R;
    const bottleY = cy + depth * R * tilt;
    const scale = 0.55 + 0.45 * ((depth + 1) / 2);
    const height = bottleH * scale;
    // Transparent PNG canvas ends below the visible glass; this anchor targets its atomizer.
    const atomizerY = bottleY - height * 0.92 + height * 0.19;
    smokeTimer.current = window.setTimeout(() => {
      smoke.current?.burst(bottleX, atomizerY, PERFUMES[i]!.color);
      smokeTimer.current = null;
    }, 520);
  };

  const tap = (i: number) => {
    if (i !== front) {
      let d = i - front;
      if (d > N / 2) d -= N;
      if (d < -N / 2) d += N;
      target.current = Math.round(rotRef.current / STEP) * STEP - d * STEP;
      stopSmoke();
      return;
    }
    if (open === i) stopSmoke();
    else releaseSmoke(i);
  };

  return (
    <main
      dir="rtl"
      className="relative h-[100svh] w-full touch-none select-none overflow-hidden bg-background text-foreground"
      onPointerDown={(e) => {
        drag.current = { last: e.clientX, moved: 0, vel: 0 };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.last;
        d.last = e.clientX;
        d.moved += Math.abs(dx);
        const delta = dx * (mobile ? 0.008 : 0.005);
        rotRef.current += delta;
        d.vel = delta;
        if (d.moved > 8 && open !== null) stopSmoke();
      }}
      onPointerUp={() => {
        const d = drag.current;
        if (!d) return;
        target.current = Math.round((rotRef.current + d.vel * 10) / STEP) * STEP;
        drag.current = null;
        if (d.moved > 8) {
          suppressClick.current = true;
          window.setTimeout(() => { suppressClick.current = false; }, 120);
        }
      }}
      onPointerCancel={() => (drag.current = null)}
    >
      <div className="fashion-backdrop pointer-events-none absolute inset-0">
        <div className="stage-depth" aria-hidden="true">
          <div className="stage-arch">
            <div className="stage-arch-inner" />
          </div>
          <div className="stage-floor" />
        </div>
        <ThreeStageCanvas onReady={setStageReady} />
      </div>
      <div className="fashion-grain pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_42%_55%_at_42%_0%,var(--glow),transparent_72%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-50 transition-[background] duration-1000"
        style={{ background: `radial-gradient(ellipse 34% 34% at ${(cx / size.w) * 100}% ${(cy / size.h) * 100}%, ${active.color}20, transparent 72%)` }}
      />

      <div className="pointer-events-none absolute left-[-18%] top-[16%] h-[58vh] w-[52vw] rounded-full bg-violet-400/5 blur-[100px]" />
      <div className="pointer-events-none absolute right-[-16%] bottom-[-22%] h-[55vh] w-[48vw] rounded-full bg-indigo-300/5 blur-[110px]" />

      {/* Turntable: layered elliptical geometry with a cool violet edge light. */}
      <div
        className="pointer-events-none absolute"
        style={{ left: cx - R * 1.45, top: cy - R * 1.45 * tilt, width: R * 2.9, height: R * 2.9 * tilt + 46 }}
      >
        <div className="absolute inset-x-0 bottom-0 top-[18px] rounded-[50%] bg-[linear-gradient(90deg,var(--stone-dark),var(--stone)_45%,var(--stone-dark))] shadow-[0_24px_65px_rgba(0,0,0,.6)]" />
        <div className="absolute inset-x-0 bottom-[2px] h-[calc(100%-46px)] rounded-[50%] border-b-2 border-[var(--gold)] shadow-[0_8px_22px_var(--glow)]" />
        <div className="absolute inset-x-0 top-0 overflow-hidden rounded-[50%] border border-[var(--gold)]/70" style={{ height: R * 2.9 * tilt }}>
          <div
            className="absolute left-1/2 top-1/2 aspect-square w-full"
            style={{
              transform: `translate(-50%,-50%) scaleY(${tilt}) rotate(${(rot * 180) / Math.PI}deg)`,
              background: "radial-gradient(circle at 50% 50%, transparent 0 40%, var(--stone-dark) 100%), repeating-conic-gradient(from 10deg, var(--stone) 0deg 7deg, var(--stone-vein) 7.5deg 8deg, var(--stone) 8.5deg 23deg), var(--stone)",
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_45%_20%,var(--sheen),transparent_70%)]" />
        </div>
      </div>

      {PERFUMES.map((p, i) => {
        const angle = i * STEP + rot;
        const depth = Math.cos(angle);
        const x = cx + Math.sin(angle) * R;
        const y = cy + depth * R * tilt;
        const scale = 0.55 + 0.45 * ((depth + 1) / 2);
        const isOpen = open === i;
        const h = bottleH * scale;
        const w = h * 0.75;
        return (
          <div
            key={p.name}
            className="absolute"
            style={{ left: x - w / 2, top: y - h * 0.92, width: w, height: h, zIndex: Math.round(depth * 10) + 20 }}
            onClick={() => {
              if (suppressClick.current) return;
              tap(i);
            }}
          >
            <img
              src={p.img}
              alt={p.name}
              width={768}
              height={1024}
              draggable={false}
              className="relative z-10 h-full w-full cursor-pointer object-contain drop-shadow-[0_24px_32px_var(--shadow-deep)]"
              style={{ filter: `brightness(${0.45 + 0.55 * ((depth + 1) / 2)}) saturate(.88)` }}
            />
            <div
              className="pointer-events-none absolute inset-x-[12%] bottom-[18%] z-20 h-[35%] rounded-[50%] blur-2xl transition-opacity duration-700"
              style={{ background: `radial-gradient(ellipse at 50% 80%, ${p.color}66, transparent 72%)`, opacity: isOpen ? 0 : 0.38 + 0.2 * depth }}
            />
            <div
              className="pointer-events-none absolute inset-x-[15%] bottom-[8%] z-0 h-[18%] rounded-[50%] blur-2xl transition-opacity duration-700"
              style={{
                background: "radial-gradient(ellipse at 50% 55%, " + p.color + "66, transparent 72%)",
                opacity: isOpen ? 0.18 : 0.34 + 0.12 * depth,
              }}
            />
          </div>
        );
      })}

      <ThreeSmokeCanvas api={smoke} />

      <header className="pointer-events-none relative z-40 flex items-center justify-between px-6 py-6 md:px-12">
        <div dir="ltr" className="font-display text-2xl tracking-wide text-[#e8e6f4] md:text-3xl">Maison d'Essence</div>
        <span className="text-xs tracking-[0.3em] text-[#aaa8c5]">پرفیوم بوتیک</span>
      </header>

      <div className="pointer-events-none absolute right-6 top-24 z-40 max-w-xs md:right-12 md:top-1/3">
        <p className="mb-3 text-xs tracking-[0.3em] text-primary">سفر یک رایحه</p>
        <h1 dir="ltr" key={active.name} className="animate-in fade-in slide-in-from-bottom-2 text-right font-display text-4xl leading-tight text-[#f1effa] duration-500 md:text-7xl">
          {active.name}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">{active.note}</p>
        <span className="mt-5 block h-px w-24 transition-colors" style={{ background: active.color }} />
      </div>

      <p className="pointer-events-none absolute bottom-6 left-0 right-0 z-40 text-center text-xs tracking-widest text-muted-foreground">
        بکشید تا سکو بچرخد · روی عطر بزنید تا مه رایحه آزاد شود
      </p>

      {/* WebGL velvet panels own the main reveal; CSS remains the WebGL fallback. */}
      {!stageReady && <div aria-hidden="true" dir="ltr" className="pointer-events-none absolute inset-0 z-[60] flex overflow-hidden">
        <div
          className="curtain-panel curtain-panel-left relative h-full w-1/2"
          style={{ background: "repeating-linear-gradient(90deg, rgba(0,0,0,.72) 0 3.5%, rgba(91,83,119,.32) 5.5%, rgba(5,8,18,.78) 9.5%, rgba(45,41,66,.22) 12%), linear-gradient(90deg,#050814 0%,#1a192b 30%,#0b1020 100%)", boxShadow: "inset -24px 0 55px rgba(0,0,0,.7), inset 0 0 90px rgba(0,0,0,.42)" }}
        >
          <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-slate-200/50 to-transparent" />
        </div>
        <div
          className="curtain-panel curtain-panel-right relative h-full w-1/2"
          style={{ background: "repeating-linear-gradient(90deg, rgba(0,0,0,.72) 0 3.5%, rgba(91,83,119,.32) 5.5%, rgba(5,8,18,.78) 9.5%, rgba(45,41,66,.22) 12%), linear-gradient(270deg,#050814 0%,#1a192b 30%,#0b1020 100%)", boxShadow: "inset 24px 0 55px rgba(0,0,0,.7), inset 0 0 90px rgba(0,0,0,.42)" }}
        >
          <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-slate-200/50 to-transparent" />
        </div>
      </div>}
    </main>
  );
}
