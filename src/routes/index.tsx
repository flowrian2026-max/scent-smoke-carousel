import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import amber from "@/assets/bottle-amber.png";
import rose from "@/assets/bottle-rose.png";
import violet from "@/assets/bottle-violet.png";
import blue from "@/assets/bottle-blue.png";
import { SmokeCanvas, type SmokeHandle } from "@/components/SmokeCanvas";

type Perfume = { name: string; note: string; color: string; img: string };

const PERFUMES: Perfume[] = [
  { name: "Aurelia", note: "عنبر · وانیل · عود", color: "#e08a3a", img: amber },
  { name: "Rose Velours", note: "گل رز · مشک · فلفل صورتی", color: "#f08aa6", img: rose },
  { name: "Elysian", note: "زنبق · بنفشه · چرم", color: "#a86ae0", img: violet },
  { name: "Ocean Breeze", note: "مرکبات · نمک دریا · وتیور", color: "#5aa6e8", img: blue },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Maison d'Essence — عطرهای لوکس" },
      { name: "description", content: "سکوی گردان عطرها؛ گنبد شیشه‌ای را باز کنید و دود رایحه را ببینید." },
      { property: "og:title", content: "Maison d'Essence — عطرهای لوکس" },
      { property: "og:description", content: "سکوی گردان عطرها با گنبد شیشه‌ای و دود رنگی هر رایحه." },
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
  const smoke = useRef<SmokeHandle | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1000, h: 800 });

  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    on();
    window.addEventListener("resize", on);
    let raf = 0;
    const loop = () => {
      if (!drag.current) {
        rotRef.current += (target.current - rotRef.current) * 0.09;
      }
      setRot(rotRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", on);
    };
  }, []);

  const front = ((Math.round(-rotRef.current / STEP) % N) + N) % N;
  const active = PERFUMES[front]!;

  const mobile = size.w < 768;
  const R = mobile ? size.w * 0.36 : Math.min(size.w * 0.26, 380);
  const tilt = 0.28; // ellipse squash
  const cx = mobile ? size.w / 2 : size.w * 0.42;
  const cy = size.h * (mobile ? 0.6 : 0.62);
  const bottleH = mobile ? size.h * 0.3 : size.h * 0.42;

  const closeDome = () => {
    setOpen(null);
    smoke.current?.stop();
  };

  const openDome = (i: number) => {
    setOpen(i);
    // emit from the bottle base after the dome starts lifting
    setTimeout(() => smoke.current?.burst(cx, cy + R * tilt - bottleH * 0.18, PERFUMES[i]!.color), 250);
  };

  const tap = (i: number) => {
    if (i !== front) {
      let d = i - front;
      if (d > N / 2) d -= N;
      if (d < -N / 2) d += N;
      target.current = Math.round(rotRef.current / STEP) * STEP - d * STEP;
      closeDome();
      return;
    }
    if (open === i) closeDome();
    else openDome(i);
  };

  return (
    <main
      dir="rtl"
      ref={stageRef}
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
        if (d.moved > 8 && open !== null) closeDome();
      }}
      onPointerUp={() => {
        const d = drag.current;
        if (!d) return;
        target.current = Math.round((rotRef.current + d.vel * 10) / STEP) * STEP;
        drag.current = d.moved > 8 ? null : null;
      }}
      onPointerCancel={() => (drag.current = null)}
    >
      {/* spotlight */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_40%_70%_at_42%_0%,var(--glow),transparent_70%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-60 transition-[background] duration-700"
        style={{ background: `radial-gradient(ellipse 35% 30% at ${(cx / size.w) * 100}% ${(cy / size.h) * 100}%, ${active.color}22, transparent 70%)` }}
      />

      {/* turntable */}
      <div
        className="pointer-events-none absolute"
        style={{ left: cx - R * 1.45, top: cy - R * 1.45 * tilt, width: R * 2.9, height: R * 2.9 * tilt + 46 }}
      >
        {/* side wall */}
        <div className="absolute inset-x-0 bottom-0 top-[18px] rounded-[50%] bg-[linear-gradient(90deg,var(--stone-dark),var(--stone)_45%,var(--stone-dark))]" />
        <div className="absolute inset-x-0 bottom-[2px] h-[calc(100%-46px)] rounded-[50%] border-b-2 border-gold" />
        {/* top face */}
        <div className="absolute inset-x-0 top-0 overflow-hidden rounded-[50%] border border-gold/70" style={{ height: R * 2.9 * tilt }}>
          <div
            className="absolute left-1/2 top-1/2 aspect-square w-full"
            style={{
              transform: `translate(-50%,-50%) scaleY(${tilt}) rotate(${(rot * 180) / Math.PI}deg)`,
              background:
                "radial-gradient(circle at 50% 50%, transparent 0 40%, var(--stone-dark) 100%), repeating-conic-gradient(from 10deg, var(--stone) 0deg 7deg, var(--stone-vein) 7.5deg 8deg, var(--stone) 8.5deg 23deg), var(--stone)",
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_45%_20%,var(--sheen),transparent_70%)]" />
        </div>
      </div>

      {/* bottles */}
      {PERFUMES.map((p, i) => {
        const a = i * STEP + rot;
        const depth = Math.cos(a); // 1 = front
        const x = cx + Math.sin(a) * R;
        const y = cy + depth * R * tilt;
        const s = 0.55 + 0.45 * ((depth + 1) / 2);
        const isOpen = open === i;
        const h = bottleH * s;
        const w = h * 0.75;
        return (
          <div
            key={p.name}
            className="absolute"
            style={{ left: x - w / 2, top: y - h * 0.92, width: w, height: h, zIndex: Math.round(depth * 10) + 20 }}
            onPointerUp={() => {
              if (drag.current && drag.current.moved > 8) return;
              tap(i);
            }}
          >
            <img
              src={p.img}
              alt={p.name}
              width={768}
              height={1024}
              draggable={false}
              className="relative z-10 h-full w-full cursor-pointer object-contain drop-shadow-[0_20px_25px_var(--shadow-deep)]"
              style={{ filter: `brightness(${0.45 + 0.55 * ((depth + 1) / 2)})` }}
            />
            {/* trapped smoke inside the dome */}
            <div
              className="pointer-events-none absolute inset-x-[12%] bottom-[18%] z-20 h-[35%] rounded-[50%] blur-xl transition-opacity duration-700"
              style={{ background: `radial-gradient(ellipse at 50% 80%, ${p.color}aa, transparent 70%)`, opacity: isOpen ? 0 : 0.55 + 0.3 * depth }}
            />
            {/* glass dome */}
            <div
              className="pointer-events-none absolute inset-x-[4%] bottom-[9%] top-[-6%] z-20 transition-[transform,opacity] duration-[1400ms] ease-[cubic-bezier(.3,.7,.2,1)]"
              style={{
                transform: isOpen ? "translate(-8%, -85%) rotate(-14deg)" : "none",
                opacity: isOpen ? 0 : 1,
              }}
            >
              <div className="glass-dome absolute inset-0 rounded-t-[50%_38%] rounded-b-[6%]" />
              <div className="absolute -top-[5%] left-1/2 h-[7%] w-[11%] -translate-x-1/2 rounded-full glass-knob" />
            </div>
          </div>
        );
      })}

      <SmokeCanvas api={smoke} />

      <header className="pointer-events-none relative z-40 flex items-center justify-between px-6 py-6 md:px-12">
        <div dir="ltr" className="font-display text-2xl tracking-wide md:text-3xl">
          Maison d'Essence
        </div>
        <span className="text-xs tracking-[0.3em] text-muted-foreground">پرفیوم بوتیک</span>
      </header>

      <div className="pointer-events-none absolute right-6 top-24 z-40 max-w-xs md:right-12 md:top-1/3">
        <p className="mb-3 text-xs tracking-[0.3em] text-primary">سفر یک رایحه</p>
        <h1 dir="ltr" key={active.name} className="animate-in fade-in slide-in-from-bottom-2 text-right font-display text-4xl leading-tight duration-500 md:text-7xl">
          {active.name}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">{active.note}</p>
        <span className="mt-5 block h-px w-24 transition-colors" style={{ background: active.color }} />
      </div>

      <p className="pointer-events-none absolute bottom-6 left-0 right-0 z-40 text-center text-xs tracking-widest text-muted-foreground">
        بکشید تا سکو بچرخد · روی ادکلن بزنید تا گنبد باز شود
      </p>
    </main>
  );
}
