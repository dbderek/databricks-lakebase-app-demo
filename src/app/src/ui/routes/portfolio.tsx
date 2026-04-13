import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import {
  useGetPortfolioOverviewSuspense,
  useGetPortfolioTimeSeriesSuspense,
  type PortfolioMetricOut,
  type PortfolioTimeSeriesOut,
} from "../lib/api";
import {
  Building2,
  DoorOpen,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export const Route = createFileRoute("/portfolio")({
  component: PortfolioPage,
});

/* -------------------------------------------------------------------------- */
/*  Color constants                                                            */
/* -------------------------------------------------------------------------- */

const CHART_COLORS = {
  orange: "#FF3621",
  orangeLight: "#FF5E4D",
  blue: "#00A1F1",
  green: "#00BFA5",
  purple: "#7C4DFF",
  yellow: "#FFC107",
  muted: "rgba(255,255,255,0.06)",
  grid: "rgba(255,255,255,0.06)",
  text: "#8A9BAA",
};

const PIE_COLORS = ["#FF3621", "#00A1F1", "#00BFA5", "#7C4DFF", "#FFC107", "#FF5E4D"];

/* -------------------------------------------------------------------------- */
/*  Custom Tooltip                                                             */
/* -------------------------------------------------------------------------- */

function ChartTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg px-3 py-2 text-xs shadow-lg border border-[var(--border-bright)]">
      <p className="text-[var(--muted-foreground)] mb-1 font-medium">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-[var(--muted-foreground)]">{entry.name}:</span>
          <span className="font-semibold text-[var(--foreground)]">
            {formatter ? formatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

function PortfolioPage() {
  return (
    <div>
      <div className="mb-8" style={{ animation: "fade-in-up 0.5s ease-out both" }}>
        <h2 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          Portfolio Overview
        </h2>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Real-time metrics across your residential investment portfolio
        </p>
      </div>

      <QueryErrorResetBoundary>
        {({ reset }) => (
          <ErrorBoundary
            onReset={reset}
            fallbackRender={({ error, resetErrorBoundary }) => (
              <div className="glass rounded-xl p-6 border border-[var(--destructive)]/30">
                <div className="flex items-center gap-3 text-[var(--destructive)]">
                  <AlertTriangle size={20} />
                  <p className="font-medium">Failed to load portfolio</p>
                </div>
                <p className="text-sm text-[var(--muted-foreground)] mt-2">{error.message}</p>
                <button
                  onClick={resetErrorBoundary}
                  className="mt-4 px-4 py-2 bg-[var(--db-orange)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
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
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass rounded-xl h-32 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass rounded-xl h-[350px] animate-pulse" />
        <div className="glass rounded-xl h-[350px] animate-pulse" />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dashboard Content                                                          */
/* -------------------------------------------------------------------------- */

function PortfolioContent() {
  const { data: overviewResp } = useGetPortfolioOverviewSuspense();
  const { data: timeSeriesResp } = useGetPortfolioTimeSeriesSuspense();
  const overview = overviewResp.data;
  const timeSeries = timeSeriesResp.data;

  // Compute deltas from time series (last month vs previous month)
  const sorted = [...timeSeries].sort((a, b) => a.rent_month.localeCompare(b.rent_month));
  const latest = sorted[sorted.length - 1];
  const prev = sorted.length > 1 ? sorted[sorted.length - 2] : null;

  const occDelta = latest?.portfolio_occupancy_pct != null && prev?.portfolio_occupancy_pct != null
    ? latest.portfolio_occupancy_pct - prev.portfolio_occupancy_pct
    : null;
  const yieldDelta = latest?.annualized_cash_yield_pct != null && prev?.annualized_cash_yield_pct != null
    ? latest.annualized_cash_yield_pct - prev.annualized_cash_yield_pct
    : null;

  // Aggregations for charts
  const propertyTypeData = aggregateByKey(overview.properties, "property_type");
  const marketData = aggregateByMarket(overview.properties);
  const occupancyDistribution = buildOccupancyDistribution(overview.properties);

  // Format time series for charts
  const tsChartData = sorted.map((r) => ({
    month: formatMonth(r.rent_month),
    aum: r.total_aum / 1_000_000,
    occupancy: r.portfolio_occupancy_pct ?? 0,
    yield: r.annualized_cash_yield_pct ?? 0,
    rent: r.effective_rent_collected / 1_000_000,
    denverOcc: r.denver_occupancy_pct ?? 0,
    otherOcc: r.other_occupancy_pct ?? 0,
  }));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        style={{ animation: "fade-in-up 0.5s ease-out 100ms both" }}
      >
        <KpiCard
          icon={<Building2 size={18} />}
          label="Properties"
          value={overview.total_properties.toString()}
          color="orange"
        />
        <KpiCard
          icon={<DoorOpen size={18} />}
          label="Total Units"
          value={overview.total_units.toLocaleString()}
          color="blue"
        />
        <KpiCard
          icon={<DollarSign size={18} />}
          label="Assets Under Mgmt"
          value={`$${(overview.total_aum / 1_000_000).toFixed(1)}M`}
          color="green"
        />
        <KpiCard
          icon={<Percent size={18} />}
          label="Avg Occupancy"
          value={overview.avg_occupancy_pct != null ? `${overview.avg_occupancy_pct.toFixed(1)}%` : "--"}
          color="purple"
          delta={occDelta}
        />
      </div>

      {/* Secondary KPIs */}
      <div
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        style={{ animation: "fade-in-up 0.5s ease-out 150ms both" }}
      >
        <KpiCard
          icon={<TrendingUp size={18} />}
          label="Avg Cash Yield"
          value={overview.avg_cash_yield_pct != null ? `${overview.avg_cash_yield_pct.toFixed(2)}%` : "--"}
          color="blue"
          delta={yieldDelta}
        />
        <KpiCard
          icon={<DollarSign size={18} />}
          label="Annual Rent"
          value={overview.total_annualized_rent != null ? `$${(overview.total_annualized_rent / 1_000_000).toFixed(1)}M` : "--"}
          color="green"
        />
        <KpiCard
          icon={<DollarSign size={18} />}
          label="Monthly Collections"
          value={latest ? `$${(latest.effective_rent_collected / 1_000_000).toFixed(2)}M` : "--"}
          color="orange"
        />
        <KpiCard
          icon={<Percent size={18} />}
          label="Collection Rate"
          value={latest?.portfolio_collection_rate_pct != null ? `${latest.portfolio_collection_rate_pct.toFixed(1)}%` : "--"}
          color="purple"
        />
      </div>

      {/* Charts Row 1: AUM trend + Occupancy trend */}
      <div
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        style={{ animation: "fade-in-up 0.5s ease-out 200ms both" }}
      >
        {/* AUM + Rent Area Chart */}
        <ChartCard title="AUM & Rent Collected" subtitle="Monthly trend ($M)">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={tsChartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradAum" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.blue} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradRent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.green} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={CHART_COLORS.green} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis dataKey="month" tick={{ fill: CHART_COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: CHART_COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip formatter={(v: number) => `$${v.toFixed(1)}M`} />} />
              <Area type="monotone" dataKey="aum" name="AUM" stroke={CHART_COLORS.blue} fill="url(#gradAum)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="rent" name="Rent" stroke={CHART_COLORS.green} fill="url(#gradRent)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Occupancy: Denver vs Other */}
        <ChartCard title="Occupancy Trend" subtitle="Denver vs rest of portfolio">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={tsChartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradDenver" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.orange} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={CHART_COLORS.orange} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradOther" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.purple} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={CHART_COLORS.purple} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis dataKey="month" tick={{ fill: CHART_COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[70, 100]} tick={{ fill: CHART_COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip content={<ChartTooltip formatter={(v: number) => `${v.toFixed(1)}%`} />} />
              <Area type="monotone" dataKey="denverOcc" name="Denver" stroke={CHART_COLORS.orange} fill="url(#gradDenver)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="otherOcc" name="Other" stroke={CHART_COLORS.purple} fill="url(#gradOther)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts Row 2: Property allocation + Market bar chart + Occupancy distribution */}
      <div
        className="grid grid-cols-1 lg:grid-cols-3 gap-4"
        style={{ animation: "fade-in-up 0.5s ease-out 250ms both" }}
      >
        {/* Property Type Allocation */}
        <ChartCard title="Property Type Mix" subtitle="By number of properties">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={propertyTypeData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                dataKey="value"
                nameKey="name"
                stroke="none"
                paddingAngle={3}
              >
                {propertyTypeData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                iconSize={8}
                formatter={(value: string) => <span style={{ color: CHART_COLORS.text, fontSize: 11 }}>{value}</span>}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0];
                  return (
                    <div className="glass rounded-lg px-3 py-2 text-xs shadow-lg border border-[var(--border-bright)]">
                      <span className="text-[var(--foreground)] font-semibold">{d.name}</span>
                      <span className="text-[var(--muted-foreground)] ml-2">{d.value} properties</span>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Top Markets by AUM */}
        <ChartCard title="Top Markets" subtitle="By AUM ($M)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={marketData.slice(0, 8)} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} horizontal={false} />
              <XAxis type="number" tick={{ fill: CHART_COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={70} tick={{ fill: CHART_COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip formatter={(v: number) => `$${v.toFixed(1)}M`} />} />
              <Bar dataKey="value" name="AUM" fill={CHART_COLORS.blue} radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Occupancy Distribution */}
        <ChartCard title="Occupancy Distribution" subtitle="Number of properties by range">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={occupancyDistribution} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis dataKey="range" tick={{ fill: CHART_COLORS.text, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: CHART_COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip formatter={(v: number) => `${v} properties`} />} />
              <Bar dataKey="count" name="Properties" radius={[4, 4, 0, 0]} barSize={28}>
                {occupancyDistribution.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.rangeStart < 85 ? CHART_COLORS.orange : entry.rangeStart < 90 ? CHART_COLORS.yellow : CHART_COLORS.green}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Property Table */}
      <div
        className="glass rounded-xl overflow-hidden"
        style={{ animation: "fade-in-up 0.5s ease-out 300ms both" }}
      >
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="font-semibold text-sm">All Properties</h3>
          <span className="text-xs text-[var(--muted-foreground)]">{overview.properties.length} properties</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
                <th className="text-left px-6 py-3 font-medium text-xs uppercase tracking-wider">Property</th>
                <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider">Location</th>
                <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider">Type</th>
                <th className="text-right px-4 py-3 font-medium text-xs uppercase tracking-wider">Units</th>
                <th className="text-right px-4 py-3 font-medium text-xs uppercase tracking-wider">Occupancy</th>
                <th className="text-right px-4 py-3 font-medium text-xs uppercase tracking-wider">Cash Yield</th>
                <th className="text-right px-6 py-3 font-medium text-xs uppercase tracking-wider">Value</th>
              </tr>
            </thead>
            <tbody>
              {overview.properties.map((p: PortfolioMetricOut) => (
                <tr
                  key={p.property_id}
                  className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--muted)] transition-colors"
                >
                  <td className="px-6 py-3.5 font-medium text-[var(--foreground)]">{p.property_name}</td>
                  <td className="px-4 py-3.5 text-[var(--muted-foreground)]">{p.city}, {p.state}</td>
                  <td className="px-4 py-3.5"><TypeBadge type={p.property_type} /></td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs">{p.units}</td>
                  <td className="px-4 py-3.5 text-right">
                    {p.occupancy_rate_pct != null ? <OccupancyBadge value={p.occupancy_rate_pct} /> : <span className="text-[var(--muted-foreground)]">--</span>}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs">
                    {p.cash_yield_pct != null ? `${p.cash_yield_pct.toFixed(2)}%` : "--"}
                  </td>
                  <td className="px-6 py-3.5 text-right font-mono text-xs">${(p.current_appraised_value / 1_000_000).toFixed(1)}M</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="px-5 pt-5 pb-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-[var(--muted-foreground)]">{subtitle}</p>
      </div>
      <div className="px-2 pb-3">
        {children}
      </div>
    </div>
  );
}

const colorMap = {
  orange: { bg: "rgba(255, 54, 33, 0.1)", text: "var(--db-orange)" },
  blue: { bg: "rgba(0, 161, 241, 0.1)", text: "var(--db-blue)" },
  green: { bg: "rgba(0, 191, 165, 0.1)", text: "var(--db-green)" },
  purple: { bg: "rgba(124, 77, 255, 0.1)", text: "var(--db-purple)" },
};

function KpiCard({
  icon, label, value, color = "orange", delta,
}: {
  icon: React.ReactNode; label: string; value: string;
  color?: keyof typeof colorMap; delta?: number | null;
}) {
  const c = colorMap[color];
  return (
    <div className="glass rounded-xl p-5 hover:bg-[var(--card-hover)] transition-colors group">
      <div className="flex items-center justify-between mb-3">
        <div className="inline-flex p-2 rounded-lg" style={{ background: c.bg, color: c.text }}>
          {icon}
        </div>
        {delta != null && (
          <DeltaBadge value={delta} />
        )}
      </div>
      <p className="text-xs text-[var(--muted-foreground)] font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{value}</p>
    </div>
  );
}

function DeltaBadge({ value }: { value: number }) {
  const isPositive = value >= 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-xs font-mono font-medium px-1.5 py-0.5 rounded-md"
      style={{
        background: isPositive ? "rgba(0, 191, 165, 0.1)" : "rgba(244, 67, 54, 0.1)",
        color: isPositive ? "var(--db-green)" : "var(--destructive)",
      }}
    >
      {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {Math.abs(value).toFixed(1)}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded-md text-xs font-medium glass-subtle capitalize">
      {type.replace(/_/g, " ")}
    </span>
  );
}

function OccupancyBadge({ value }: { value: number }) {
  const isLow = value < 85;
  return (
    <span
      className="inline-flex items-center gap-1 font-mono text-xs font-medium"
      style={{ color: isLow ? "var(--destructive)" : "var(--db-green)" }}
    >
      {isLow && <AlertTriangle size={12} />}
      {value.toFixed(1)}%
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Data helpers                                                               */
/* -------------------------------------------------------------------------- */

function aggregateByKey(properties: PortfolioMetricOut[], key: keyof PortfolioMetricOut) {
  const map = new Map<string, number>();
  for (const p of properties) {
    const k = String(p[key]).replace(/_/g, " ");
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function aggregateByMarket(properties: PortfolioMetricOut[]) {
  const map = new Map<string, number>();
  for (const p of properties) {
    const market = p.city;
    map.set(market, (map.get(market) ?? 0) + p.current_appraised_value / 1_000_000);
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value: Math.round(value * 10) / 10 }))
    .sort((a, b) => b.value - a.value);
}

function buildOccupancyDistribution(properties: PortfolioMetricOut[]) {
  const buckets = [
    { range: "<80%", rangeStart: 0, count: 0 },
    { range: "80-85%", rangeStart: 80, count: 0 },
    { range: "85-90%", rangeStart: 85, count: 0 },
    { range: "90-95%", rangeStart: 90, count: 0 },
    { range: "95-100%", rangeStart: 95, count: 0 },
  ];
  for (const p of properties) {
    if (p.occupancy_rate_pct == null) continue;
    const occ = p.occupancy_rate_pct;
    if (occ < 80) buckets[0].count++;
    else if (occ < 85) buckets[1].count++;
    else if (occ < 90) buckets[2].count++;
    else if (occ < 95) buckets[3].count++;
    else buckets[4].count++;
  }
  return buckets;
}

function formatMonth(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}
