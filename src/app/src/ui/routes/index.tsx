import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { BarChart3, Calculator, MessageSquare, ArrowRight } from "lucide-react";
import databricksLogo from "../assets/databricks-logo-white.svg";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

/* -------------------------------------------------------------------------- */
/*  Interactive Geometric Orb                                                  */
/* -------------------------------------------------------------------------- */

function InteractiveOrb() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const animFrame = useRef<number>(0);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    cancelAnimationFrame(animFrame.current);
    animFrame.current = requestAnimationFrame(() => setMouse({ x, y }));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("mousemove", handleMouseMove);
    return () => el.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  const rotX = mouse.y * -15;
  const rotY = mouse.x * 15;
  const glowX = 50 + mouse.x * 20;
  const glowY = 50 + mouse.y * 20;

  return (
    <div ref={containerRef} className="relative w-full h-full flex items-center justify-center" style={{ perspective: "1000px" }}>
      {/* Ambient glow */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full blur-[120px] transition-all duration-700 ease-out"
        style={{
          background: `radial-gradient(circle at ${glowX}% ${glowY}%, rgba(255, 54, 33, 0.18) 0%, rgba(0, 161, 241, 0.08) 50%, transparent 70%)`,
        }}
      />

      {/* Main orb group */}
      <div
        className="relative transition-transform duration-300 ease-out"
        style={{
          transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Outer ring */}
        <div className="absolute -inset-16 rounded-full border border-[var(--border)] animate-[spin_30s_linear_infinite]" />
        <div className="absolute -inset-24 rounded-full border border-[var(--border)] opacity-50 animate-[spin_45s_linear_infinite_reverse]" />

        {/* Data particles orbiting */}
        {[...Array(8)].map((_, i) => {
          const angle = (i / 8) * 360;
          const radius = 140 + (i % 3) * 30;
          const duration = 12 + i * 2;
          return (
            <div
              key={i}
              className="absolute left-1/2 top-1/2"
              style={{
                animation: `spin ${duration}s linear infinite ${i % 2 === 0 ? '' : 'reverse'}`,
                transformOrigin: "0 0",
              }}
            >
              <div
                className="rounded-full"
                style={{
                  width: 4 + (i % 3) * 2,
                  height: 4 + (i % 3) * 2,
                  background: i % 2 === 0 ? "var(--db-orange)" : "var(--db-blue)",
                  transform: `translate(${radius * Math.cos(angle * Math.PI / 180)}px, ${radius * Math.sin(angle * Math.PI / 180)}px)`,
                  opacity: 0.6 + (i % 3) * 0.15,
                  boxShadow: `0 0 ${8 + i * 2}px ${i % 2 === 0 ? 'rgba(255, 54, 33, 0.5)' : 'rgba(0, 161, 241, 0.5)'}`,
                }}
              />
            </div>
          );
        })}

        {/* Core diamond shape — the Databricks-inspired element */}
        <div className="relative w-32 h-32" style={{ transformStyle: "preserve-3d" }}>
          {/* Diamond facets */}
          <div
            className="absolute inset-0 animate-[spin_20s_linear_infinite]"
            style={{ transformStyle: "preserve-3d" }}
          >
            {[0, 90, 180, 270].map((rot) => (
              <div
                key={rot}
                className="absolute inset-4"
                style={{
                  transform: `rotateY(${rot}deg) translateZ(20px)`,
                  background: rot % 180 === 0
                    ? "linear-gradient(135deg, rgba(255, 54, 33, 0.25) 0%, rgba(255, 54, 33, 0.05) 100%)"
                    : "linear-gradient(135deg, rgba(0, 161, 241, 0.2) 0%, rgba(0, 161, 241, 0.03) 100%)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "4px",
                  backfaceVisibility: "hidden",
                }}
              />
            ))}
          </div>

          {/* Inner core glow */}
          <div className="absolute inset-6 rounded-full bg-gradient-to-br from-[var(--db-orange)] to-[var(--db-blue)] opacity-30 blur-xl animate-pulse-glow" />
          <div className="absolute inset-8 rounded-full bg-gradient-to-br from-[var(--db-orange)] to-transparent opacity-60 blur-md" />

          {/* Center dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-[var(--db-orange)] shadow-[0_0_20px_rgba(255,54,33,0.6)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Feature Card                                                               */
/* -------------------------------------------------------------------------- */

function FeatureCard({
  icon,
  title,
  description,
  to,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  to: string;
  delay: number;
}) {
  return (
    <Link
      to={to}
      className="group relative glass rounded-xl p-6 hover:bg-[var(--card-hover)] transition-all duration-300 hover:border-[var(--border-bright)] hover:shadow-[var(--glow-orange)]"
      style={{ animation: `fade-in-up 0.6s ease-out ${delay}ms both` }}
    >
      <div className="flex items-start gap-4">
        <div className="p-2.5 rounded-lg bg-[var(--accent)] text-[var(--db-orange)] shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[var(--foreground)] mb-1 group-hover:text-[var(--db-orange-light)] transition-colors">
            {title}
          </h3>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            {description}
          </p>
        </div>
        <ArrowRight
          size={18}
          className="mt-1 text-[var(--muted-foreground)] opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300"
        />
      </div>
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/*  Landing Page                                                               */
/* -------------------------------------------------------------------------- */

function LandingPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Top bar */}
      <header
        className="relative z-10 flex items-center justify-between px-8 py-5"
        style={{ animation: "fade-in-up 0.5s ease-out both" }}
      >
        <img src={databricksLogo} alt="Databricks" className="h-5 opacity-60" />
        <span className="text-xs tracking-widest uppercase text-[var(--muted-foreground)] font-medium">
          Demo Experience
        </span>
      </header>

      {/* Hero section */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 min-h-[calc(100vh-76px)] items-center px-8 lg:px-16 gap-12">
        {/* Left: Text */}
        <div className="max-w-xl">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-subtle text-xs font-medium text-[var(--muted-foreground)] mb-8"
            style={{ animation: "fade-in-up 0.6s ease-out 100ms both" }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--db-green)]" />
            Powered by Lakebase Autoscale
          </div>

          <h1
            className="text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6"
            style={{ animation: "fade-in-up 0.6s ease-out 200ms both", fontFamily: "var(--font-display)" }}
          >
            <span className="text-[var(--foreground)]">Residential</span>
            <br />
            <span className="text-gradient-orange">Investment Copilot</span>
          </h1>

          <p
            className="text-lg text-[var(--muted-foreground)] leading-relaxed mb-10 max-w-md"
            style={{ animation: "fade-in-up 0.6s ease-out 350ms both" }}
          >
            AI-powered portfolio analytics, deal underwriting, and investment intelligence
            — all built on the Databricks Data Intelligence Platform.
          </p>

          <div
            className="flex gap-3"
            style={{ animation: "fade-in-up 0.6s ease-out 500ms both" }}
          >
            <Link
              to="/portfolio"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[var(--db-orange)] text-white font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all shadow-[0_0_30px_rgba(255,54,33,0.25)]"
            >
              View Portfolio
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/copilot"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg glass text-[var(--foreground)] font-semibold text-sm hover:bg-[var(--card-hover)] transition-all"
            >
              Ask Copilot
            </Link>
          </div>
        </div>

        {/* Right: Interactive orb */}
        <div
          className="hidden lg:block h-[500px]"
          style={{ animation: "fade-in-up 0.8s ease-out 400ms both" }}
        >
          <InteractiveOrb />
        </div>
      </div>

      {/* Feature cards */}
      <div className="relative z-10 px-8 lg:px-16 pb-16 -mt-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl">
          <FeatureCard
            icon={<BarChart3 size={20} />}
            title="Portfolio Overview"
            description="Real-time metrics across 50 properties — occupancy, yields, AUM, and market exposure."
            to="/portfolio"
            delay={600}
          />
          <FeatureCard
            icon={<Calculator size={20} />}
            title="Deal Underwriting"
            description="Model acquisitions with 5-year cash flow projections, IRR, DSCR, and equity multiples."
            to="/deals"
            delay={750}
          />
          <FeatureCard
            icon={<MessageSquare size={20} />}
            title="Investment Copilot"
            description="Ask questions in natural language — the AI queries your data and delivers insights."
            to="/copilot"
            delay={900}
          />
        </div>
      </div>

      {/* Architecture tag line */}
      <div className="relative z-10 px-8 lg:px-16 pb-12">
        <div
          className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted-foreground)]"
          style={{ animation: "fade-in-up 0.5s ease-out 1100ms both" }}
        >
          {["Unity Catalog", "SDP Pipeline", "Lakebase Autoscale", "Databricks Apps", "Foundation Models"].map(
            (label, i) => (
              <span key={label} className="flex items-center gap-2">
                {i > 0 && <span className="text-[var(--border-bright)]">/</span>}
                <span className="px-2.5 py-1 rounded-md glass-subtle">{label}</span>
              </span>
            )
          )}
        </div>
      </div>
    </div>
  );
}
