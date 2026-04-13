import { createRootRoute, Link, Outlet, useMatches } from "@tanstack/react-router";
import {
  BarChart3,
  Calculator,
  MessageSquare,
  Home,
  ChevronRight,
  User,
} from "lucide-react";
import { Suspense } from "react";
import { useCurrentUserSuspense } from "../lib/api";
import databricksLogo from "../assets/databricks-logo-white.svg";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const matches = useMatches();
  const isLanding = matches.length > 0 && matches[matches.length - 1].id === "/";

  // Landing page gets a clean layout — no sidebar
  if (isLanding) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen flex bg-[var(--background)]">
      {/* Sidebar */}
      <nav className="w-[260px] shrink-0 glass border-r border-[var(--border)] flex flex-col">
        {/* Logo */}
        <div className="px-5 pt-5 pb-4">
          <Link to="/" className="block">
            <img
              src={databricksLogo}
              alt="Databricks"
              className="h-5 opacity-70 hover:opacity-100 transition-opacity"
            />
          </Link>
          <div className="mt-4 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--db-green)] animate-pulse-glow" />
            <span className="text-[11px] font-medium tracking-widest uppercase text-[var(--muted-foreground)]">
              Investment Copilot
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-5 h-px bg-[var(--border)]" />

        {/* Nav links */}
        <div className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          <NavLink to="/portfolio" icon={<BarChart3 size={18} />} label="Portfolio" />
          <NavLink to="/deals" icon={<Calculator size={18} />} label="Deal Underwriting" />
          <NavLink to="/copilot" icon={<MessageSquare size={18} />} label="Copilot" />
        </div>

        {/* Bottom: User + Home link */}
        <div className="px-5 pb-5">
          <div className="h-px bg-[var(--border)] mb-4" />

          {/* Current user */}
          <Suspense fallback={<UserSkeleton />}>
            <CurrentUser />
          </Suspense>

          <Link
            to="/"
            className="flex items-center gap-2 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors mt-3"
          >
            <Home size={14} />
            Back to Home
          </Link>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-[1200px] mx-auto px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Current User                                                               */
/* -------------------------------------------------------------------------- */

function CurrentUser() {
  const { data } = useCurrentUserSuspense();
  const user = data.data;
  const displayName = user.display_name || "User";
  const email = user.emails?.find((e: any) => e.primary)?.value
    || user.user_name
    || "";
  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--db-orange)] to-[var(--db-blue)] flex items-center justify-center text-white text-xs font-bold shrink-0">
        {initials}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--foreground)] truncate">{displayName}</p>
        <p className="text-[11px] text-[var(--muted-foreground)] truncate">{email}</p>
      </div>
    </div>
  );
}

function UserSkeleton() {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="w-8 h-8 rounded-lg bg-[var(--muted)] animate-pulse shrink-0" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="h-3 w-24 bg-[var(--muted)] rounded animate-pulse" />
        <div className="h-2.5 w-32 bg-[var(--muted)] rounded animate-pulse" />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Nav Link                                                                   */
/* -------------------------------------------------------------------------- */

function NavLink({
  to,
  icon,
  label,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
      activeProps={{
        className:
          "bg-[var(--accent)] text-[var(--db-orange-light)]",
      }}
      inactiveProps={{
        className:
          "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]",
      }}
    >
      {icon}
      <span>{label}</span>
      <ChevronRight
        size={14}
        className="ml-auto opacity-0 -translate-x-1 group-hover:opacity-50 group-hover:translate-x-0 transition-all duration-200"
      />
    </Link>
  );
}
