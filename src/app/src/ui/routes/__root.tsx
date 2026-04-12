import { createRootRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <nav className="w-64 bg-[var(--card)] border-r border-[var(--border)] p-4 flex flex-col gap-1">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-[var(--foreground)]">
            DB Residential
          </h1>
          <p className="text-xs text-[var(--muted-foreground)]">
            Investment Copilot
          </p>
        </div>

        <NavLink to="/" label="Portfolio Overview" />
        <NavLink to="/deals" label="Deal Underwriting" />
        <NavLink to="/copilot" label="Investment Copilot" />
      </nav>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

function NavLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="px-3 py-2 rounded-md text-sm transition-colors"
      activeProps={{
        className:
          "bg-[var(--primary)] text-[var(--primary-foreground)] font-medium",
      }}
      inactiveProps={{
        className:
          "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]",
      }}
    >
      {label}
    </Link>
  );
}
