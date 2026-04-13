import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { QueryErrorResetBoundary, useQueryClient } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import {
  useCreateDealForecast,
  useListDealScenariosSuspense,
  listDealScenariosKey,
  type DealScenarioIn,
  type DealScenarioOut,
} from "../lib/api";
import {
  Calculator,
  TrendingUp,
  Shield,
  Coins,
  Target,
  Layers,
  DollarSign,
  Clock,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/deals")({
  component: DealsPage,
});

function DealsPage() {
  return (
    <div>
      <div className="mb-8" style={{ animation: "fade-in-up 0.5s ease-out both" }}>
        <h2 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          Deal Underwriting
        </h2>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Model acquisitions with 5-year cash flow projections
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3">
          <DealForm />
        </div>
        <div className="xl:col-span-2">
          <QueryErrorResetBoundary>
            {({ reset }) => (
              <ErrorBoundary
                onReset={reset}
                fallbackRender={({ error, resetErrorBoundary }) => (
                  <div className="glass rounded-xl p-6 border border-[var(--destructive)]/30">
                    <p className="text-[var(--destructive)] text-sm">{error.message}</p>
                    <button onClick={resetErrorBoundary} className="mt-3 px-4 py-2 bg-[var(--db-orange)] text-white rounded-lg text-sm font-medium">
                      Retry
                    </button>
                  </div>
                )}
              >
                <Suspense fallback={<div className="glass rounded-xl h-64 animate-pulse" />}>
                  <DealHistory />
                </Suspense>
              </ErrorBoundary>
            )}
          </QueryErrorResetBoundary>
        </div>
      </div>
    </div>
  );
}

function DealForm() {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<DealScenarioOut | null>(null);
  const { mutate, isPending } = useCreateDealForecast({
    mutation: {
      onSuccess: (resp) => {
        setResult(resp.data);
        queryClient.invalidateQueries({ queryKey: [...listDealScenariosKey()] });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const deal: DealScenarioIn = {
      property_name: fd.get("property_name") as string,
      city: (fd.get("city") as string) || undefined,
      state: (fd.get("state") as string) || undefined,
      property_type: (fd.get("property_type") as string) || undefined,
      purchase_price: Number(fd.get("purchase_price")),
      units: Number(fd.get("units")) || 1,
      monthly_rent_per_unit: Number(fd.get("monthly_rent_per_unit")),
      ltv_pct: Number(fd.get("ltv_pct")) || 75,
      interest_rate_pct: Number(fd.get("interest_rate_pct")) || 6.5,
      loan_term_years: Number(fd.get("loan_term_years")) || 30,
      rent_growth_pct: Number(fd.get("rent_growth_pct")) || 3.0,
      expense_ratio_pct: Number(fd.get("expense_ratio_pct")) || 35,
      exit_cap_rate_pct: Number(fd.get("exit_cap_rate_pct")) || 5.5,
      hold_years: Number(fd.get("hold_years")) || 5,
    };
    mutate(deal);
  };

  return (
    <div className="space-y-5">
      <form
        onSubmit={handleSubmit}
        className="glass rounded-xl overflow-hidden"
        style={{ animation: "fade-in-up 0.5s ease-out 100ms both" }}
      >
        {/* Form header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[var(--accent)]">
            <Calculator size={16} className="text-[var(--db-orange)]" />
          </div>
          <h3 className="font-semibold text-sm">New Scenario</h3>
        </div>

        <div className="p-6 space-y-5">
          {/* Property Info */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)] mb-3">Property Details</p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Property Name" name="property_name" required defaultValue="Test Property" span={2} />
              <FormField label="City" name="city" defaultValue="Denver" />
              <FormField label="State" name="state" defaultValue="CO" />
              <FormSelect label="Type" name="property_type" options={["multifamily", "single_family", "mixed_use"]} />
              <FormField label="Units" name="units" type="number" required defaultValue="50" />
            </div>
          </div>

          {/* Financials */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)] mb-3">Financials</p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Purchase Price ($)" name="purchase_price" type="number" required defaultValue="5000000" />
              <FormField label="Monthly Rent / Unit ($)" name="monthly_rent_per_unit" type="number" required defaultValue="1500" />
              <FormField label="LTV (%)" name="ltv_pct" type="number" defaultValue="75" />
              <FormField label="Interest Rate (%)" name="interest_rate_pct" type="number" step="0.1" defaultValue="6.5" />
            </div>
          </div>

          {/* Assumptions */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)] mb-3">Assumptions</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <FormField label="Loan Term (yrs)" name="loan_term_years" type="number" defaultValue="30" />
              <FormField label="Rent Growth (%)" name="rent_growth_pct" type="number" step="0.1" defaultValue="3.0" />
              <FormField label="Expense Ratio (%)" name="expense_ratio_pct" type="number" defaultValue="35" />
              <FormField label="Exit Cap (%)" name="exit_cap_rate_pct" type="number" step="0.1" defaultValue="5.5" />
              <FormField label="Hold Period (yrs)" name="hold_years" type="number" defaultValue="5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 bg-[var(--db-orange)] text-white rounded-lg text-sm font-semibold disabled:opacity-50 hover:opacity-90 active:scale-[0.99] transition-all shadow-[0_0_30px_rgba(255,54,33,0.2)]"
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Running Forecast...
              </span>
            ) : (
              "Run Forecast"
            )}
          </button>
        </div>
      </form>

      {result && <ForecastResult deal={result} />}
    </div>
  );
}

