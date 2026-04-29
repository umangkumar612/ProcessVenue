import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Zap, ShieldCheck, Activity, FileStack } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AsyncDoc — Async Document Processing for Modern Teams" },
      { name: "description", content: "Upload documents, run them through a real async pipeline, watch progress live, then review and export structured results." },
      { property: "og:title", content: "AsyncDoc — Async Document Processing" },
      { property: "og:description", content: "Production-grade async document processing with live progress." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-gradient-surface">
      {/* Nav */}
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-brand">
            <FileStack className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-semibold tracking-tight">AsyncDoc</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
          <Button asChild className="bg-gradient-brand shadow-glow">
            <Link to="/auth">Get started <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-16 pb-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-medium text-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" />
          Async pipelines · Realtime progress · Structured exports
        </div>
        <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight text-foreground text-balance md:text-7xl">
          Document processing,<br />
          <span className="bg-gradient-brand bg-clip-text text-transparent">built for production.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground text-balance">
          Drop in PDFs, DOCX, CSV or text. Each file flows through a multi-stage async pipeline with
          live progress, retries, structured extraction and finalized exports — all in one place.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button asChild size="lg" className="bg-gradient-brand shadow-glow">
            <Link to="/auth">Start processing <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth">View dashboard</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: Zap, title: "Truly async pipeline", desc: "Nine-stage processing flow. Files queue, parse, extract and store in the background while you keep working." },
            { icon: Activity, title: "Live progress", desc: "Realtime progress, stage timeline and logs stream into the UI the moment they happen — no polling." },
            { icon: ShieldCheck, title: "Owned by you", desc: "Per-user isolation, role-based admin access, finalized records lock automatically and export cleanly." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-elegant">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-xl font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} AsyncDoc. Built for serious document teams.
      </footer>
    </div>
  );
}
