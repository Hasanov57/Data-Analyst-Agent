import { ArrowRight, BarChart3, Boxes, CalendarDays, Hash, Loader2, Sigma, Table2 } from "lucide-react";

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
  const chartEntries = Object.entries(charts);

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-5 shadow-panel">
        <div className="mb-5 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-emerald-300" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-white">Analysis Report</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard icon={Table2} label="Total Rows" value={overview.total_rows} />
          <StatCard icon={Boxes} label="Total Columns" value={overview.total_columns} />
          <StatCard icon={Sigma} label="Numeric Columns" value={overview.numeric_columns_count} />
          <StatCard icon={Hash} label="Categorical Columns" value={overview.categorical_columns_count} />
          <StatCard icon={BarChart3} label="Total Outliers" value={overview.total_outliers_detected} />
          <StatCard icon={CalendarDays} label="Datetime Columns" value={overview.datetime_columns_detected} />
        </div>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-5 shadow-panel">
        <h3 className="mb-4 text-base font-semibold text-white">Numeric Column Stats</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
              <tr>
                <th className="whitespace-nowrap px-3 py-3 font-medium">Column</th>
                {numericStatKeys.map(([label]) => (
                  <th key={label} className="whitespace-nowrap px-3 py-3 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {Object.entries(descriptiveStats).map(([column, stats]) => (
                <tr key={column} className="text-zinc-300">
                  <td className="whitespace-nowrap px-3 py-3 font-medium text-white">{column}</td>
                  {numericStatKeys.map(([, key]) => (
                    <td key={key} className={`whitespace-nowrap px-3 py-3 ${statTone(key, stats[key])}`}>
                      {formatValue(stats[key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-5 shadow-panel">
        <h3 className="mb-4 text-base font-semibold text-white">Correlations</h3>
        <div className="grid gap-4 xl:grid-cols-2">
          <CorrelationGroup label="Top Positive" pairs={correlations.strongest_positive || []} />
          <CorrelationGroup label="Top Negative" pairs={correlations.strongest_negative || []} />
        </div>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-5 shadow-panel">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="text-base font-semibold text-white">Charts</h3>
          <span className="text-xs text-zinc-500">{chartEntries.length} generated</span>
        </div>
        {chartEntries.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {chartEntries.map(([name, image]) => (
              <figure key={name} className="overflow-hidden rounded-lg border border-zinc-800 bg-[#111214]">
                <img
                  className="h-auto w-full"
                  src={`data:image/png;base64,${image}`}
                  alt={formatChartName(name)}
                />
                <figcaption className="border-t border-zinc-800 px-4 py-3 text-sm text-zinc-300">
                  {formatChartName(name)}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No charts were generated for this dataset.</p>
        )}
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-5 shadow-panel">
        <h3 className="mb-4 text-base font-semibold text-white">Categorical Breakdown</h3>
        <div className="grid gap-4 xl:grid-cols-2">
          {Object.entries(categoricalAnalysis).map(([column, details]) => (
            <div key={column} className="rounded-lg border border-zinc-800 bg-[#111214] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-white">{column}</h4>
                {details.high_cardinality && (
                  <span className="rounded-md border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-xs text-amber-100">
                    High cardinality
                  </span>
                )}
              </div>
              <div className="space-y-3">
                {(details.value_counts || []).map((item) => (
                  <div key={item.value}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-xs text-zinc-400">
                      <span className="truncate">{item.value}</span>
                      <span>{formatPercent(item.percentage)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-emerald-300"
                        style={{ width: `${Math.min(item.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!Object.keys(categoricalAnalysis).length && (
            <p className="text-sm text-zinc-500">No categorical columns detected.</p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-5 shadow-panel">
        <h3 className="mb-3 text-base font-semibold text-white">Outlier Summary</h3>
        <div className="flex flex-wrap gap-2">
          {(outlierSummary.columns_with_most_outliers || []).map((item) => (
            <span
              key={item.column}
              className="rounded-md border border-zinc-700 bg-[#111214] px-3 py-2 text-sm text-zinc-300"
            >
              {item.column}: {formatNumber(item.outlier_count)}
            </span>
          ))}
        </div>
      </section>

      <button
        type="button"
        className="flex h-12 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
        onClick={onGenerateAI}
        disabled={isGeneratingAI}
      >
        {isGeneratingAI ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Senior analyst is reviewing your data<span className="typing-dots" aria-hidden="true" />
          </>
        ) : (
          <>
            Generate AI Analysis <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </>
        )}
      </button>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-[#111214] p-4">
      <div className="mb-3 flex items-center gap-2 text-zinc-500">
        <Icon className="h-4 w-4 text-emerald-300" aria-hidden="true" />
        <p className="text-xs font-medium uppercase">{label}</p>
      </div>
      <p className="text-2xl font-semibold text-white">{formatNumber(value)}</p>
    </div>
  );
}

function CorrelationGroup({ label, pairs }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-[#111214] p-4">
      <h4 className="mb-3 text-sm font-semibold text-white">{label}</h4>
      <div className="space-y-2">
        {pairs.length ? (
          pairs.map((pair) => (
            <div
              key={`${pair.column_a}-${pair.column_b}`}
              className={`rounded-lg border px-3 py-2 text-sm ${correlationTone(pair.r)}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="truncate">
                  {pair.column_a} / {pair.column_b}
                </span>
                <span className="font-semibold">{Number(pair.r).toFixed(3)}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-500">No correlations found.</p>
        )}
      </div>
    </div>
  );
}

function correlationTone(value) {
  const abs = Math.abs(Number(value));
  if (abs > 0.7) {
    return "border-emerald-300/30 bg-emerald-300/10 text-emerald-100";
  }
  if (abs >= 0.4) {
    return "border-amber-300/30 bg-amber-300/10 text-amber-100";
  }
  return "border-zinc-700 bg-zinc-900 text-zinc-300";
}

function statTone(key, value) {
  if (key === "skewness" && Math.abs(Number(value)) > 1) {
    return "text-red-300";
  }
  if (key === "outlier_count" && Number(value) > 0) {
    return "text-amber-200";
  }
  return "";
}

function formatChartName(name) {
  return name.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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
