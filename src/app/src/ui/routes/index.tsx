import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import {
  useGetPortfolioOverviewSuspense,
  type PortfolioMetricOut,
} from "../lib/api";

export const Route = createFileRoute("/")({
  component: PortfolioPage,
});

function PortfolioPage() {
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Portfolio Overview</h2>
      <QueryErrorResetBoundary>
        {({ reset }) => (
          <ErrorBoundary
            onReset={reset}
            fallbackRender={({ error, resetErrorBoundary }) => (
              <div className="p-4 border border-[var(--destructive)] rounded-md">
                <p className="text-[var(--destructive)]">
                  Failed to load portfolio: {error.message}
                </p>
                <button
                  onClick={resetErrorBoundary}
                  className="mt-2 px-3 py-1 bg-[var(--primary)] text-[var(--primary-foreground)] rounded text-sm"
                >
                  Retry
                </button>
              </div>
            )}
          >
            <Suspense fallback={<PortfolioSkeleton />}>
              <PortfolioContent />
            </Suspense>
          </ErrorBoundary>
        )}
      </QueryErrorResetBoundary>
    </div>
  );
}

function PortfolioSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-[var(--muted)] rounded-lg" />
        ))}
      </div>
      <div className="h-64 bg-[var(--muted)] rounded-lg" />
    </div>
  );
}

function PortfolioContent() {
  const { data } = useGetPortfolioOverviewSuspense();
  const overview = data.data;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Properties"
          value={overview.total_properties.toString()}
        />
        <KpiCard label="Total Units" value={overview.total_units.toLocaleString()} />
        <KpiCard
          label="AUM"
          value={`$${(overview.total_aum / 1_000_000).toFixed(1)}M`}
        />
        <KpiCard
          label="Avg Occupancy"
          value={
            overview.avg_occupancy_pct != null
              ? `${overview.avg_occupancy_pct.toFixed(1)}%`
              : "—"
          }
        />
      </div>

      {/* Additional KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard
          label="Avg Cash Yield"
          value={
            overview.avg_cash_yield_pct != null
              ? `${overview.avg_cash_yield_pct.toFixed(2)}%`
              : "—"
          }
        />
        <KpiCard
          label="Total Annual Rent"
          value={
            overview.total_annualized_rent != null
              ? `$${(overview.total_annualized_rent / 1_000_000).toFixed(1)}M`
              : "—"
          }
        />
      </div>

      {/* Property Table */}
      <div className="border border-[var(--border)] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--muted)]">
            <tr>
              <th className="text-left p-3 font-medium">Property</th>
              <th className="text-left p-3 font-medium">City</th>
              <th className="text-left p-3 font-medium">Type</th>
              <th className="text-right p-3 font-medium">Units</th>
              <th className="text-right p-3 font-medium">Occupancy</th>
              <th className="text-right p-3 font-medium">Cash Yield</th>
              <th className="text-right p-3 font-medium">AUM</th>
            </tr>
          </thead>
          <tbody>
            {overview.properties.map((p: PortfolioMetricOut) => (
              <tr
                key={p.property_id}
                className="border-t border-[var(--border)] hover:bg-[var(--accent)]"
              >
                <td className="p-3 font-medium">{p.property_name}</td>
                <td className="p-3 text-[var(--muted-foreground)]">
                  {p.city}, {p.state}
                </td>
                <td className="p-3">
                  <span className="px-2 py-0.5 bg-[var(--secondary)] rounded text-xs">
                    {p.property_type}
                  </span>
                </td>
                <td className="p-3 text-right">{p.units}</td>
                <td className="p-3 text-right">
                  {p.occupancy_rate_pct != null ? (
                    <span
                      className={
                        p.occupancy_rate_pct < 85
                          ? "text-[var(--destructive)] font-medium"
                          : ""
                      }
                    >
                      {p.occupancy_rate_pct.toFixed(1)}%
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="p-3 text-right">
                  {p.cash_yield_pct != null
                    ? `${p.cash_yield_pct.toFixed(2)}%`
                    : "—"}
                </td>
                <td className="p-3 text-right">
                  ${(p.current_appraised_value / 1_000_000).toFixed(1)}M
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 bg-[var(--card)] border border-[var(--border)] rounded-lg">
      <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">
        {label}
      </p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}
