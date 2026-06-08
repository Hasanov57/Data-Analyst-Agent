import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { ArrowRight, BarChart3, Boxes, CalendarDays, Hash, Loader2, Sigma, Table2 } from "lucide-react";

const PlotlyChart = lazy(() => import("./PlotlyChart"));

const numericStatKeys = [
  ["Count", "count"],
  ["Mean", "mean"],
  ["Median", "median"],
  ["Std", "std"],
  ["Min", "min"],
  ["25%", "percentile_25"],
  ["75%", "percentile_75"],
  ["Max", "max"],
  ["Skewness", "skewness"],
  ["Kurtosis", "kurtosis"],
  ["Outliers", "outlier_count"],
];

export default function AnalysisReport({ result, onGenerateAI, isGeneratingAI = false }) {
  const analysis = result?.analysis || {};
  const charts = result?.charts || {};
  const overview = analysis.dataset_overview || {};
  const descriptiveStats = analysis.descriptive_stats || {};
  const correlations = analysis.correlation_analysis || {};
  const categoricalAnalysis = analysis.categorical_analysis || {};
  const outlierSummary = analysis.outlier_summary || {};
  const chartTabs = useMemo(() => buildChartTabs(charts), [charts]);
  const [activeChartTab, setActiveChartTab] = useState("");

  useEffect(() => {
    if (!chartTabs.length) {
      setActiveChartTab("");
      return;
    }

    if (!chartTabs.some((tab) => tab.id === activeChartTab)) {
      setActiveChartTab(chartTabs[0].id);
    }
  }, [activeChartTab, chartTabs]);

  const currentChartTab = chartTabs.find((tab) => tab.id === activeChartTab) || chartTabs[0];

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-emerald-700" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Statistical Analysis</p>
            <h2 className="text-2xl font-semibold text-slate-950">Dataset overview</h2>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard icon={Table2} label="Total Rows" value={overview.total_rows} />
          <StatCard icon={Boxes} label="Total Columns" value={overview.total_columns} />
          <StatCard icon={Sigma} label="Numeric Columns" value={overview.numeric_columns_count} />
          <StatCard icon={Hash} label="Categorical Columns" value={overview.categorical_columns_count} />
          <StatCard icon={BarChart3} label="Total Outliers" value={overview.total_outliers_detected} />
          <StatCard icon={CalendarDays} label="Date Columns" value={overview.datetime_columns_detected} />
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">Interactive Charts</h3>
            <p className="mt-1 text-sm text-slate-500">Hover, zoom, pan, and download chart data directly from each visualization.</p>
          </div>
          {chartTabs.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {chartTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                    activeChartTab === tab.id
                      ? "bg-[#4f8ef7] text-white shadow-sm"
                      : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                  onClick={() => setActiveChartTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {currentChartTab ? (
          <div className="grid gap-5 xl:grid-cols-2">
            {currentChartTab.charts.map(([name, chartJson]) => (
              <figure key={name} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
                <figcaption className="mb-3 flex items-center justify-between gap-3 px-1 text-sm font-semibold text-slate-800">
                  <span>{formatChartName(name)}</span>
                </figcaption>
                <Suspense fallback={<ChartLoading />}>
                  <PlotlyChart chartJson={chartJson} title={formatChartName(name)} />
                </Suspense>
              </figure>
            ))}
          </div>
        ) : (
          <EmptyPanel message="No charts were generated for this dataset." />
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-slate-950">Numeric Column Stats</h3>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 font-semibold">Column</th>
                {numericStatKeys.map(([label]) => (
                  <th key={label} className="whitespace-nowrap px-4 py-3 font-semibold">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {Object.entries(descriptiveStats).map(([column, stats], index) => (
                <tr key={column} className={index % 2 ? "bg-slate-50/60" : "bg-white"}>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-950">{column}</td>
                  {numericStatKeys.map(([, key]) => (
                    <td key={key} className={`whitespace-nowrap px-4 py-3 ${statTone(key, stats[key])}`}>
                      {formatValue(stats[key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-950">Correlations</h3>
          <div className="grid gap-4">
            <CorrelationGroup label="Top Positive" pairs={correlations.strongest_positive || []} />
            <CorrelationGroup label="Top Negative" pairs={correlations.strongest_negative || []} />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-950">Outlier Summary</h3>
          <div className="flex flex-wrap gap-2">
            {(outlierSummary.columns_with_most_outliers || []).map((item) => (
              <span key={item.column} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                {item.column}: {formatNumber(item.outlier_count)}
              </span>
            ))}
            {!outlierSummary.columns_with_most_outliers?.length && <p className="text-sm text-slate-500">No major outlier columns detected.</p>}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-slate-950">Categorical Breakdown</h3>
        <div className="grid gap-5 xl:grid-cols-2">
          {Object.entries(categoricalAnalysis).map(([column, details]) => (
            <div key={column} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-slate-950">{column}</h4>
                {details.high_cardinality && (
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                    High cardinality
                  </span>
                )}
              </div>
              <div className="space-y-3">
                {(details.value_counts || []).map((item) => (
                  <div key={item.value}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-xs text-slate-500">
                      <span className="truncate">{item.value}</span>
                      <span>{formatPercent(item.percentage)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${Math.min(item.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!Object.keys(categoricalAnalysis).length && <EmptyPanel message="No categorical columns detected." />}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">AI Interpretation</h3>
            <p className="mt-1 text-sm text-slate-500">Generate a business-style explanation using the computed analysis results.</p>
          </div>
          <button type="button" className="btn-primary" onClick={onGenerateAI} disabled={isGeneratingAI}>
            {isGeneratingAI ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Generating AI insights...
              </>
            ) : (
              <>
                Generate AI Analysis <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}

function ChartLoading() {
  return (
    <div className="chart-wrapper flex min-h-[400px] items-center justify-center text-sm text-slate-300">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
      Loading interactive chart...
    </div>
  );
}

function buildChartTabs(charts) {
  const entries = Object.entries(charts || {}).filter(([, chartJson]) => Boolean(chartJson));
  const groups = [
    {
      id: "distributions",
      label: "Distributions",
      charts: entries.filter(([name]) => name.startsWith("distribution_")),
    },
    {
      id: "correlations",
      label: "Correlations",
      charts: entries.filter(([name]) => name === "correlation_heatmap"),
    },
    {
      id: "categories",
      label: "Categories",
      charts: entries.filter(([name]) => name.startsWith("categorical_")),
    },
    {
      id: "outliers",
      label: "Outliers",
      charts: entries.filter(([name]) => name === "outlier_boxplot" || name.startsWith("outliers_")),
    },
    {
      id: "time-series",
      label: "Time Series",
      charts: entries.filter(([name]) => name === "timeseries" || name.startsWith("time_series")),
    },
    {
      id: "data-quality",
      label: "Data Quality",
      charts: entries.filter(([name]) => name === "missing_values"),
    },
  ];

  return groups.filter((group) => group.charts.length > 0);
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4 text-emerald-700" aria-hidden="true" />
        <p className="text-xs font-semibold uppercase">{label}</p>
      </div>
      <p className="text-2xl font-semibold text-slate-950">{formatNumber(value)}</p>
    </div>
  );
}

function CorrelationGroup({ label, pairs }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h4 className="mb-3 text-sm font-semibold text-slate-950">{label}</h4>
      <div className="space-y-2">
        {pairs.length ? (
          pairs.map((pair) => (
            <div key={`${pair.column_a}-${pair.column_b}`} className={`rounded-xl border px-3 py-2 text-sm ${correlationTone(pair.r)}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-slate-700">
                  {pair.column_a} / {pair.column_b}
                </span>
                <span className="font-semibold">{Number(pair.r).toFixed(3)}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">No correlations found.</p>
        )}
      </div>
    </div>
  );
}

function EmptyPanel({ message }) {
  return <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">{message}</p>;
}

function correlationTone(value) {
  const abs = Math.abs(Number(value));
  if (abs > 0.7) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (abs >= 0.4) {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  return "border-slate-200 bg-white text-slate-600";
}

function statTone(key, value) {
  if (key === "skewness" && Math.abs(Number(value)) > 1) {
    return "font-medium text-red-600";
  }
  if (key === "outlier_count" && Number(value) > 0) {
    return "font-medium text-amber-700";
  }
  return "text-slate-600";
}

function formatChartName(name) {
  return name.replace(/^distribution_/, "Distribution - ")
    .replace(/^categorical_/, "Top Values - ")
    .replace("correlation_heatmap", "Correlation Matrix")
    .replace("outlier_boxplot", "Outlier Overview")
    .replace("timeseries", "Time Series Trend")
    .replace("missing_values", "Missing Values Map")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatNumber(value) {
  return typeof value === "number" ? value.toLocaleString() : "0";
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatValue(value) {
  if (value === null || value === undefined) {
    return "N/A";
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(3);
  }
  return String(value);
}
