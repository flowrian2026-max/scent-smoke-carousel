import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import type { Perfume } from "@/components/PerfumeStage";

const PerfumeStage = lazy(() => import("@/components/PerfumeStage"));

const PERFUMES: Perfume[] = [
  { name: "Ambre Nuit", note: "عنبر · وانیل · عود", color: "#d9822b" },
  { name: "Rose Velours", note: "گل رز · مشک · فلفل صورتی", color: "#c2185b" },
  { name: "Iris Noir", note: "زنبق · بنفشه · چرم", color: "#7b3fbf" },
  { name: "Vetiver Bleu", note: "وتیور · مرکبات · نمک دریا", color: "#2a7fc9" },
  { name: "Oud Émeraude", note: "عود · چای سبز · سدر", color: "#2e9d6a" },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Maison d'Essence — عطرهای لوکس" },
      { name: "description", content: "سکوی گردان عطرها؛ بطری را لمس کنید تا درپوش باز شود و رایحه‌اش را ببینید." },
      { property: "og:title", content: "Maison d'Essence — عطرهای لوکس" },
      { property: "og:description", content: "سکوی گردان عطرها با دود رنگی هر رایحه." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [active, setActive] = useState(0);
  const p = PERFUMES[active];
  return (
    <main dir="rtl" className="relative h-screen w-full overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,var(--glow),transparent_60%)]" />
      <ClientOnly fallback={null}>
        <Suspense fallback={null}>
          <PerfumeStage perfumes={PERFUMES} onActiveChange={setActive} />
        </Suspense>
      </ClientOnly>

      <header className="pointer-events-none relative z-10 flex items-center justify-between px-6 py-6 md:px-12">
        <div dir="ltr" className="font-display text-2xl tracking-wide md:text-3xl">
          Maison d'Essence
        </div>
        <span className="text-xs tracking-[0.3em] text-muted-foreground">پرفیوم بوتیک</span>
      </header>

      <div className="pointer-events-none absolute right-6 top-28 z-10 max-w-sm md:right-12 md:top-1/3">
        <p className="mb-3 text-xs tracking-[0.3em] text-primary">سفر یک رایحه</p>
        <h1 dir="ltr" className="text-right font-display text-5xl leading-tight md:text-7xl" key={p.name}>
          {p.name}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">{p.note}</p>
        <span className="mt-5 block h-px w-24" style={{ background: p.color }} />
      </div>

      <p className="pointer-events-none absolute bottom-8 left-0 right-0 z-10 text-center text-xs tracking-widest text-muted-foreground">
        بکشید تا سکو بچرخد · روی بطری بزنید تا درپوش باز شود
      </p>
    </main>
  );
}
