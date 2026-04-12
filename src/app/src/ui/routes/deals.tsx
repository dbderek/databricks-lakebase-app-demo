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

export const Route = createFileRoute("/deals")({
  component: DealsPage,
});

function DealsPage() {
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Deal Underwriting</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DealForm />
        <QueryErrorResetBoundary>
          {({ reset }) => (
            <ErrorBoundary
              onReset={reset}
              fallbackRender={({ error, resetErrorBoundary }) => (
                <div className="p-4 border border-[var(--destructive)] rounded-md">
                  <p className="text-[var(--destructive)]">{error.message}</p>
                  <button onClick={resetErrorBoundary} className="mt-2 px-3 py-1 bg-[var(--primary)] text-[var(--primary-foreground)] rounded text-sm">
                    Retry
                  </button>
                </div>
              )}
            >
              <Suspense fallback={<div className="animate-pulse h-64 bg-[var(--muted)] rounded-lg" />}>
                <DealHistory />
              </Suspense>
            </ErrorBoundary>
          )}
        </QueryErrorResetBoundary>
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
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3 bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
        <h3 className="font-medium text-lg">New Scenario</h3>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Property Name" name="property_name" required defaultValue="Test Property" />
          <FormField label="City" name="city" defaultValue="Denver" />
          <FormField label="State" name="state" defaultValue="CO" />
          <FormSelect label="Type" name="property_type" options={["multifamily", "single_family", "mixed_use"]} />
          <FormField label="Purchase Price ($)" name="purchase_price" type="number" required defaultValue="5000000" />
          <FormField label="Units" name="units" type="number" required defaultValue="50" />
          <FormField label="Monthly Rent / Unit ($)" name="monthly_rent_per_unit" type="number" required defaultValue="1500" />
          <FormField label="LTV (%)" name="ltv_pct" type="number" defaultValue="75" />
          <FormField label="Interest Rate (%)" name="interest_rate_pct" type="number" step="0.1" defaultValue="6.5" />
          <FormField label="Loan Term (yrs)" name="loan_term_years" type="number" defaultValue="30" />
          <FormField label="Rent Growth (%)" name="rent_growth_pct" type="number" step="0.1" defaultValue="3.0" />
          <FormField label="Expense Ratio (%)" name="expense_ratio_pct" type="number" defaultValue="35" />
          <FormField label="Exit Cap Rate (%)" name="exit_cap_rate_pct" type="number" step="0.1" defaultValue="5.5" />
          <FormField label="Hold Period (yrs)" name="hold_years" type="number" defaultValue="5" />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-md text-sm font-medium disabled:opacity-50"
        >
          {isPending ? "Running Forecast..." : "Run Forecast"}
        </button>
      </form>

      {result && <ForecastResult deal={result} />}
    </div>
  );
}

function ForecastResult({ deal }: { deal: DealScenarioOut }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 space-y-3">
      <h3 className="font-medium text-lg">Forecast Results</h3>
      <p className="text-sm text-[var(--muted-foreground)]">{deal.property_name}</p>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="NOI" value={deal.noi != null ? `$${deal.noi.toLocaleString()}` : "—"} />
        <MetricCard label="DSCR" value={deal.dscr != null ? `${deal.dscr.toFixed(2)}x` : "—"} />
        <MetricCard label="Cash-on-Cash" value={deal.cash_on_cash_pct != null ? `${deal.cash_on_cash_pct.toFixed(1)}%` : "—"} />
        <MetricCard label="IRR" value={deal.irr_pct != null ? `${deal.irr_pct.toFixed(1)}%` : "—"} />
        <MetricCard label="Equity Multiple" value={deal.equity_multiple != null ? `${deal.equity_multiple.toFixed(2)}x` : "—"} />
        <MetricCard label="NPV (8%)" value={deal.npv != null ? `$${Math.round(deal.npv).toLocaleString()}` : "—"} />
      </div>
    </div>
  );
}

function DealHistory() {
  const { data } = useListDealScenariosSuspense();
  const deals = data.data;

  if (deals.length === 0) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-6 text-center text-[var(--muted-foreground)]">
        No scenarios yet. Run a forecast to get started.
      </div>
    );
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
      <h3 className="font-medium text-lg mb-3">Recent Scenarios</h3>
      <div className="space-y-2">
        {deals.slice(0, 10).map((d) => (
          <div key={d.deal_id} className="p-3 border border-[var(--border)] rounded-md text-sm">
            <div className="flex justify-between items-center">
              <span className="font-medium">{d.property_name}</span>
              <span className="text-[var(--muted-foreground)]">
                {d.irr_pct != null ? `IRR: ${d.irr_pct.toFixed(1)}%` : ""}
              </span>
            </div>
            <div className="text-xs text-[var(--muted-foreground)] mt-1">
              ${d.purchase_price.toLocaleString()} · {d.units} units · {d.hold_years}yr hold
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FormField({
  label, name, type = "text", required = false, defaultValue, step,
}: {
  label: string; name: string; type?: string; required?: boolean; defaultValue?: string; step?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-[var(--muted-foreground)] mb-1">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        step={step}
        className="w-full px-2 py-1.5 border border-[var(--input)] rounded text-sm bg-[var(--background)]"
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
      <label className="block text-xs text-[var(--muted-foreground)] mb-1">{label}</label>
      <select
        name={name}
        className="w-full px-2 py-1.5 border border-[var(--input)] rounded text-sm bg-[var(--background)]"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o.replace("_", " ")}</option>
        ))}
      </select>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 bg-[var(--secondary)] rounded">
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