function ForecastResult({ deal }: { deal: DealScenarioOut }) {
  return (
    <div
      className="glass rounded-xl overflow-hidden"
      style={{ animation: "fade-in-up 0.4s ease-out both" }}
    >
      <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Forecast Results</h3>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{deal.property_name}</p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--db-green)]/10 text-[var(--db-green)] text-xs font-medium">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--db-green)]" />
          Complete
        </div>
      </div>
      <div className="p-6 grid grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard icon={<DollarSign size={16} />} label="Year 1 NOI" value={deal.noi != null ? `$${Math.round(deal.noi).toLocaleString()}` : "--"} />
        <MetricCard icon={<Shield size={16} />} label="DSCR" value={deal.dscr != null ? `${deal.dscr.toFixed(2)}x` : "--"} highlight={deal.dscr != null && deal.dscr >= 1.25} />
        <MetricCard icon={<Coins size={16} />} label="Cash-on-Cash" value={deal.cash_on_cash_pct != null ? `${deal.cash_on_cash_pct.toFixed(1)}%` : "--"} />
        <MetricCard icon={<TrendingUp size={16} />} label="IRR" value={deal.irr_pct != null ? `${deal.irr_pct.toFixed(1)}%` : "--"} highlight={deal.irr_pct != null && deal.irr_pct >= 15} />
        <MetricCard icon={<Layers size={16} />} label="Equity Multiple" value={deal.equity_multiple != null ? `${deal.equity_multiple.toFixed(2)}x` : "--"} />
        <MetricCard icon={<Target size={16} />} label="NPV (8%)" value={deal.npv != null ? `$${Math.round(deal.npv).toLocaleString()}` : "--"} />
      </div>
    </div>
  );
}

function DealHistory() {
  const { data } = useListDealScenariosSuspense();
  const deals = data.data;

  return (
    <div
      className="glass rounded-xl overflow-hidden"
      style={{ animation: "fade-in-up 0.5s ease-out 200ms both" }}
    >
      <div className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-3">
        <div className="p-2 rounded-lg bg-[var(--muted)]">
          <Clock size={16} className="text-[var(--muted-foreground)]" />
        </div>
        <h3 className="font-semibold text-sm">Recent Scenarios</h3>
      </div>

      {deals.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">No scenarios yet</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">Run a forecast to get started</p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {deals.slice(0, 8).map((d) => (
            <div key={d.deal_id} className="px-6 py-4 hover:bg-[var(--muted)] transition-colors">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium">{d.property_name}</p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                    ${d.purchase_price.toLocaleString()} | {d.units} units | {d.hold_years}yr hold
                  </p>
                </div>
                {d.irr_pct != null && (
                  <span
                    className="text-xs font-mono font-medium px-2 py-0.5 rounded-md"
                    style={{
                      background: d.irr_pct >= 15 ? "rgba(0, 191, 165, 0.1)" : "rgba(255, 193, 7, 0.1)",
                      color: d.irr_pct >= 15 ? "var(--db-green)" : "var(--db-yellow)",
                    }}
                  >
                    {d.irr_pct.toFixed(1)}% IRR
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Form Components                                                            */
/* -------------------------------------------------------------------------- */

function FormField({
  label, name, type = "text", required = false, defaultValue, step, span,
}: {
  label: string; name: string; type?: string; required?: boolean; defaultValue?: string; step?: string; span?: number;
}) {
  return (
    <div style={span ? { gridColumn: `span ${span}` } : undefined}>
      <label className="block text-xs text-[var(--muted-foreground)] mb-1.5 font-medium">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        step={step}
        className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-transparent text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--db-blue)] focus:ring-1 focus:ring-[var(--db-blue)]/30 transition-all"
      />
    </div>
  );
}

function FormSelect({
  label, name, options,
}: {
  label: string; name: string; options: string[];
}) {
  return (
    <div>
      <label className="block text-xs text-[var(--muted-foreground)] mb-1.5 font-medium">{label}</label>
      <select
        name={name}
        className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-transparent text-[var(--foreground)] focus:outline-none focus:border-[var(--db-blue)] focus:ring-1 focus:ring-[var(--db-blue)]/30 transition-all"
      >
        {options.map((o) => (
          <option key={o} value={o} className="bg-[var(--card)]">{o.replace(/_/g, " ")}</option>
        ))}
      </select>
    </div>
  );
}

function MetricCard({
  icon, label, value, highlight = false,
}: {
  icon: React.ReactNode; label: string; value: string; highlight?: boolean;
}) {
  return (
    <div className="p-4 rounded-lg bg-[var(--muted)] hover:bg-[var(--card-hover)] transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[var(--muted-foreground)]">{icon}</span>
        <p className="text-xs text-[var(--muted-foreground)] font-medium uppercase tracking-wider">{label}</p>
      </div>
      <p
        className="text-xl font-bold tracking-tight"
        style={{
          fontFamily: "var(--font-display)",
          color: highlight ? "var(--db-green)" : "var(--foreground)",
        }}
      >
        {value}
      </p>
    </div>
  );
}
