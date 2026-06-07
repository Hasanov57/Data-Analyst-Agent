import { ArrowRight, CheckCircle2, Loader2, Table2 } from "lucide-react";

const summaryLabels = [
  ["Rows Before", "rows_before"],
  ["Rows After", "rows_after"],
  ["Duplicates Removed", "duplicates_removed"],
  ["Nulls Filled", "nulls_filled"],
];

export default function CleaningReport({ result, onProceed, isAnalyzing = false }) {
  const report = result.cleaning_report || {};
  const columnInfo = result.column_info || [];
  const previewRows = result.cleaned_data_preview || [];
  const previewColumns = previewRows[0] ? Object.keys(previewRows[0]) : [];

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Cleaning Report</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">Dataset cleaned successfully</h2>
            <p className="mt-2 text-sm text-slate-500">The cleaned file was saved and is ready for statistical analysis.</p>
          </div>
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryLabels.map(([label, key]) => (
            <MetricCard key={key} label={label} value={formatNumber(report[key])} />
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Table2 className="h-5 w-5 text-emerald-700" aria-hidden="true" />
          <h3 className="text-lg font-semibold text-slate-950">Column Changes</h3>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 font-semibold">Column</th>
                <th className="whitespace-nowrap px-4 py-3 font-semibold">Original Dtype</th>
                <th className="whitespace-nowrap px-4 py-3 font-semibold">Converted Dtype</th>
                <th className="whitespace-nowrap px-4 py-3 font-semibold">Nulls Filled</th>
                <th className="min-w-[280px] px-4 py-3 font-semibold">Transformations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {columnInfo.map((column, index) => (
                <tr key={`${column.original_name}-${column.column_name}`} className={index % 2 ? "bg-slate-50/60" : "bg-white"}>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-950">{column.column_name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{column.original_dtype}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{column.converted_dtype}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatNumber(column.nulls_filled)}</td>
                  <td className="px-4 py-3">
                    {column.transformations?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {column.transformations.map((transformation) => (
                          <span key={transformation} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                            {transformation}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400">No changes</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-slate-950">Cleaned Data Preview</h3>
          <span className="text-xs font-medium text-slate-500">First 10 rows</span>
        </div>

        <div className="max-h-[440px] overflow-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {previewColumns.map((column) => (
                  <th key={column} className="whitespace-nowrap px-4 py-3 font-semibold">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {previewRows.map((row, rowIndex) => (
                <tr key={rowIndex} className={rowIndex % 2 ? "bg-slate-50/60" : "bg-white"}>
                  {previewColumns.map((column) => (
                    <td key={column} className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {formatValue(row[column])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {onProceed && (
        <button type="button" className="btn-primary" onClick={onProceed} disabled={isAnalyzing}>
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Running analysis...
            </>
          ) : (
            <>
              Proceed to Analysis <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </>
          )}
        </button>
      )}
    </section>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function formatNumber(value) {
  return typeof value === "number" ? value.toLocaleString() : "0";
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") {
    return "Unknown";
  }

  return String(value);
}
